import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCaseJson, coerceCase, repairJson } from "../public/js/casefile.js";
import { renderCase, renderStats } from "../public/js/report.js";
import { parseFiles, parseWhatsApp } from "../public/js/parser.js";
import { computeStats } from "../public/js/stats.js";
import { SAMPLE_CHAT_TEXT, SAMPLE_CASE } from "../public/js/sample.js";
import { buildAskerBlock } from "../server/prompt.js";

const chat = parseFiles([{ name: "WhatsApp Chat with Goa.txt", text: SAMPLE_CHAT_TEXT }]);
const stats = computeStats(chat);

test("rescues a reply that was cut off mid-way", () => {
  const full = JSON.stringify(SAMPLE_CASE);
  for (const cut of [200, 1500, 4000, full.length - 30]) {
    const cf = coerceCase(parseCaseJson(full.slice(0, cut)));
    assert.ok(cf.case_title.length > 0, `cut at ${cut}`);
  }
  assert.equal(repairJson('{"a": [1, 2, {"b": "x'), '{"a": [1, 2]}');
});

test("finds JSON inside fences and chatter, rejects garbage", () => {
  assert.equal(parseCaseJson('Sure!\n```json\n{"case_title":"X"}\n```').case_title, "X");
  assert.equal(parseCaseJson('Here you go: {"case_title":"Y"} hope that helps').case_title, "Y");
  assert.throws(() => parseCaseJson("no json at all"), (e) => e.code === "invalid_json");
  assert.throws(() => coerceCase({}), (e) => e.code === "invalid_json");
});

test("wrong shapes never crash the report", () => {
  const messy = {
    case_title: "Messy",
    chaos_level: "87%",
    minors_suspected: "false",
    relationship_mix: "lots of friends",
    suspects: [
      { name: "Meera", charges: "being too nice", traits: null, evidence: "#3", receipts: { msg_id: 42, translation: 5 } },
      { name: "", role: "ghost" },
      "Aarav",
    ],
    pairs: { a: "Meera", b: "Aarav", type: "Best Friends", warmth: "high" },
    unsaid: "everyone knows",
    focus_report: { title: "Fights", items: [{ title: "One", evidence: "#4" }] },
    share_lines: "one line",
  };
  const cf = coerceCase(messy);
  assert.equal(cf.chaos_level, 87);
  assert.equal(cf.minors_suspected, false);
  assert.deepEqual(cf.suspects[0].charges, ["being too nice"]);
  assert.equal(cf.suspects.length, 1, "nameless suspects dropped");
  assert.equal(cf.pairs[0].type, "besties", "unknown enum falls back");
  const html = renderCase(cf, stats, { chat });
  assert.match(html, /Messy/);
  assert.match(html, /wow ok so we change dates/, "receipt looked up from the chat by id");
});

test("receipts show real messages, replies and only useful translations", () => {
  const cf = coerceCase(SAMPLE_CASE);
  cf.suspects[0].receipts = [{ msg_id: "#42", translation: "Wow, okay, so we change dates for Zoya instantly", reply_id: "#999", reply_translation: "x", note: "n" }];
  const html = renderCase(cf, stats, { chat, me: "Meera" });
  assert.match(html, /🧾 Receipts/);
  assert.match(html, /Rohan replied/, "bad reply id falls back to the next reply");
  assert.match(html, /English<\/span> Wow, okay/, "translation shown when it differs");
  assert.match(html, /📍 YOU/);
  const same = coerceCase(SAMPLE_CASE);
  assert.doesNotMatch(renderCase(same, stats, { chat }), /r-en/, "no translation when identical to the original");
});

test("renders without a chat and with an empty case", () => {
  assert.ok(renderCase(coerceCase(SAMPLE_CASE), stats).length > 1000);
  assert.ok(renderCase(coerceCase({ case_title: "Only a title" }), stats).includes("Only a title"));
  assert.ok(renderStats(stats).length > 1000);
});

test("asker block", () => {
  assert.equal(buildAskerBlock({}), "");
  assert.match(buildAskerBlock({ me: "Suspect B" }), /uploaded this chat is Suspect B/);
  assert.match(buildAskerBlock({ outsider: true, note: "Sara is my crush" }), /outsider[\s\S]*<uploader_note>/);
});

test("Android system lines are not people", () => {
  const r = parseWhatsApp([
    "12/03/2026, 21:14 - Meera: hi",
    "12/03/2026, 21:15 - Meera changed the subject from \"a\" to \"b: c\"",
    "12/03/2026, 21:16 - Kabir added Zoya Khan: welcome",
    "12/03/2026, 21:17 - Zoya: hello",
  ].join("\n"));
  assert.deepEqual(r.messages.map((m) => m.author), ["Meera", null, null, "Zoya"]);
});


test("incident reports: beats, real messages, translations and the whole conversation", () => {
  const cf = coerceCase(SAMPLE_CASE);
  const html = renderCase(cf, stats, { chat });
  assert.match(html, /id="incidents"/);
  assert.match(html, /The Great Date Incident/);
  assert.match(html, /How it started/);
  assert.match(html, /The hottest moment/);
  assert.match(html, /What ended it/);
  assert.match(html, /so we change dates for zoya instantly/, "the real message is looked up by id");
  assert.match(html, /Read the whole conversation <small>\(6 messages\)/, "all six messages between #40 and #45");
  assert.match(html, /class="cv-line hot"/);
});

test("incidents survive bad ids, odd shapes and long conversations", () => {
  const bad = coerceCase({ case_title: "x", incidents: [
    { name: "No ids", kind: "Big Fight", heat: "90%", outcome: "who knows", people: "Meera", start_id: "nonsense", end_id: "#9999" },
    "just a string",
    { name: "Backwards", start_id: "#50", end_id: "#10", hot_id: "#20" },
    { name: "Long", start_id: "#3", hot_id: "#50", end_id: "#94" },
  ] });
  assert.equal(bad.incidents[0].kind, "fight");
  assert.equal(bad.incidents[0].heat, 90);
  const html = renderCase(bad, stats, { chat });
  assert.match(html, /No ids/);
  assert.doesNotMatch(html.split("Backwards")[1].split("</article>")[0], /Read the whole conversation/, "end before start gives no conversation");
  const longPart = html.split("Long")[html.split("Long").length - 1].split("</article>")[0];
  assert.match(longPart, /Read the whole conversation <small>\(\d+ messages\)/);
  assert.match(longPart, /more messages/, "a long incident is trimmed around the peak");
  assert.ok(renderCase(bad, stats).includes("No ids"), "renders with no chat at all");
});

test("an incident can cite a context chat by its prefixed ids", () => {
  const cf = coerceCase({ case_title: "x", incidents: [{ name: "Elsewhere", start_id: "B#2", hot_id: "B#3", end_id: "B#4", kind: "drama" }] });
  const other = parseFiles([{ name: "WhatsApp Chat with Goa.txt", text: SAMPLE_CHAT_TEXT }]);
  const html = renderCase(cf, stats, { chats: { "": chat, B: other } });
  assert.match(html, /B#\d+ ·/);
});
