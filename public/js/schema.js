// The case file format: what Claude must return and what the page renders.
// Shared by the server, the one-click page and the tests.
const str = { type: "string" };
const int = { type: "integer" };
const conf = { type: "string", enum: ["low", "medium", "high"] };
const strArr = { type: "array", items: str };
const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const CASE_SCHEMA = obj({
  case_title: str,
  chat_type: { type: "string", enum: ["one_on_one", "group"] },
  classification: str,
  raid_summary: str,
  one_liner: str,
  chaos_level: int,
  chaos_label: str,
  survival_odds: int,
  survival_reason: str,
  group_purpose: str,
  relationship_mix: obj({ friends: int, crush: int, lovers: int, situationship: int, rivalry: int, family: int, work: int }),
  minors_suspected: { type: "boolean" },
  safety_note: str,
  suspects: {
    type: "array",
    items: obj({
      name: str,
      role: str,
      role_emoji: str,
      charges: strArr,
      mugshot_caption: str,
      what_they_type: str,
      what_they_mean: str,
      inner_monologue: str,
      tell: str,
      roast: str,
      redeeming_quality: str,
      texting_style: str,
      traits: obj({ chaos: int, loyalty: int, drama: int, braincells: int, rizz: int }),
      evidence: strArr,
      confidence: conf,
      receipts: {
        type: "array",
        items: obj({ msg_id: str, translation: str, reply_id: str, reply_translation: str, note: str }),
      },
    }),
  },
  pairs: {
    type: "array",
    items: obj({
      a: str,
      b: str,
      label: str,
      type: {
        type: "string",
        enum: ["besties", "crush", "couple", "situationship", "rivals", "frenemies", "siblings_energy", "hype_duo", "parent_child", "work_spouse", "strangers"],
      },
      warmth: int,
      tension: int,
      who_invests_more: str,
      summary: str,
      evidence: strArr,
      confidence: conf,
    }),
  },
  unsaid: { type: "array", items: obj({ finding: str, evidence: strArr, confidence: conf }) },
  awards: { type: "array", items: obj({ title: str, emoji: str, winner: str, reason: str }) },
  exhibits: { type: "array", items: obj({ msg_id: str, speaker: str, quote: str, why: str }) },
  timeline: { type: "array", items: obj({ date: str, title: str, what_happened: str }) },
  fix_it: { type: "array", items: obj({ problem: str, fix: str, for_whom: str }) },
  focus_report: obj({
    title: str,
    intro: str,
    items: { type: "array", items: obj({ title: str, body: str, verdict: str, evidence: strArr }) },
  }),
  final_verdict: str,
  share_lines: strArr,
});
