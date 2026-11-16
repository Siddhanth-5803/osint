import { parseFiles } from "./parser.js";
import { computeStats, statsForAi, buildTranscript, makeNameMap, restoreDeep } from "./stats.js";
import { renderCase, renderStats, roastText, esc } from "./report.js";
import { makeShareCard, shareOrDownload } from "./share.js";
import { SAMPLE_CHAT_TEXT, SAMPLE_CASE, SAMPLE_TITLE } from "./sample.js";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem("fbi:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("fbi:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const PERSONA_INFO = {
  fbi: ["🕴️", "Agent Brandon", "Your assigned FBI agent. Has seen everything."],
  aunty: ["👵", "Sharma Aunty", "Saw your chat. Has notes. Beta, why?"],
  therapist: ["🛋️", "Dr. Overthink", "A tired therapist. Let's sit with that."],
  genz: ["💅", "Gen-Z Bestie", "Spills the tea. No crumbs."],
  nature: ["🦜", "Nature Doc", "Observes your group in the wild."],
};

const state = { config: null, chat: null, stats: null, caseFile: null, isSample: false, busy: false };

// ---------- helpers ----------
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
const settings = () => ({
  persona: document.querySelector('input[name="persona"]:checked')?.value || "fbi",
  spice: document.querySelector('input[name="spice"]:checked')?.value || "spicy",
  language: document.querySelector('input[name="lang"]:checked')?.value || "english",
  anon: $("#anon").checked,
});
function saveSettings() { store.set("settings", settings()); }

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

// ---------- landing setup ----------
function buildPersonas() {
  const saved = store.get("settings", {});
  $("#personas").innerHTML = Object.entries(PERSONA_INFO).map(([k, [emo, name, desc]]) => `
<div class="persona"><input type="radio" name="persona" id="pe-${k}" value="${k}" ${(saved.persona || "fbi") === k ? "checked" : ""}>
<label for="pe-${k}"><b>${emo}</b><span>${name}</span><small>${desc}</small></label></div>`).join("");
  if (saved.spice) { const el = document.querySelector(`input[name="spice"][value="${saved.spice}"]`); if (el) el.checked = true; }
  if (saved.language) { const el = document.querySelector(`input[name="lang"][value="${saved.language}"]`); if (el) el.checked = true; }
  if (typeof saved.anon === "boolean") $("#anon").checked = saved.anon;
  document.querySelectorAll('input[name="persona"],input[name="spice"],input[name="lang"],#anon').forEach((el) => el.addEventListener("change", saveSettings));
}

function priceLabel() {
  const c = state.config;
  if (!c) return "";
  const promo = store.get("promo", "");
  if (promo) return `<span class="free">PROMO ACTIVE</span> Unlimited raids for you.`;
  if (c.accessMode === "free") return `<s>₹${c.priceInr} per raid</s> <span class="free">FREE RIGHT NOW</span>`;
  if (c.accessMode === "promo_only") return `₹${c.priceInr} per raid · invite-only for now`;
  return `₹${c.priceInr} per raid`;
}

async function loadConfig() {
  try { state.config = await api("/api/config"); }
  catch { state.config = { accessMode: "free", priceInr: 5, aiReady: false, offline: true, razorpayEnabled: false }; }
  $("#price-text").innerHTML = priceLabel();
}

// ---------- file handling ----------
async function readFiles(fileList) {
  const out = [];
  for (const f of fileList) {
    if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
      if (!window.JSZip) throw new Error("Couldn't load the zip reader. Check your internet, or unzip the file and drop the .txt instead.");
      const zip = await window.JSZip.loadAsync(f);
      const entries = Object.values(zip.files).filter((e) => !e.dir && /\.(txt|json)$/i.test(e.name) && !/__MACOSX/.test(e.name));
      for (const e of entries) out.push({ name: e.name.split("/").pop(), text: await e.async("string") });
    } else if (/\.(txt|json)$/i.test(f.name)) {
      out.push({ name: f.name, text: await f.text() });
    }
  }
  if (!out.length) throw new Error("That file doesn't look like a chat export. Drop a .zip, .txt or .json.");
  return out;
}

async function handleFiles(fileList) {
  if (!fileList?.length || state.busy) return;
  try {
    showOverlay("Seizing evidence…", ["Opening the evidence bag", "Dusting for fingerprints", "Building the rap sheet"]);
    setStep(0);
    const files = await readFiles(fileList);
    setStep(1);
    await tick();
    const chat = parseFiles(files);
    const stats = computeStats(chat);
    if (stats.totalMessages < 10 || stats.people.length < 2) throw new Error("This chat is too small to investigate. We need at least 10 messages from 2 people.");
    setStep(2);
    await sleep(500);
    openReport(chat, stats, false);
  } catch (err) {
    toast(err.message || "Something went wrong reading that file.", 5000);
  } finally {
    hideOverlay();
  }
}

function loadSample() {
  const chat = parseFiles([{ name: `WhatsApp Chat with ${SAMPLE_TITLE}.txt`, text: SAMPLE_CHAT_TEXT }]);
  openReport(chat, computeStats(chat), true);
}

// ---------- report ----------
function openReport(chat, stats, isSample) {
  Object.assign(state, { chat, stats, caseFile: null, isSample });
  $("#landing").hidden = true;
  $("#report").hidden = false;
  $("#share-btn").hidden = true;
  $("#case-title").textContent = `Case: ${chat.title}`;
  $("#case-meta").textContent = `${stats.totalMessages.toLocaleString()} messages · ${stats.people.length} suspects · ${chat.source}`;
  $("#ai-sections").innerHTML = "";
  renderInterrogateCard();
  $("#stats-sections").innerHTML = renderStats(stats);
  buildJump();
  window.scrollTo({ top: 0 });
}

function renderInterrogateCard(errorMsg = "") {
  const c = state.config || {};
  const s = settings();
  const [emo, name] = PERSONA_INFO[s.persona];
  const promo = store.get("promo", "");
  let priceNote;
  if (state.isSample) priceNote = "Sample raid: the roast is pre-written, free and instant.";
  else if (!c.aiReady) priceNote = c.offline ? "The server isn't reachable, so only the free stats work right now." : "The AI isn't connected on this server yet (no API key). The free stats below still work.";
  else if (promo) priceNote = "🎟️ Promo code active. This one's on the house.";
  else if (c.accessMode === "free") priceNote = `Normally ₹${c.priceInr}. Free right now · ${c.freeUsesLeft ?? "a few"} free raids left today.`;
  else if (c.accessMode === "promo_only") priceNote = "Invite-only for now. You'll need a promo code.";
  else priceNote = `₹${c.priceInr} per raid. Promo codes work too.`;
  const disabled = !state.isSample && !c.aiReady;

  $("#interrogate-wrap").innerHTML = `
<div class="card interrogate">
  <div>
    <h2>🚨 Bring them in for questioning</h2>
    <p>The stats below are free. The interrogation reads the messages and writes mugshots, ships &amp; beefs, the unsaid, awards and a fix-it plan.</p>
    <div class="meta"><span class="chip y">${emo} ${esc(name)}</span><span class="chip p">${{ wholesome: "😇 Wholesome", spicy: "🌶️ Spicy", nuclear: "☢️ Nuclear" }[s.spice]}</span><span class="chip m">${s.language === "hinglish" ? "Hinglish" : "English"}</span>${s.anon ? '<span class="chip l">🙈 names hidden</span>' : ""}</div>
    <p class="note">${esc(priceNote)}</p>
    ${errorMsg ? `<p class="note" style="color:#ffb3b9">⚠️ ${esc(errorMsg)}</p>` : ""}
  </div>
  <div style="display:grid;gap:10px">
    <button class="btn primary big" type="button" id="go" ${disabled ? "disabled" : ""}>Start interrogation</button>
    <button class="btn small" type="button" id="change-opts">Change interrogator</button>
  </div>
</div>`;
  $("#go").addEventListener("click", () => startInterrogation());
  $("#change-opts").addEventListener("click", () => { goLanding(); document.getElementById("raid").scrollIntoView({ behavior: "smooth" }); });
}

function buildJump() {
  const ids = [...document.querySelectorAll("#ai-sections section, #stats-sections section")].map((s) => [s.id, s.querySelector("h2")?.textContent || s.id]);
  const short = { verdict: "Verdict", suspects: "Mugshots", ships: "Ships & beefs", unsaid: "Unsaid", awards: "Awards", fixit: "Fix-it", evidence: "Evidence", final: "Final", lineup: "Who talks most", interest: "Who likes who", badges: "Badges", web: "String board", activity: "Activity", speed: "Reply speed", words: "Words" };
  $("#jump").innerHTML = ids.map(([id, t]) => `<a href="#${id}">${esc(short[id] || t)}</a>`).join("");
}

function goLanding() {
  $("#report").hidden = true;
  $("#landing").hidden = false;
  $("#price-text").innerHTML = priceLabel();
}

// ---------- interrogation ----------
const LINES = {
  fbi: ["Kicking down the door…", "Agent Brandon is reading your 2 a.m. texts. Yikes.", "Cross-checking alibis…", "Counting every 'hahaha' that wasn't funny…", "Identifying the group's unpaid therapist…", "Writing up the charges…"],
  aunty: ["Aunty is putting on her reading glasses…", "Beta, who is this boy who replies so fast?", "Calling Sharma ji for a second opinion…", "Judging your emoji usage…", "Preparing the rishta report…"],
  therapist: ["Dr. Overthink is taking a deep breath…", "Let's sit with these 'k' messages…", "Noting a lot of unprocessed 🙂…", "Drafting gentle but devastating notes…"],
  genz: ["omg wait let me read this…", "the tea is HOT 🍵", "screenshotting for the group chat about the group chat…", "it's giving… chaos", "writing the receipts rn"],
  nature: ["Approaching the group chat quietly…", "A rare double text, observed in the wild…", "The alpha replier establishes dominance…", "Documenting the mating ritual of the 'haha no reason'…"],
};

async function startInterrogation(payment = null) {
  if (state.busy) return;
  const s = settings();
  if (state.isSample) return runSample(s);
  const c = state.config;
  const promo = store.get("promo", "");
  if (!promo && c.accessMode === "promo_only") return openModal("promo");
  if (!promo && c.accessMode === "paid" && !payment?.paymentId) return openModal("pay");

  state.busy = true;
  showOverlay("FBI, OPEN UP!", ["Seizing the evidence", "Hiding real names", "Interrogating suspects", "Writing the case file"], LINES[s.persona]);
  try {
    setStep(0); await tick();
    const anon = s.anon ? makeNameMap(state.stats.people) : null;
    setStep(1); await tick();
    const transcript = buildTranscript(state.chat, state.stats, { anon });
    const stats = statsForAi(state.stats, anon ? anon.name : (n) => n);
    setStep(2);
    const res = await api("/api/analyze", { stats, transcript, persona: s.persona, spice: s.spice, language: s.language, promo: promo || undefined, payment: payment || undefined });
    setStep(3); await sleep(400);
    let cf = res.caseFile;
    if (anon) cf = restoreDeep(cf, anon.restore);
    if (typeof res.freeUsesLeft === "number") state.config.freeUsesLeft = res.freeUsesLeft;
    showCase(cf);
  } catch (err) {
    if (err.status === 402) openModal("pay", err.message);
    else if (err.status === 403) openModal("promo", err.message);
    else renderInterrogateCard(err.message);
  } finally {
    state.busy = false;
    hideOverlay();
  }
}

async function runSample(s) {
  state.busy = true;
  showOverlay("FBI, OPEN UP!", ["Seizing the evidence", "Interrogating suspects", "Writing the case file"], LINES.fbi);
  for (let i = 0; i < 3; i++) { setStep(i); await sleep(900); }
  state.busy = false;
  hideOverlay();
  showCase(SAMPLE_CASE);
  if (s.persona !== "fbi" || s.spice !== "spicy") toast("Sample roast is pre-written by Agent Brandon. Your own chats use the interrogator you pick.", 4500);
}

function showCase(cf) {
  state.caseFile = cf;
  $("#interrogate-wrap").innerHTML = "";
  $("#ai-sections").innerHTML = renderCase(cf, state.stats);
  $("#stats-sections").innerHTML = renderStats(state.stats, cf);
  $("#share-btn").hidden = false;
  buildJump();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- overlay ----------
let lineTimer = null;
function showOverlay(title, steps, lines = null) {
  $("#ov-title").textContent = title;
  $("#ov-steps").innerHTML = steps.map((s) => `<div class="todo">${esc(s)}</div>`).join("");
  $("#ov-line").textContent = lines ? lines[0] : "";
  $("#overlay").hidden = false;
  clearInterval(lineTimer);
  if (lines) {
    let i = 0;
    lineTimer = setInterval(() => { i = (i + 1) % lines.length; $("#ov-line").textContent = lines[i]; }, 2400);
  }
}
function setStep(n) {
  [...$("#ov-steps").children].forEach((el, i) => (el.className = i < n ? "done" : i === n ? "now" : "todo"));
}
function hideOverlay() { $("#overlay").hidden = true; clearInterval(lineTimer); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

// ---------- promo / pay modal ----------
let modalMode = "promo";
function openModal(mode, msg = "") {
  modalMode = mode;
  const c = state.config || {};
  const canPay = mode === "pay" && c.razorpayEnabled && c.accessMode === "paid";
  $("#modal-title").textContent = mode === "pay" ? `🚨 This raid costs ₹${c.priceInr}` : "🎟️ Got a badge number?";
  $("#modal-text").textContent = msg || (mode === "pay" ? "One payment covers one full interrogation of this chat." : "Enter your promo code for unlimited raids.");
  $("#pay-area").hidden = !canPay;
  $("#pay-btn").textContent = `Pay ₹${c.priceInr} with Razorpay`;
  $("#promo-err").textContent = "";
  $("#promo-input").value = store.get("promo", "");
  $("#modal").hidden = false;
  setTimeout(() => (canPay ? $("#pay-btn") : $("#promo-input")).focus(), 30);
}
function closeModal() { $("#modal").hidden = true; }

async function applyPromo() {
  const code = $("#promo-input").value.trim();
  if (!code) { store.set("promo", ""); $("#promo-err").textContent = "Promo code removed."; refreshPrices(); return; }
  try {
    const { valid } = await api("/api/promo", { code });
    if (!valid) { $("#promo-err").textContent = "That badge number doesn't check out."; return; }
    store.set("promo", code);
    closeModal();
    toast("🎟️ Promo code accepted. Unlimited raids unlocked.");
    refreshPrices();
  } catch (err) {
    $("#promo-err").textContent = err.message;
  }
}
function refreshPrices() {
  $("#price-text").innerHTML = priceLabel();
  if (state.chat && !state.caseFile && !$("#report").hidden) renderInterrogateCard();
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load Razorpay. Check your internet."));
    document.head.appendChild(s);
  });
}

async function pay() {
  try {
    await loadRazorpay();
    const order = await api("/api/pay/order", {});
    closeModal();
    const rzp = new window.Razorpay({
      key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
      name: "FBI, OPEN UP!", description: "One chat interrogation",
      theme: { color: "#ff4e5b" },
      handler: (r) => startInterrogation({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
    });
    rzp.on("payment.failed", (r) => toast(r.error?.description || "Payment failed. No money was taken.", 5000));
    rzp.open();
  } catch (err) {
    $("#promo-err").textContent = err.message;
  }
}

// ---------- events ----------
function bind() {
  const drop = $("#drop");
  const input = $("#file");
  input.addEventListener("change", () => { handleFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => { e.preventDefault(); if (!$("#landing").hidden) handleFiles(e.dataTransfer.files); });

  $("#sample-btn").addEventListener("click", loadSample);
  $("#promo-btn").addEventListener("click", () => openModal("promo"));
  $("#promo-apply").addEventListener("click", applyPromo);
  $("#promo-input").addEventListener("keydown", (e) => { if (e.key === "Enter") applyPromo(); });
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  $("#pay-btn").addEventListener("click", pay);
  $("#new-raid").addEventListener("click", () => { goLanding(); window.scrollTo({ top: 0 }); });
  $("#share-btn").addEventListener("click", doShare);

  // delegated clicks inside the report
  $("#report").addEventListener("click", async (e) => {
    const tr = e.target.closest(".translate, .redact");
    if (tr) { tr.classList.toggle("open"); tr.setAttribute("aria-expanded", tr.classList.contains("open")); return; }
    const act = e.target.closest("[data-action]")?.dataset.action;
    if (act === "share") doShare();
    if (act === "copy" && state.caseFile) {
      try { await navigator.clipboard.writeText(roastText(state.caseFile)); toast("📋 Roast copied. Go cause problems."); }
      catch { toast("Couldn't copy. Long-press the text instead."); }
    }
  });
}

async function doShare() {
  if (!state.caseFile) return;
  toast("📸 Making your share card…");
  const blob = await makeShareCard(state.caseFile, { blurNames: false });
  const r = await shareOrDownload(blob);
  if (r === "downloaded") toast("Saved the share card. Post it to your story!");
}

buildPersonas();
bind();
loadConfig();
