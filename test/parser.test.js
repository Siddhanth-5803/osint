import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsApp, parseFiles, parseTelegram, parseInstagram } from "../public/js/parser.js";
import { computeStats, buildTranscript, makeNameMap, statsForAi, restoreDeep } from "../public/js/stats.js";
import { SAMPLE_CHAT_TEXT } from "../public/js/sample.js";

const IOS = [
  "‎[03/12/25, 9:14:05 PM] Priya: hey are you up",
  "[03/12/25, 9:15:10 PM] Dev: yes!! what's up",
  "[03/12/25, 9:15:30 PM] Dev: ‎image omitted",
  "[03/12/25, 9:20:00 PM] Priya: nothing just bored",
  "this continues on a new line",
  "[03/12/25, 11:59:00 PM] Dev: This message was deleted",
  "[03/13/25, 12:05:00 AM] Priya: goodnight",
].join("\n");

test("iOS format: month/day detection, AM/PM, multiline, media, deleted", () => {
  const r = parseWhatsApp(IOS);
  assert.equal(r.messages.length, 6);
  const [a, , c, d, e, f] = r.messages;
  assert.equal(a.author, "Priya");
  assert.equal(new Date(a.ts).getMonth(), 2); // March, so mm/dd was detected from 13
  assert.equal(new Date(a.ts).getHours(), 21);
  assert.equal(c.type, "media");
  assert.match(d.text, /new line/);
  assert.equal(e.type, "deleted");
  assert.equal(new Date(f.ts).getHours(), 0);
});

test("Android format with system lines", () => {
  const r = parseWhatsApp(SAMPLE_CHAT_TEXT);
  assert.equal(r.messages[0].type, "system");
  assert.equal(r.messages[1].type, "system");
  const meera = r.messages.find((m) => m.author === "Meera");
  assert.equal(new Date(meera.ts).getDate(), 2);
  assert.equal(new Date(meera.ts).getMonth(), 1);
});

test("Android 12h format with ~ names", () => {
  const r = parseWhatsApp("14/02/24, 9:05 pm - ~ Anu: hi\n14/02/24, 9:06 pm - Raj: hello");
  assert.equal(r.messages[0].author, "Anu");
  assert.equal(new Date(r.messages[0].ts).getHours(), 21);
});

test("parseFiles picks the txt and gives a friendly error otherwise", () => {
  assert.equal(parseFiles([{ name: "WhatsApp Chat with Goa.txt", text: SAMPLE_CHAT_TEXT }]).title, "Goa");
  assert.throws(() => parseFiles([{ name: "x.txt", text: "hello" }]), /Couldn't find a chat/);
});

test("Telegram and Instagram", () => {
  const tg = parseTelegram({ name: "TG", messages: [
    { id: 1, type: "message", date: "2025-01-01T10:00:00", date_unixtime: "1735725600", from: "A", text: "hi" },
    { id: 2, type: "message", date: "2025-01-01T10:01:00", date_unixtime: "1735725660", from: "B", text: [{ type: "bold", text: "yo" }, " there"] },
  ] });
  assert.equal(tg.messages[1].text, "yo there");
  const ig = parseInstagram({ title: "IG", messages: [
    { sender_name: "Ana", timestamp_ms: 2000, content: "cafÃ©" },
    { sender_name: "Ben", timestamp_ms: 1000, photos: [{}] },
  ] });
  assert.equal(ig.messages[0].type, "media");
  assert.equal(ig.messages[1].text, "café");
});

test("stats, badges, transcript and anonymiser on the sample", () => {
  const chat = parseWhatsApp(SAMPLE_CHAT_TEXT, "Goa");
  const s = computeStats(chat);
  assert.ok(s.people[0].messages >= s.people[1].messages);
  assert.ok(s.badges.find((b) => b.id === "yapper"));
  assert.equal(s.badges.find((b) => b.id === "deleter").winner, "Kabir");
  assert.equal(s.badges.find((b) => b.id === "memes").winner, "Rohan");
  const anon = makeNameMap(s.people);
  const t = buildTranscript(chat, s, { anon });
  assert.ok(!/Meera|Kabir|Zoya|Aarav|Rohan/i.test(t), "names leaked into transcript");
  assert.match(t, /Suspect A/);
  const ai = statsForAi(s, anon.name);
  assert.ok(!JSON.stringify(ai).includes("Meera"));
  const back = restoreDeep({ x: ["Suspect A likes Suspect B"] }, anon.restore);
  assert.equal(back.x[0], `${s.people[0].name} likes ${s.people[1].name}`);
});

test("one-on-one interest meter", () => {
  const s = computeStats(parseWhatsApp(IOS));
  assert.ok(s.interest && s.interest.aScore + s.interest.bScore === 100);
});

test("iPhone system lines, calls and photo captions", () => {
  const raw = [
    "[27/10/26, 9:15:13 PM] Gang 🌿: ‎You created group “GANG”",
    "‎[27/10/26, 9:15:13 PM] Ravi: ‎sticker omitted",
    "[27/10/26, 9:16:00 PM] Ravi: ‎Video call, ‎‎2 min • ‎3 joined",
    "[27/10/26, 9:17:00 PM] Mira: Look at this image omitted",
    "[27/10/26, 9:18:00 PM] Mira: ‎Location: https://maps.google.com/?q=1,2",
    "[27/10/26, 9:19:00 PM] Ravi: POLL:\nAdd her?\nOPTION: Yes (2 votes)",
  ].join("\n");
  const r = parseWhatsApp(raw);
  assert.deepEqual(r.messages.map((m) => m.type), ["system", "media", "call", "text", "media", "text"]);
  assert.equal(r.messages[0].author, null);
  assert.equal(r.messages[3].text, "Look at this");
  const s = computeStats(r);
  assert.ok(!s.people.find((p) => p.name.includes("Gang")));
});
