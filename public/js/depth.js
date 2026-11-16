// Investigation depth: which Claude model does the analysis.
export const DEPTHS = {
  quick: { emoji: "🔍", label: "Quick Peek", model: "claude-haiku-5-5", tier: "quick", desc: "Fastest. A lighter read of the chat." },
  standard: { emoji: "🕵️", label: "Stakeout", model: "claude-sonnet-5-5", tier: "default", desc: "Balanced. Sharp roasts, good speed." },
  deep: { emoji: "🧬", label: "Full Forensics", model: "claude-opus-5-5", tier: "complex", desc: "Deepest analysis. Slowest, can take a couple of minutes." },
  secret: { emoji: "🗝️", label: "Top Secret", model: "claude-opus-5-5", tier: "complex", effort: "high", ownerOnly: true, desc: "Owner only. Opus at full effort reads the most messages and digs the deepest. Can take a few minutes." },
};
// How much of the chat each depth reads (characters) and how much it writes.
export const DEPTH_BUDGET = { quick: 90_000, standard: 150_000, deep: 150_000, secret: 210_000 };
export const DEPTH_HINT = {
  quick: "INVESTIGATION DEPTH: QUICK. Keep every list to the minimum count allowed and every text short.",
  standard: "INVESTIGATION DEPTH: STANDARD. Use the middle of every allowed range.",
  deep: "INVESTIGATION DEPTH: DEEP. Use the top of every allowed range and be as specific as the evidence allows.",
  secret: "INVESTIGATION DEPTH: TOP SECRET. Be exhaustive. Use the maximum of every allowed range, cite the most evidence, and look for patterns across the whole timeline.",
};
// Which depth a model tier corresponds to, for telling the viewer what actually ran.
export const TIER_DEPTH = { quick: "quick", default: "standard", complex: "deep" };
export const DEFAULT_DEPTH = "standard";
