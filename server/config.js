// All settings come from environment variables (or a local .env file).
// See .env.example for the full list with explanations.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");

// Tiny .env loader so `npm start` works without extra tools.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const env = process.env;
const num = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);

// SHA-256 of the built-in promo code, so the code itself is not stored in the repo.
const BUILT_IN_PROMO_HASHES = [
  "ec66f125239caf5ba104191862927965c0758569a20adc63eec8fc3d1661b0d6",
];

export const config = {
  port: num(env.PORT, 3000),

  // Claude
  anthropicKeySet: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
  model: env.CLAUDE_MODEL || "claude-opus-5-5",
  effort: env.CLAUDE_EFFORT || "medium",

  // Access and payments
  // free       = anyone can run the AI roast, limited per IP per day (promo holders unlimited)
  // promo_only = only people with a promo code can run the AI roast
  // paid       = PRICE_INR per roast through Razorpay, promo holders free
  accessMode: ["free", "promo_only", "paid"].includes(env.ACCESS_MODE) ? env.ACCESS_MODE : "free",
  priceInr: num(env.PRICE_INR, 5),
  freeDailyLimit: num(env.FREE_DAILY_LIMIT, 5),
  promoHashes: [
    ...BUILT_IN_PROMO_HASHES,
    ...(env.PROMO_CODE_HASHES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  ],
  promoCodesPlain: (env.PROMO_CODES || "").split(",").map((s) => s.trim()).filter(Boolean),

  razorpayKeyId: env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET || "",

  // Testing only: return a canned roast instead of calling Claude.
  mockAi: env.MOCK_AI === "1",
  // Testing only: return this saved case-file JSON instead of calling Claude.
  mockAiFile: env.MOCK_AI_FILE || "",
};

config.razorpayEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret);
