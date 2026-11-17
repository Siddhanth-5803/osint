// The evidence bag: one main chat plus optional context chats from other apps.
// Shared by the website, the one-click page and the tests.
import { parseFiles } from "./parser.js";
import { computeStats, statsForAi, contextSummary, buildTranscriptEx, makeNameMap, scrub } from "./stats.js";

export const MAX_CONTEXT = 8; // extra chats on top of the main one (a group plus a private chat with each friend)
export const NOT_SAME = "__not_same__"; // alias choice meaning "a different person"
const SOURCE_NAMES = { whatsapp: "WhatsApp", telegram: "Telegram", instagram: "Instagram" };
export const sourceName = (s) => SOURCE_NAMES[s] || "Chat";

let seq = 0;

// ---------- reading uploads ----------
// Each uploaded file (a zip, .txt or .json) becomes one group, so several exports can be dropped at once.
export async function readUploads(fileList, JSZip) {
  const groups = [], errors = [];
  for (const f of Array.from(fileList || [])) {
    try {
      if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
        if (!JSZip) throw new Error("the zip reader didn't load. Unzip it and drop the .txt inside");
        let zip;
        try { zip = await JSZip.loadAsync(f); }
        catch { throw new Error("couldn't be opened. Export the chat again, or unzip it and drop the .txt inside"); }
        const entries = Object.values(zip.files).filter((e) => !e.dir && /\.(txt|json)$/i.test(e.name) && !/__MACOSX/.test(e.name));
        const files = [];
        for (const e of entries) {
          let name = e.name.split("/").pop();
          // iPhone zips call the chat "_chat.txt"; the zip's own name has the chat title.
          if (/^_chat\.txt$/i.test(name)) name = f.name.replace(/\.zip$/i, ".txt");
          files.push({ name, text: await e.async("string") });
        }
        if (!files.length) throw new Error("has no chat inside");
        groups.push({ label: f.name, files });
      } else if (/\.(txt|json)$/i.test(f.name)) {
        groups.push({ label: f.name, files: [{ name: f.name, text: await f.text() }] });
      } else {
        errors.push(`${f.name}: not a chat export (use a .zip, .txt or .json)`);
      }
    } catch (err) {
      errors.push(`${f.name}: ${err.message}`);
    }
  }
  return { groups, errors };
}

function mergeChats(a, b) {
  const messages = [...a.messages, ...b.messages].sort((x, y) => x.ts - y.ts).map((m, i) => ({ ...m, i: i + 1 }));
  return { ...a, messages };
}

// Turns groups into bag items { id, label, chat, stats }.
export function parseUploads(groups) {
  const parsed = [], errors = [];
  for (const g of groups) {
    try { parsed.push({ label: g.label, chat: parseFiles(g.files) }); }
    catch (err) { errors.push(`${g.label}: ${err.message}`); }
  }
  // Instagram splits one chat over message_1.json, message_2.json...: put those back together.
  const merged = [];
  for (const c of parsed) {
    const twin = c.chat.source === "instagram" && merged.find((m) => m.chat.source === "instagram" && m.chat.title === c.chat.title);
    if (twin) twin.chat = mergeChats(twin.chat, c.chat);
    else merged.push(c);
  }
  const items = [];
  for (const m of merged) {
    const stats = computeStats(m.chat);
    if (stats.totalMessages < 10 || stats.people.length < 2) {
      errors.push(`${m.label}: too small to investigate (it needs at least 10 messages from 2 people)`);
      continue;
    }
    items.push({ id: `c${++seq}`, label: m.label, chat: m.chat, stats });
  }
  return { items, errors };
}

const signature = (it) => [it.chat.source, it.chat.title, it.stats.totalMessages, it.stats.range?.from, it.stats.range?.to].join("|");

// Adds items to the bag without duplicates, up to the limit. Returns { bag, notes }.
export function addToBag(bag, items) {
  const out = [...bag], notes = [];
  for (const it of items) {
    if (out.some((b) => signature(b) === signature(it))) { notes.push(`${it.label}: already added`); continue; }
    if (out.length >= MAX_CONTEXT + 1) { notes.push(`${it.label}: the bag is full (the main chat plus ${MAX_CONTEXT} extra chats)`); continue; }
    out.push(it);
  }
  return { bag: out, notes };
}

// Any chat can be the main one (a group or a private chat). The biggest is the default; the viewer can switch.
export const isGroup = (it) => it.stats.people.length >= 3;
export const pickMain = (items) =>
  items.reduce((best, it) => (!best || it.stats.totalMessages > best.stats.totalMessages ? it : best), null)?.id ?? null;

// ---------- the same person on different apps ----------
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");
const firstTok = (s) => norm(String(s || "").trim().split(/\s+/)[0]);

// Finds the main-chat name that this name probably belongs to, or null.
export function autoAlias(name, mainNames) {
  if (mainNames.includes(name)) return name;
  const n = norm(name);
  const exact = mainNames.filter((m) => norm(m) === n);
  if (exact.length === 1) return exact[0];
  const f = firstTok(name);
  if (f.length >= 3) {
    const hits = mainNames.filter((m) => firstTok(m) === f);
    if (hits.length === 1) return hits[0];
  }
  if (n.length >= 4) {
    const hits = mainNames.filter((m) => { const mn = norm(m); return mn !== n && mn.length >= 4 && (mn.startsWith(n) || n.startsWith(mn)); });
    if (hits.length === 1) return hits[0];
  }
  return null;
}

// userAliases: { nameInContextChat: mainName | NOT_SAME }
export function analysePeople(bag, mainId, userAliases = {}) {
  const main = bag.find((b) => b.id === mainId) || bag[0];
  const mainNames = main.stats.people.map((p) => p.name);
  const aliases = {}, auto = [], extra = new Map();
  for (const ctx of bag) {
    if (ctx === main) continue;
    for (const p of ctx.stats.people) {
      if (mainNames.includes(p.name)) continue;
      const choice = userAliases[p.name];
      let canon = null;
      if (choice === NOT_SAME) canon = null;
      else if (choice && mainNames.includes(choice)) canon = choice;
      else canon = autoAlias(p.name, mainNames);
      if (canon) {
        aliases[p.name] = canon;
        if (!choice) auto.push([p.name, canon]);
      } else {
        const prev = extra.get(p.name);
        extra.set(p.name, { name: p.name, chatId: ctx.id, messages: (prev?.messages || 0) + p.messages });
      }
    }
  }
  const unmatched = [...extra.values()].filter((e) => e.messages >= 5).sort((a, b) => b.messages - a.messages).slice(0, 8);
  const people = [...mainNames.map((name) => ({ name })), ...[...extra.keys()].map((name) => ({ name }))];
  return { main, mainNames, aliases, auto, unmatched, people };
}

// ---------- what goes to the AI ----------
// The context chats share part of the reading budget; the main chat keeps the rest.
export function planBudget(total, n) {
  if (!n) return { main: total, each: 0 };
  const share = Math.min(0.5, 0.15 + 0.07 * n);
  return { main: Math.round(total * (1 - share)), each: Math.round((total * share) / n) };
}

const safeTitle = (anon, t) => {
  const clean = scrub(String(t || ""));
  return (anon ? anon.text(clean) : clean).slice(0, 120);
};

// Builds everything the AI reads. hide=true swaps names for Suspect A, B, C across ALL chats,
// and the same person gets the same code on every app.
// all=true reads every message of every chat when it fits in `budget` (characters); if it doesn't,
// each chat gets a fair share of the budget. all=false reads a sample sized by `budget`.
// coverage tells exactly how much of each chat was included.
export function prepareEvidence({ bag, mainId, userAliases = {}, hide = true, budget, all = false }) {
  const { main, aliases, people } = analysePeople(bag, mainId, userAliases);
  const contexts = bag.filter((b) => b !== main).slice(0, MAX_CONTEXT);
  const anon = hide ? makeNameMap(people, aliases) : null;
  const rename = anon ? anon.name : (n) => n;
  const maxMsg = all ? 1500 : 500;
  const chats = [main, ...contexts];
  const labels = ["", ...contexts.map((_, i) => String.fromCharCode(66 + i))]; // main has plain ids; B, C, D... for the rest
  const build = (c, i, b) => buildTranscriptEx(c.chat, c.stats, { anon, budget: b, idPrefix: labels[i], all, maxMsg });

  let parts;
  if (all) {
    const full = chats.map((c, i) => build(c, i, Infinity));
    const total = full.reduce((n, f) => n + f.text.length, 0);
    parts = total <= budget ? full : chats.map((c, i) => build(c, i, Math.max(3000, Math.floor((budget * full[i].text.length) / total))));
  } else {
    const plan = planBudget(budget, contexts.length);
    parts = chats.map((c, i) => build(c, i, i === 0 ? plan.main : plan.each));
  }

  const mainStats = statsForAi(main.stats, rename);
  mainStats.title = safeTitle(anon, main.stats.title);
  if (anon) {
    // Word lists are built from the messages, so a name can show up in them in lowercase.
    mainStats.group_top_words = (mainStats.group_top_words || []).map((w) => anon.text(w));
    for (const p of mainStats.people || []) p.top_words = (p.top_words || []).map((w) => anon.text(w));
  }

  const ctx = contexts.map((c, i) => {
    const summary = contextSummary(c.stats, rename);
    summary.title = safeTitle(anon, c.stats.title);
    return { label: labels[i + 1], source: c.chat.source, kind: isGroup(c) ? "group" : "private", title: summary.title, stats: summary, transcript: parts[i + 1].text };
  });
  const coverage = chats.map((c, i) => ({
    label: labels[i],
    title: c.chat.title,
    included: parts[i].included,
    total: parts[i].total,
    pct: parts[i].total ? Math.round((parts[i].included / parts[i].total) * 100) : 100,
  }));
  return { anon, mainStats, mainTranscript: parts[0].text, contexts: ctx, coverage, fullyRead: coverage.every((c) => c.included >= c.total) };
}

// The chats by id prefix, the way the AI sees them: "" is the main chat, B, C, D... the context chats.
export function chatMap(bag, mainId) {
  const main = bag.find((b) => b.id === mainId) || bag[0];
  const map = { "": main.chat };
  bag.filter((b) => b !== main).slice(0, MAX_CONTEXT).forEach((b, i) => { map[String.fromCharCode(66 + i)] = b.chat; });
  return map;
}
