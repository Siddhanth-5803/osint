import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUploads, addToBag, pickMain, analysePeople, autoAlias, prepareEvidence, planBudget, NOT_SAME, MAX_CONTEXT } from "../public/js/evidence.js";
import { SAMPLE_CHAT_TEXT } from "../public/js/sample.js";
import { buildUserMessage, buildSystemPrompt } from "../server/prompt.js";
import { renderCase } from "../public/js/report.js";
import { coerceCase } from "../public/js/casefile.js";
import { SAMPLE_CASE } from "../public/js/sample.js";

// An Instagram export for some of the same people, under slightly different names.
const igMessages = [];
const names = ["Meera Shah", "Aarav", "Zoya K"];
for (let i = 0; i < 30; i++) igMessages.push({ sender_name: names[i % 3], timestamp_ms: 1767000000000 + i * 90_000, content: `ig message ${i} from ${names[i % 3]}` });
const ig = JSON.stringify({ title: "Aarav and Zoya", messages: igMessages });
const igPart2 = JSON.stringify({ title: "Aarav and Zoya", messages: igMessages.slice(0, 5).map((m, i) => ({ ...m, timestamp_ms: m.timestamp_ms + 9e6 + i, content: "part two " + i })) });
const tg = JSON.stringify({ name: "Study group", messages: Array.from({ length: 20 }, (_, i) => ({ id: i, type: "message", date_unixtime: String(1767100000 + i * 60), from: i % 2 ? "Kabir" : "Rohan", text: "tg hello " + i })) });

const groups = (list) => list.map(([label, name, text]) => ({ label, files: [{ name, text }] }));
const bagOf = () => {
  const { items, errors } = parseUploads(groups([
    ["WhatsApp Chat with Goa.txt", "WhatsApp Chat with Goa.txt", SAMPLE_CHAT_TEXT],
    ["message_1.json", "message_1.json", ig],
    ["message_2.json", "message_2.json", igPart2],
    ["result.json", "result.json", tg],
    ["notes.txt", "notes.txt", "not a chat"],
    ["tiny.txt", "tiny.txt", "12/03/2026, 21:14 - A: hi\n12/03/2026, 21:15 - B: yo"],
  ]));
  return { items, errors };
};

test("several uploads become several chats, bad ones are explained", () => {
  const { items, errors } = bagOf();
  assert.deepEqual(items.map((i) => i.chat.source).sort(), ["instagram", "telegram", "whatsapp"]);
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => /notes\.txt/.test(e)) && errors.some((e) => /too small/.test(e)));
  const insta = items.find((i) => i.chat.source === "instagram");
  assert.equal(insta.stats.totalMessages, 35, "split Instagram files are merged");
});

test("biggest chat is the default main; bag has a size limit and no duplicates", () => {
  const { items } = bagOf();
  assert.equal(items.find((i) => i.id === pickMain(items)).chat.source, "whatsapp");
  const { bag, notes } = addToBag(items, items);
  assert.equal(bag.length, 3);
  assert.equal(notes.length, 3);
  const many = [...items, ...Array.from({ length: MAX_CONTEXT + 3 }, (_, k) => k + 1).map((n) => ({ ...items[0], id: "x" + n, stats: { ...items[0].stats, totalMessages: 1000 + n }, chat: { ...items[0].chat, title: "t" + n } }))];
  const capped = addToBag([], many);
  assert.equal(capped.bag.length, MAX_CONTEXT + 1);
});

test("same person on another app is matched, others stay separate", () => {
  const { items } = bagOf();
  const main = items.find((i) => i.chat.source === "whatsapp");
  const { aliases, auto, unmatched } = analysePeople(items, main.id);
  assert.equal(aliases["Meera Shah"], "Meera");
  assert.equal(aliases["Zoya K"], "Zoya");
  assert.ok(auto.length >= 2);
  assert.ok(unmatched.some((u) => u.name === "Kabir") === false, "Kabir exists in the main chat too");
  assert.equal(autoAlias("Rudy", ["Rudrayan", "Aditi"]), null);
  assert.equal(autoAlias("rudrayan das", ["Rudrayan", "Aditi"]), "Rudrayan");
  // the viewer's choice wins, and "not the same" blocks a match
  assert.equal(analysePeople(items, main.id, { "Zoya K": NOT_SAME }).aliases["Zoya K"], undefined);
  assert.equal(analysePeople(items, main.id, { "Zoya K": "Rohan" }).aliases["Zoya K"], "Rohan");
});

test("names are hidden in every chat and title; same person, same code; ids are prefixed", () => {
  const { items } = bagOf();
  const main = items.find((i) => i.chat.source === "whatsapp");
  const ev = prepareEvidence({ bag: items, mainId: main.id, hide: true, budget: 60_000 });
  const all = JSON.stringify(ev.mainStats) + ev.mainTranscript + JSON.stringify(ev.contexts);
  for (const n of ["Meera", "Aarav", "Zoya", "Kabir", "Rohan", "Aarav and Zoya"]) assert.ok(!all.includes(n), `${n} leaked`);
  assert.equal(ev.contexts.length, 2);
  assert.deepEqual(ev.contexts.map((c) => c.label), ["B", "C"]);
  const insta = ev.contexts.find((c) => c.source === "instagram");
  assert.match(insta.transcript, /B#1 /);
  const meeraCode = ev.anon.name("Meera");
  assert.ok(insta.transcript.includes(meeraCode), "Instagram 'Meera Shah' uses Meera's code");
  assert.equal(ev.anon.name("Meera Shah"), meeraCode);
  assert.ok(/^#\d+ /m.test(ev.mainTranscript) && !/^[A-Z]#/m.test(ev.mainTranscript));
  const shown = ev.contexts.map((c) => c.transcript.length).reduce((a, b) => a + b, 0) + ev.mainTranscript.length;
  assert.ok(shown <= 60_000 + 3000, "stays inside the budget");
});

test("names inside the word lists are masked too", () => {
  const { items } = bagOf();
  const main = items.find((i) => i.chat.source === "whatsapp");
  main.stats.topWords = [{ w: "meera", c: 9 }, { w: "goa", c: 4 }];
  main.stats.people[0].topWords = ["meera", "goa"];
  const ev = prepareEvidence({ bag: items, mainId: main.id, hide: true, budget: 20_000 });
  assert.ok(!JSON.stringify(ev.mainStats).toLowerCase().includes("meera"));
});

test("without hiding, real names are kept", () => {
  const { items } = bagOf();
  const ev = prepareEvidence({ bag: items, mainId: pickMain(items), hide: false, budget: 40_000 });
  assert.ok(ev.mainTranscript.includes("Meera") && ev.anon === null);
});

test("budget plan and prompt blocks", () => {
  assert.deepEqual(planBudget(100_000, 0), { main: 100_000, each: 0 });
  const p2 = planBudget(100_000, 2);
  assert.ok(p2.main + p2.each * 2 <= 100_000 && p2.main > p2.each * 2);
  const msg = buildUserMessage({ stats: { a: 1 }, transcript: "#1 x", contexts: [{ label: "B", source: 'insta"gram', title: "a<b>c", stats: { z: 1 }, transcript: "B#1 y" }] });
  assert.match(msg, /<context_chat id="B" source="instagram" kind="private" title="abc">/);
  assert.match(msg, /<context_transcript>\nB#1 y/);
  assert.match(buildSystemPrompt({ persona: "sherlock", spice: "spicy", hasContext: true }), /CONTEXT CHATS/);
  assert.doesNotMatch(buildSystemPrompt({ persona: "sherlock", spice: "spicy" }), /CONTEXT CHATS/);
});

test("a context-style id never pulls a message from the main chat", () => {
  const { items } = bagOf();
  const main = items.find((i) => i.chat.source === "whatsapp");
  const cf = coerceCase(SAMPLE_CASE);
  cf.suspects[0].receipts = [{ msg_id: "B#42", translation: "", reply_id: "", reply_translation: "", note: "context id" }];
  const html = renderCase(cf, main.stats, { chat: main.chat });
  assert.doesNotMatch(html, /context id/, "prefixed ids are ignored by receipts");
});

test("any chat can be the main one: the biggest by default; private chats are marked", () => {
  const { items } = bagOf();
  const group = items.find((i) => i.chat.source === "whatsapp");
  const dm = { ...items.find((i) => i.chat.source === "instagram"), id: "dm" };
  dm.stats = { ...dm.stats, totalMessages: 99999, people: dm.stats.people.slice(0, 2) };
  assert.equal(pickMain([dm, group]), "dm", "a private chat can be the main chat");
  assert.equal(pickMain([group]), group.id);
  assert.equal(pickMain([dm]), "dm");
  const ev = prepareEvidence({ bag: [group, dm], mainId: group.id, hide: true, budget: 30_000 });
  const ev2 = prepareEvidence({ bag: [group, dm], mainId: "dm", hide: true, budget: 30_000 });
  assert.equal(ev2.contexts[0].kind, "group", "and a group can be context for it");
  assert.equal(ev.contexts[0].kind, "private");
  const msg = buildUserMessage({ stats: {}, transcript: "#1 x", contexts: ev.contexts });
  assert.match(msg, /kind="private"/);
  assert.match(buildSystemPrompt({ persona: "sherlock", spice: "spicy", hasContext: true }), /kind="private"/);
});

test("a group plus a private chat with each friend fits in one bag", () => {
  const { items } = bagOf();
  const group = items.find((i) => i.chat.source === "whatsapp");
  const dms = Array.from({ length: MAX_CONTEXT }, (_, k) => ({ ...items[1], id: "d" + k, stats: { ...items[1].stats, totalMessages: 100 + k, people: items[1].stats.people.slice(0, 2) }, chat: { ...items[1].chat, title: "DM " + k } }));
  const { bag } = addToBag([group], dms);
  assert.equal(bag.length, MAX_CONTEXT + 1);
  const ev = prepareEvidence({ bag, mainId: group.id, hide: true, budget: 100_000 });
  assert.equal(ev.contexts.length, MAX_CONTEXT);
  assert.equal(new Set(ev.contexts.map((c) => c.label)).size, MAX_CONTEXT);
  const total = ev.mainTranscript.length + ev.contexts.reduce((n, c) => n + c.transcript.length, 0);
  assert.ok(total < 100_000 + 8000, "total stays near the budget");
  const plan = planBudget(100_000, MAX_CONTEXT);
  assert.ok(plan.main >= 50_000 && plan.each > 3_000, "the main chat keeps at least half and each private chat still gets a useful slice");
});

test("read everything: nothing is dropped when it fits, and coverage says so", () => {
  const { items } = bagOf();
  const ev = prepareEvidence({ bag: items, mainId: pickMain(items), hide: true, budget: 500_000, all: true });
  assert.equal(ev.fullyRead, true);
  assert.ok(ev.coverage.every((c) => c.pct === 100 && c.included === c.total));
  assert.ok(!/messages skipped/.test(ev.mainTranscript + ev.contexts.map((c) => c.transcript).join("")));
  assert.match(ev.mainTranscript, /^--- \d{4}-\d{2}-\d{2} ---$/m);
  assert.match(ev.mainTranscript, /^#\d+ \d{2}:\d{2} Suspect [A-Z]: /m);
});

test("when everything cannot fit, every chat shrinks fairly and the report says how much was read", () => {
  const { items } = bagOf();
  const ev = prepareEvidence({ bag: items, mainId: pickMain(items), hide: true, budget: 3_500, all: true });
  assert.equal(ev.fullyRead, false);
  assert.ok(ev.coverage.some((c) => c.pct < 100));
  const total = ev.mainTranscript.length + ev.contexts.reduce((n, c) => n + c.transcript.length, 0);
  assert.ok(total < 3_500 + 3_000 * 3 + 600, "stays near the budget");
  assert.ok(/messages skipped/.test(ev.mainTranscript + ev.contexts.map((c) => c.transcript).join("")));
});

test("media runs collapse and receipts can come from a context chat", async () => {
  const { buildTranscriptEx } = await import("../public/js/stats.js");
  const { parseWhatsApp } = await import("../public/js/parser.js");
  const chat = parseWhatsApp(["12/03/2026, 21:14 - A: hi there", "12/03/2026, 21:15 - A: <Media omitted>", "12/03/2026, 21:15 - A: <Media omitted>", "12/03/2026, 21:16 - A: <Media omitted>", "12/03/2026, 21:17 - B: wow"].join("\n"));
  const t = buildTranscriptEx(chat, { spikes: [] }, { all: true, budget: 1e6 });
  assert.match(t.text, /<media x3>/);
  assert.equal(t.included, 5, "all five messages are counted as read");
  const { items } = bagOf();
  const main = items.find((i) => i.chat.source === "whatsapp");
  const insta = items.find((i) => i.chat.source === "instagram");
  const cf = coerceCase(SAMPLE_CASE);
  cf.suspects[0].receipts = [{ msg_id: "B#5", translation: "", reply_id: "", reply_translation: "", note: "from the other app" }];
  const html = renderCase(cf, main.stats, { chats: { "": main.chat, B: insta.chat } });
  assert.match(html, /B#5 · /);
  assert.match(html, /in Aarav and Zoya/);
});
