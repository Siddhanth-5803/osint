// Calls Claude and returns the parsed case file.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { buildSystemPrompt, buildUserMessage, buildAskerBlock, CASE_SCHEMA } from "./prompt.js";

let client = null;
const getClient = () => (client ??= new Anthropic());

// Models that accept the server-side refusal fallback parameter.
const supportsFallbacks = (model) => /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);

export class AnalysisError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function analyzeChat({ stats, transcript, persona, spice, depth = "standard", asker = {}, contexts = [] }) {
  const model = config.depthModels[depth] || config.depthModels.standard;
  if (config.mockAiFile) return { caseFile: JSON.parse(fs.readFileSync(config.mockAiFile, "utf8")), model: "mock-file" };
  if (config.mockAi) return mockCase(stats);
  if (!config.anthropicKeySet) {
    throw new AnalysisError("The server has no Anthropic API key yet. Add ANTHROPIC_API_KEY to .env and restart.", 503);
  }

  const params = {
    model,
    max_tokens: 16000,
    system: [buildSystemPrompt({ persona, spice, hasContext: contexts.length > 0 }), buildAskerBlock(asker)].filter(Boolean).join("\n\n"),
    messages: [{ role: "user", content: buildUserMessage({ stats, transcript, contexts }) }],
    output_config: { effort: config.effort, format: { type: "json_schema", schema: CASE_SCHEMA } },
  };
  if (supportsFallbacks(model)) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }

  let response;
  try {
    try {
      response = await getClient().beta.messages.create(params);
    } catch (err) {
      // If the account or model rejects the fallback beta, retry once without it.
      if (!(err instanceof Anthropic.BadRequestError) || !params.fallbacks) throw err;
      const { betas, fallbacks, ...plain } = params;
      response = await getClient().messages.create(plain);
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AnalysisError("The Anthropic API key is invalid. Check ANTHROPIC_API_KEY.", 503);
    if (err instanceof Anthropic.RateLimitError) throw new AnalysisError("Too many raids at once. Try again in a minute.", 429);
    if (err instanceof Anthropic.BadRequestError) throw new AnalysisError("The AI rejected the request: " + err.message, 400);
    if (err instanceof Anthropic.APIError) throw new AnalysisError(`The AI service had a problem (${err.status}). Try again.`, 502);
    if (err instanceof Anthropic.APIConnectionError) throw new AnalysisError("Could not reach the AI service. Check the internet connection.", 502);
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new AnalysisError("The AI declined to analyse this chat. The free stats report still works.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AnalysisError("The case file came out too long. Try again, or pick a smaller chat.", 502);
  }

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    const data = JSON.parse(text);
    return { caseFile: data, model: response.model, usage: response.usage };
  } catch {
    throw new AnalysisError("The AI returned something unreadable. Try again.", 502);
  }
}

// Canned answer used when MOCK_AI=1, so the whole flow can be tested for free.
function mockCase(stats) {
  const people = (stats?.people || []).map((p) => p.name).slice(0, 12);
  const [a = "Suspect A", b = "Suspect B", c = "Suspect C"] = people;
  const roles = ["The Group Mom", "The Yapper", "The Lurker", "The Hype Man", "The Meme Dealer", "The Ghost"];
  const emojis = ["🧺", "📢", "👀", "📣", "🐸", "👻"];
  return {
    model: "mock",
    caseFile: {
      case_title: "Operation Mock Raid",
      chat_type: people.length > 2 ? "group" : "one_on_one",
      classification: "test case: friends with suspicious levels of chaos",
      raid_summary: "This is a mock case file. The server is running with MOCK_AI=1, so no AI was called.",
      one_liner: `${a} holds this chat together with duct tape and voice notes.`,
      chaos_level: 72,
      chaos_label: "Controlled chaos",
      survival_odds: 81,
      survival_reason: "Nobody has left yet, which is honestly impressive.",
      group_purpose: "Memes, plans that never happen, and emotional support at 2 a.m.",
      relationship_mix: { friends: 60, crush: 15, lovers: 0, situationship: 5, rivalry: 10, family: 0, work: 10 },
      minors_suspected: false,
      safety_note: "",
      suspects: people.map((name, i) => ({
        name,
        role: roles[i % roles.length],
        role_emoji: emojis[i % emojis.length],
        charges: ["Leaving people on read", "Excessive use of 😭"],
        mugshot_caption: "Caught replying 'haha' without laughing.",
        what_they_type: "ok sure",
        what_they_mean: "Absolutely not, but fine.",
        inner_monologue: "Why does nobody answer my questions?",
        tell: "Replies in under a minute, then pretends to be busy.",
        roast: "Has the energy of a forwarded good-morning message.",
        redeeming_quality: "Always shows up when it matters.",
        texting_style: "Short bursts, too many emojis.",
        traits: { chaos: 40 + i * 7, loyalty: 80 - i * 5, drama: 30 + i * 9, braincells: 60, rizz: 20 + i * 11 },
        evidence: ["stat:messages"],
        confidence: "low",
        receipts: [{ msg_id: `#${3 + i}`, translation: "(mock translation)", reply_id: "", reply_translation: "", note: "Mock receipt." }],
      })),
      pairs: [
        { a, b, label: "Chaotic besties", type: "besties", warmth: 80, tension: 20, who_invests_more: a, summary: "They reply to each other faster than anyone else.", evidence: ["stat:pairs"], confidence: "low" },
        { a: b, b: c, label: "Polite strangers", type: "strangers", warmth: 30, tension: 10, who_invests_more: "even", summary: "They talk mostly through other people.", evidence: ["stat:pairs"], confidence: "low" },
      ],
      unsaid: [{ finding: "Everybody knows the plan is not happening.", evidence: ["stat:spikes"], confidence: "low" }],
      awards: [{ title: "Most likely to leave on read", emoji: "📭", winner: b, reason: "Mock evidence, real vibes." }],
      exhibits: [{ msg_id: "#1", speaker: a, quote: "guys??", why: "The opening of every conversation." }],
      timeline: [{ date: stats?.range?.from || "", title: "The chat begins", what_happened: "Nobody knew what was coming." }],
      fix_it: [{ problem: "One person starts every conversation.", fix: "Someone else start one this week.", for_whom: "everyone" }],
      focus_report: {
        title: "Mock Speciality Report",
        intro: "This section changes with the investigator you pick.",
        items: [{ title: `${a} vs ${b}`, body: "A mock fight about who booked nothing.", verdict: "Started by nobody. Won by the memes.", evidence: ["stat:pairs"] }],
      },
      incidents: [{
        name: "The Great Mock Skirmish", kind: "fight", chat: stats?.title || "Mock chat", date: stats?.range?.from || "",
        summary: "A mock incident to show the layout.", how_it_started: "It began with a mock message.", start_id: "#3", start_translation: "",
        hottest_moment: "It peaked a few messages later.", hot_id: "#5", hot_translation: "", what_ended_it: "Someone sent a sticker.", end_id: "#7", end_translation: "",
        people: [a, b], heat: 55, outcome: "fizzled_out", blame: [{ person: a, share: 50, why: "Mock." }, { person: b, share: 50, why: "Mock." }],
      }],
      villain_verdict: { has_villain: false, name: "", title: "", the_case: "Mock chat: the blame is shared.", the_defence: "", also_to_blame: `${a} and ${b}`, evidence: [], confidence: "low" },
      final_verdict: "Guilty of being a perfectly normal, slightly unhinged group chat.",
      share_lines: ["We got raided by the FBI.", `${a} is the group mom. Confirmed.`, "Chaos level: 72%"],
    },
  };
}
