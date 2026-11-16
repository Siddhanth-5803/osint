// FBI, OPEN UP! web server: serves the site and the small API.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config, ROOT } from "./config.js";
import { analyzeChat, AnalysisError } from "./analyze.js";
import { PERSONAS, SPICE } from "./prompt.js";
import {
  checkAccess, createOrder, freeUsesLeft, isValidPromo, markOrderUsed, promoAttemptAllowed, recordFreeUse,
} from "./payments.js";

const PUBLIC = path.join(ROOT, "public");
const MAX_BODY = 3 * 1024 * 1024;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8",
};

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" && fwd.split(",")[0].trim()) || req.socket.remoteAddress || "unknown";
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    "Content-Type": isJson ? "application/json; charset=utf-8" : headers["Content-Type"] || "text/plain",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("That chat is too big to send. Try a shorter export."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Bad request body."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function publicConfig(ip) {
  return {
    accessMode: config.accessMode,
    priceInr: config.priceInr,
    freeDailyLimit: config.freeDailyLimit,
    freeUsesLeft: freeUsesLeft(ip),
    razorpayEnabled: config.razorpayEnabled,
    aiReady: config.anthropicKeySet || config.mockAi || Boolean(config.mockAiFile),
    mockAi: config.mockAi,
    personas: Object.fromEntries(Object.entries(PERSONAS).map(([k, v]) => [k, v.label])),
  };
}

async function handleApi(req, res, url) {
  const ip = clientIp(req);

  if (req.method === "GET" && url.pathname === "/api/config") return send(res, 200, publicConfig(ip));

  if (req.method === "POST" && url.pathname === "/api/promo") {
    if (!promoAttemptAllowed(ip)) return send(res, 429, { error: "Too many tries. Wait an hour." });
    const { code } = await readJson(req);
    return send(res, 200, { valid: isValidPromo(code) });
  }

  if (req.method === "POST" && url.pathname === "/api/pay/order") {
    if (config.accessMode !== "paid") return send(res, 400, { error: "Payments are switched off. The roast is free right now." });
    return send(res, 200, await createOrder());
  }

  if (req.method === "POST" && url.pathname === "/api/analyze") {
    const body = await readJson(req);
    const { stats, transcript, persona = "sherlock", spice = "spicy", promo, payment } = body;
    if (!stats || typeof stats !== "object" || typeof transcript !== "string" || transcript.length < 20) {
      return send(res, 400, { error: "No chat found in the request." });
    }
    if (transcript.length > 450_000) return send(res, 413, { error: "Transcript sample is too large." });
    if (!PERSONAS[persona] || !SPICE[spice]) {
      return send(res, 400, { error: "Unknown persona or spice level." });
    }
    if (promo && !promoAttemptAllowed(ip)) return send(res, 429, { error: "Too many promo tries. Wait an hour." });

    const access = checkAccess({ ip, promo, payment });
    if (!access.ok) return send(res, access.status, { error: access.reason, needs: config.accessMode });

    const result = await analyzeChat({ stats, transcript, persona, spice });
    if (access.kind === "free") recordFreeUse(ip);
    if (access.kind === "paid") markOrderUsed(payment.orderId);
    console.log(`[raid] ${new Date().toISOString()} kind=${access.kind} model=${result.model} in=${result.usage?.input_tokens ?? "-"} out=${result.usage?.output_tokens ?? "-"}`);
    return send(res, 200, { caseFile: result.caseFile, freeUsesLeft: freeUsesLeft(ip) });
  }

  return send(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, "Forbidden");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found");
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": path.extname(file) === ".html" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return serveStatic(req, res, url);
  } catch (err) {
    const status = err instanceof AnalysisError || err.status ? err.status || 500 : 500;
    if (status >= 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: err.message || "Something broke. Try again." });
  }
});

server.listen(config.port, () => {
  console.log(`\n🚨 FBI, OPEN UP! is running at http://localhost:${config.port}`);
  console.log(`   access mode: ${config.accessMode} · price: ₹${config.priceInr} · model: ${config.mockAi ? "MOCK" : config.model}`);
  if (!config.anthropicKeySet && !config.mockAi) console.log("   ⚠ No ANTHROPIC_API_KEY set: free stats work, the AI roast will not.");
  if (config.accessMode === "paid" && !config.razorpayEnabled) console.log("   ⚠ ACCESS_MODE=paid but Razorpay keys are missing.");
});
