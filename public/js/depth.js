// Investigation depth: which Claude model does the analysis.
export const DEPTHS = {
  quick: { emoji: "🔍", label: "Quick Peek", model: "claude-haiku-5-5", tier: "quick", desc: "Fastest. A lighter read of the chat." },
  standard: { emoji: "🕵️", label: "Stakeout", model: "claude-sonnet-5-5", tier: "default", desc: "Balanced. Sharp roasts, good speed." },
  deep: { emoji: "🧬", label: "Full Forensics", model: "claude-opus-5-5", tier: "complex", desc: "Deepest analysis. Slowest, can take a couple of minutes." },
};
export const DEFAULT_DEPTH = "standard";
