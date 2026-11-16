// Chat export parsers. Pure functions: they run in the browser and in Node tests.
// Every parser returns { source, title, messages: [{ i, ts, author, text, type }] }
// type is one of: text | media | deleted | system

const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;
const SPACES = /[   ]/g;

const MEDIA_RE = /^(<media omitted>|<attached: [^>]+>|(image|video|audio|sticker|gif|document|contact card|voice message) omitted|null)$/i;
const DELETED_RE = /^(this message was deleted\.?|you deleted this message\.?|message deleted)$/i;
const EDITED_RE = /\s*<this message was edited>$/i;

// [12/03/26, 9:14:05 PM] Name: text    or    12/03/2026, 21:14 - Name: text
const WA_LINE =
  /^\[?(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?\]?\s*[-–]?\s*(.*)$/i;

export function parseWhatsApp(raw, title = "WhatsApp chat") {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const entries = [];
  let firstMax = 0, secondMax = 0, yearFirst = false;

  for (const original of lines) {
    const line = original.replace(INVISIBLE, "").replace(SPACES, " ");
    const m = line.match(WA_LINE);
    if (m && line.trimStart().length === line.length) {
      const [, p1, p2, p3, hh, mm, ss, ampm, rest] = m;
      firstMax = Math.max(firstMax, +p1);
      secondMax = Math.max(secondMax, +p2);
      if (p1.length === 4) yearFirst = true;
      entries.push({ p1: +p1, p2: +p2, p3: +p3, p1len: p1.length, hh: +hh, mm: +mm, ss: +(ss || 0), ampm, rest });
    } else if (entries.length) {
      entries[entries.length - 1].rest += "\n" + line;
    }
  }
  if (!entries.length) return null;

  // Date order: India and most of the world use day/month; detect month/day when needed.
  const order = yearFirst ? "ymd" : firstMax > 12 ? "dmy" : secondMax > 12 ? "mdy" : "dmy";

  const messages = [];
  for (const e of entries) {
    let y, mo, d;
    if (order === "ymd") [y, mo, d] = [e.p1, e.p2, e.p3];
    else if (order === "dmy") [d, mo, y] = [e.p1, e.p2, e.p3];
    else [mo, d, y] = [e.p1, e.p2, e.p3];
    if (y < 100) y += 2000;
    let h = e.hh;
    if (e.ampm) {
      const pm = /^p/i.test(e.ampm);
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    const ts = new Date(y, mo - 1, d, h, e.mm, e.ss).getTime();
    if (Number.isNaN(ts)) continue;

    const rest = e.rest;
    const am = rest.match(/^([^:\n]{1,80}?):\s?([\s\S]*)$/);
    if (!am) {
      messages.push({ ts, author: null, text: rest.trim(), type: "system" });
      continue;
    }
    const author = am[1].replace(/^~\s*/, "").trim();
    let text = am[2].replace(EDITED_RE, "").trim();
    let type = "text";
    if (MEDIA_RE.test(text) || /\.(jpg|jpeg|png|webp|opus|mp4|pdf|vcf) \(file attached\)$/i.test(text)) type = "media";
    else if (DELETED_RE.test(text)) type = "deleted";
    messages.push({ ts, author, text, type });
  }
  return finish("whatsapp", title, messages);
}

function telegramText(t) {
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.map((x) => (typeof x === "string" ? x : x?.text || "")).join("");
  return "";
}

export function parseTelegram(json) {
  let chat = json;
  if (json?.chats?.list) {
    chat = [...json.chats.list].sort((a, b) => (b.messages?.length || 0) - (a.messages?.length || 0))[0];
  }
  if (!Array.isArray(chat?.messages)) return null;
  const messages = chat.messages.map((m) => {
    const ts = m.date_unixtime ? +m.date_unixtime * 1000 : new Date(m.date).getTime();
    if (m.type !== "message") return { ts, author: null, text: m.action || "", type: "system" };
    const text = telegramText(m.text);
    const isMedia = !text && (m.media_type || m.photo || m.file || m.sticker_emoji);
    return { ts, author: m.from || m.actor || "Unknown", text: text || (m.sticker_emoji ?? ""), type: isMedia ? "media" : "text" };
  });
  return finish("telegram", chat.name || "Telegram chat", messages);
}

function fixMojibake(s) {
  if (typeof s !== "string") return s;
  if (![...s].every((c) => c.charCodeAt(0) < 256)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
}

export function parseInstagram(jsons) {
  const list = Array.isArray(jsons) ? jsons : [jsons];
  const all = [];
  let title = "Instagram chat";
  for (const j of list) {
    if (!Array.isArray(j?.messages)) continue;
    if (j.title) title = fixMojibake(j.title);
    for (const m of j.messages) {
      const author = fixMojibake(m.sender_name || "Unknown");
      const text = fixMojibake(m.content || "");
      const media = m.photos || m.videos || m.audio_files || m.gifs || m.sticker || m.share;
      let type = "text";
      if (!text && media) type = "media";
      else if (/^(liked a message|reacted .* to your message)$/i.test(text)) type = "system";
      else if (/unsent a message/i.test(text)) type = "deleted";
      all.push({ ts: m.timestamp_ms, author, text, type });
    }
  }
  if (!all.length) return null;
  return finish("instagram", title, all);
}

function finish(source, title, messages) {
  const sorted = messages.filter((m) => Number.isFinite(m.ts)).sort((a, b) => a.ts - b.ts);
  sorted.forEach((m, i) => (m.i = i + 1));
  return { source, title, messages: sorted };
}

// files: [{ name, text }] -> parsed chat or throws a friendly error
export function parseFiles(files) {
  const jsons = [];
  for (const f of files) {
    if (/\.json$/i.test(f.name)) {
      try {
        jsons.push({ name: f.name, data: JSON.parse(f.text) });
      } catch { /* ignore broken json */ }
    }
  }
  const tg = jsons.find((j) => Array.isArray(j.data?.messages) && j.data.messages[0]?.date !== undefined || j.data?.chats?.list);
  if (tg) {
    const r = parseTelegram(tg.data);
    if (r?.messages.length) return r;
  }
  const ig = jsons.filter((j) => Array.isArray(j.data?.messages) && j.data.messages[0]?.timestamp_ms !== undefined);
  if (ig.length) {
    const r = parseInstagram(ig.map((j) => j.data));
    if (r?.messages.length) return r;
  }
  const txts = files.filter((f) => /\.txt$/i.test(f.name)).sort((a, b) => b.text.length - a.text.length);
  for (const t of txts) {
    const title = t.name.replace(/\.txt$/i, "").replace(/^WhatsApp Chat (with|-)\s*/i, "").replace(/^_chat$/, "WhatsApp chat");
    const r = parseWhatsApp(t.text, title);
    if (r && r.messages.filter((m) => m.author).length) return r;
  }
  throw new Error("Couldn't find a chat in that file. Export it again with \"Without media\" and drop the .zip or .txt here.");
}
