// Promo codes, free-tier limits and Razorpay payments.
import crypto from "node:crypto";
import { config } from "./config.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function isValidPromo(code) {
  if (typeof code !== "string") return false;
  const c = code.trim();
  if (!c || c.length > 64) return false;
  const h = sha256(c);
  return config.promoHashes.some((x) => safeEqual(x, h)) || config.promoCodesPlain.some((x) => safeEqual(x, c));
}

// ---- simple in-memory counters (reset when the server restarts) ----
const today = () => new Date().toISOString().slice(0, 10);
const freeUses = new Map(); // ip -> { day, count }
const promoTries = new Map(); // ip -> { hour, count }

export function freeUsesLeft(ip) {
  const rec = freeUses.get(ip);
  const used = rec && rec.day === today() ? rec.count : 0;
  return Math.max(0, config.freeDailyLimit - used);
}
export function recordFreeUse(ip) {
  const rec = freeUses.get(ip);
  if (rec && rec.day === today()) rec.count++;
  else freeUses.set(ip, { day: today(), count: 1 });
}

export function promoAttemptAllowed(ip) {
  const hour = new Date().toISOString().slice(0, 13);
  const rec = promoTries.get(ip);
  if (!rec || rec.hour !== hour) {
    promoTries.set(ip, { hour, count: 1 });
    return true;
  }
  rec.count++;
  return rec.count <= 12;
}

// ---- Razorpay ----
const usedOrders = new Set();

export async function createOrder() {
  if (!config.razorpayEnabled) throw Object.assign(new Error("Payments are not set up yet."), { status: 400 });
  const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(config.priceInr * 100), // paise
      currency: "INR",
      receipt: "case_" + crypto.randomBytes(6).toString("hex"),
      notes: { product: "chat roast" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.description || "Could not create the payment."), { status: 502 });
  return { orderId: data.id, amount: data.amount, currency: data.currency, keyId: config.razorpayKeyId };
}

export function verifyPayment(p) {
  if (!config.razorpayEnabled || !p) return false;
  const { orderId, paymentId, signature } = p;
  if (![orderId, paymentId, signature].every((x) => typeof x === "string" && x.length < 200)) return false;
  if (usedOrders.has(orderId)) return false;
  const expected = crypto.createHmac("sha256", config.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}
export function markOrderUsed(orderId) {
  usedOrders.add(orderId);
}

// Decide whether this request may run the AI roast.
// Returns { ok, reason, kind } where kind is "promo" | "paid" | "free".
export function checkAccess({ ip, promo, payment }) {
  if (promo && isValidPromo(promo)) return { ok: true, kind: "promo" };
  if (config.accessMode === "paid") {
    if (verifyPayment(payment)) return { ok: true, kind: "paid" };
    return { ok: false, status: 402, reason: `This roast costs ₹${config.priceInr}. Pay or use a promo code.` };
  }
  if (config.accessMode === "promo_only") {
    return { ok: false, status: 403, reason: "Right now the roast is invite-only. Enter a promo code." };
  }
  if (freeUsesLeft(ip) <= 0) {
    return { ok: false, status: 429, reason: "You've used today's free roasts. Come back tomorrow or use a promo code." };
  }
  return { ok: true, kind: "free" };
}
