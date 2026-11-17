// FBI, OPEN UP! — one-click version. Runs entirely in the page; the AI
// investigation asks Claude through the viewer's own Claude account
// (the artifact `sample` capability), so there is no server and no key.
import { readUploads, parseUploads, addToBag, pickMain, prepareEvidence } from "../public/js/evidence.js";
import { bagHtml, bindBag } from "../public/js/bag.js";
import { parseFiles } from "../public/js/parser.js";
import { computeStats, restoreDeep, scrub } from "../public/js/stats.js";
import { renderCase, renderStats, roastText, esc } from "../public/js/report.js";
import { makeShareCard } from "../public/js/share.js";
import { SAMPLE_CHAT_TEXT, SAMPLE_CASE, SAMPLE_TITLE } from "../public/js/sample.js";
import { initCaseBar } from "../public/js/casebar.js";
import { DEPTHS, DEFAULT_DEPTH, DEPTH_BUDGET, DEPTH_HINT, TIER_DEPTH } from "../public/js/depth.js";
import { buildSystemPrompt, buildUserMessage, buildAskerBlock } from "../server/prompt.js";
import { CASE_SCHEMA } from "../public/js/schema.js";
import { parseCaseJson, coerceCase } from "../public/js/casefile.js";
import { askerHtml, readAsker } from "../public/js/asker.js";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem("fbi:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("fbi:" + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

const PERSONA_INFO = {
  sherlock: ["🕵️", "Sherlock", "Investigates the fights. Who started it, who won, who's still sulking."],
  cupid: ["💘", "Cupid", "Love matters. Who likes whom, the signals and the odds."],
  aunty: ["👵", "Aunty", "Pure sarcasm. Beta, 400 stickers and no career plans?"],
  gossip: ["💅", "Gossip Queen", "Character analysis. Who everyone really is. Spills it all."],
  osho: ["🧘", "Osho", "Calm, deep life lessons hidden in your petty drama."],
};
const DEFAULT_PERSONA = "sherlock";
const LINES = {
  sherlock: ["Sherlock is lighting his pipe…", "You replied in 4 seconds, then deleted it. Elementary.", "Reconstructing every argument…", "Working out who apologised first…", "Deducing who's still sulking…"],
  cupid: ["Cupid is sharpening his arrows…", "Measuring reply speeds for romantic intent…", "Gasping at the 2 a.m. texts…", "Counting the hearts. And the lack of hearts…", "Calculating the odds…"],
  aunty: ["Aunty is putting on her reading glasses…", "Beta, who is this boy who replies so fast?", "Calling Sharma ji for a second opinion…", "Judging your emoji usage…", "Preparing the taunts…"],
  gossip: ["Okay so you did NOT hear this from me…", "Reading every single message twice…", "Building everyone's character file…", "The tea is HOT 🍵", "Finding out who people really are…"],
  osho: ["Breathing in. Breathing out…", "Observing the ego in the group chat…", "Contemplating the meaning of 'k'…", "Finding the lesson in the drama…", "Letting go of the blue ticks…"],
};

// ai: "checking" until the viewer answers, then "ready" or "off"
const state = { bag: [], mainId: null, userAliases: {}, asker: {}, owner: false, unavailableDepths: new Set(), chat: null, stats: null, caseFile: null, isSample: false, busy: false, ai: "checking", aiOffReason: "", sample: null, downloads: null, ctl: null };

// ---------- helpers ----------
function toast(msg, ms = 2800) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
const settings = () => ({
  persona: document.querySelector('input[name="persona"]:checked')?.value || DEFAULT_PERSONA,
  spice: document.querySelector('input[name="spice"]:checked')?.value || "spicy",
  depth: document.querySelector('input[name="depth"]:checked:not(:disabled)')?.value || DEFAULT_DEPTH,
  anon: $("#anon").checked,
});
const saveSettings = () => store.set("settings", settings());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

function buildPersonas() {
  const saved = store.get("settings", {});
  if (!PERSONA_INFO[saved.persona]) saved.persona = DEFAULT_PERSONA;
  $("#personas").innerHTML = Object.entries(PERSONA_INFO).map(([k, [emo, name, desc]]) => `
<div class="persona"><input type="radio" name="persona" id="pe-${k}" value="${k}" ${saved.persona === k ? "checked" : ""}>
<label for="pe-${k}"><b>${emo}</b><span>${name}</span><small>${desc}</small></label></div>`).join("");
  if (saved.spice) { const el = document.querySelector(`input[name="spice"][value="${saved.spice}"]`); if (el) el.checked = true; }
  if (typeof saved.anon === "boolean") $("#anon").checked = saved.anon;
  if (DEPTHS[saved.depth]) { const el = document.querySelector(`input[name="depth"][value="${saved.depth}"]`); if (el) el.checked = true; }
  document.querySelectorAll('input[name="depth"]').forEach((el) => el.addEventListener("change", () => updateDepthNote()));
  updateDepthNote();
  document.querySelectorAll('input[name="persona"],input[name="spice"],input[name="depth"],#anon').forEach((el) => el.addEventListener("change", saveSettings));
}

// ---------- capabilities ----------
async function connect() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") {
    state.ai = "off"; state.aiOffReason = "outside";
  } else {
    const [sample, downloads, user] = await Promise.all(["sample", "downloads", "user"].map((n) => c.use(n).catch(() => null)));
    state.sample = sample; state.downloads = downloads;
    state.ai = sample ? "ready" : "off";
    if (!sample) state.aiOffReason = "unavailable";
    state.owner = Boolean(await user?.isOwner?.().catch(() => false));
    // Depths this viewer's Claude plan can run (the platform may not say; then all stay open).
    const limits = sample ? await sample.limits().catch(() => null) : null;
    const tiers = Array.isArray(limits?.modelTiers) ? limits.modelTiers : null;
    state.unavailableDepths = new Set(tiers ? Object.keys(DEPTHS).filter((d) => !tiers.includes(DEPTHS[d].tier)) : []);
    applyDepthAccess();
  }
  $("#ai-text").innerHTML = aiLabel();
  if (state.chat && !state.caseFile) renderInterrogateCard();
}
function applyDepthAccess() {
  $("#secret-depth").hidden = !state.owner;
  $("#dp-x").disabled = !state.owner || state.unavailableDepths.has("secret");
  document.querySelectorAll('input[name="depth"]').forEach((el) => {
    if (el.value === "secret") return;
    el.disabled = state.unavailableDepths.has(el.value);
    el.nextElementSibling.title = el.disabled ? "Not available on your Claude plan" : "";
  });
  if (!document.querySelector('input[name="depth"]:checked:not(:disabled)')) {
    const open = [...document.querySelectorAll('input[name="depth"]:not(:disabled)')].filter((el) => el.value !== "secret").pop();
    if (open) open.checked = true;
  }
  updateDepthNote();
}
function updateDepthNote() {
  const d = settings().depth;
  let text = DEPTHS[d].desc;
  if (state.unavailableDepths.size && d !== "secret") text += " Greyed-out depths aren't on your Claude plan.";
  $("#depth-note").textContent = text;
}
function aiLabel() {
  if (state.ai === "checking") return "Connecting to Claude…";
  if (state.ai === "ready") return '<span class="free">FREE</span> The investigation runs on your Claude account.';
  return "Free stats work here. Open this page on claude.ai to unlock the investigation.";
}

// ---------- file handling ----------
// Drop one chat, or several exports from different apps at once. The biggest becomes the main chat.
async function handleFiles(fileList) {
  if (!fileList?.length || state.busy) return;
  try {
    showOverlay("Seizing evidence…", ["Opening the evidence bag", "Dusting for fingerprints", "Building the rap sheet"]);
    setStep(0);
    const { groups, errors } = await readUploads(fileList, window.JSZip);
    setStep(1); await tick();
    const { items, errors: more } = parseUploads(groups);
    const problems = [...errors, ...more];
    if (!items.length) throw new Error(problems.join(" · ") || "That doesn't look like a chat export. Drop a .zip, .txt or .json.");
    setStep(2); await sleep(400);
    const { bag, notes } = addToBag([], items);
    openReport(bag, false);
    const skipped = [...problems, ...notes];
    if (skipped.length) toast(`Skipped: ${skipped.join(" · ")}`, 7000);
  } catch (err) {
    toast(err.message || "Something went wrong reading that file.", 6000);
  } finally {
    hideOverlay();
  }
}

// Adds more chats (other apps) to the bag as optional context.
async function addMore(fileList) {
  if (state.busy || !fileList?.length) return;
  showOverlay("Adding evidence…", ["Opening the files", "Reading the chats"]);
  try {
    setStep(0);
    const { groups, errors } = await readUploads(fileList, window.JSZip);
    setStep(1); await tick();
    const { items, errors: more } = parseUploads(groups);
    const { bag, notes } = addToBag(state.bag, items);
    const added = bag.length - state.bag.length;
    state.bag = bag;
    const problems = [...errors, ...more, ...notes];
    toast(added ? `Added ${added} chat${added > 1 ? "s" : ""} to the bag.${problems.length ? ` Skipped: ${problems.join(" · ")}` : ""}` : problems.join(" · ") || "Nothing new to add.", 7000);
    renderInterrogateCard();
  } catch (err) {
    console.error(err);
    toast("Couldn't add that file. Try exporting it again.", 5000);
  } finally {
    hideOverlay();
  }
}

function removeFromBag(id) {
  if (state.bag.length <= 1) return;
  state.bag = state.bag.filter((b) => b.id !== id);
  if (state.mainId === id) { state.mainId = pickMain(state.bag); state.asker = {}; state.userAliases = {}; applyMain(); }
  renderInterrogateCard();
}

function setMain(id) {
  if (id === state.mainId || !state.bag.some((b) => b.id === id)) return;
  state.mainId = id; state.asker = {}; state.userAliases = {};
  applyMain();
  renderInterrogateCard();
}

function loadSample() {
  const chat = parseFiles([{ name: `WhatsApp Chat with ${SAMPLE_TITLE}.txt`, text: SAMPLE_CHAT_TEXT }]);
  openReport([{ id: "sample", label: SAMPLE_TITLE, chat, stats: computeStats(chat) }], true);
}

// ---------- report ----------
function metaText(depthLabel = "") {
  const m = state.stats;
  const ctx = state.isSample ? 0 : state.bag.length - 1;
  return [`${m.totalMessages.toLocaleString()} messages`, `${m.people.length} suspects`, depthLabel || state.chat.source, ctx ? `+${ctx} context` : ""].filter(Boolean).join(" · ");
}

// Makes the chosen main chat the one the report is about.
function applyMain() {
  const m = state.bag.find((b) => b.id === state.mainId) || state.bag[0];
  state.mainId = m.id; state.chat = m.chat; state.stats = m.stats;
  $("#case-title").textContent = `Case: ${m.chat.title}`;
  caseBar.setTitle(`Case: ${m.chat.title}`);
  $("#case-meta").textContent = metaText();
  $("#stats-sections").innerHTML = renderStats(state.stats);
  buildJump();
}

function openReport(bag, isSample) {
  Object.assign(state, { bag, mainId: pickMain(bag), userAliases: {}, caseFile: null, isSample, asker: {}, ranDepth: null });
  applyMain();
  $("#landing").hidden = true;
  $("#report").hidden = false;
  $("#share-btn").hidden = true;
  $("#ai-sections").innerHTML = "";
  renderInterrogateCard();
  buildJump();
  caseBar.reset();
  window.scrollTo({ top: 0 });
}

// Back to the investigation card (keeping the bag) so more chats can be added and the case re-run.
function investigateAgain() {
  state.caseFile = null; state.ranDepth = null;
  $("#ai-sections").innerHTML = "";
  $("#share-btn").hidden = true;
  $("#case-meta").textContent = metaText();
  $("#stats-sections").innerHTML = renderStats(state.stats);
  renderInterrogateCard();
  buildJump();
  caseBar.reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderInterrogateCard(errorMsg = "") {
  const s = settings();
  const [emo, name] = PERSONA_INFO[s.persona];
  let note, disabled = false;
  if (state.isSample) note = "Sample raid: the case file is pre-written and instant.";
  else if (state.ai === "checking") { note = "Connecting to Claude…"; disabled = true; }
  else if (state.ai === "ready") note = "Free. It uses your own Claude account, and Claude asks your permission the first time.";
  else if (state.aiOffReason === "declined") { note = "You didn't allow Claude for this page. Reload the page to be asked again. The free stats below still work."; disabled = true; }
  else { note = "The investigation only works when this page is open on claude.ai and you're signed in. The free stats below still work."; disabled = true; }

  $("#interrogate-wrap").innerHTML = `
<div class="card interrogate">
  <div>
    <h2>🚨 Send in the investigator</h2>
    <p>Your investigator reads the messages and writes their speciality report, plus mugshots, ships &amp; beefs, the unsaid, awards and a fix-it plan.</p>
    <div class="meta"><span class="chip y">${emo} ${esc(name)}</span><span class="chip p">${{ wholesome: "😇 Wholesome", spicy: "🌶️ Spicy", nuclear: "☢️ Nuclear" }[s.spice]}</span><span class="chip m">${DEPTHS[s.depth].emoji} ${DEPTHS[s.depth].label}</span>${s.anon ? '<span class="chip l">🙈 names hidden</span>' : ""}</div>
    ${state.isSample ? "" : bagHtml({ bag: state.bag, mainId: state.mainId, userAliases: state.userAliases })}
    ${state.isSample ? "" : askerHtml(state.stats.people, state.asker)}
    <p class="note">${esc(note)}</p>
    ${errorMsg ? `<p class="note" style="color:#ffb3b9">⚠️ ${esc(errorMsg)}</p>` : ""}
  </div>
  <div style="display:grid;gap:10px">
    <button class="btn primary big" type="button" id="go" ${disabled ? "disabled" : ""}>Start investigation</button>
    <button class="btn small" type="button" id="change-opts">Change investigator</button>
  </div>
</div>`;
  $("#go").addEventListener("click", () => startInvestigation());
  // Keep what the viewer typed if the card is redrawn (for example after an error).
  bindBag($("#interrogate-wrap"), {
    onAdd: addMore,
    onRemove: removeFromBag,
    onMain: setMain,
    onAlias: (name, choice) => { state.userAliases[name] = choice; },
  });
  const keep = () => { state.asker = readAsker(); };
  $("#asker-me")?.addEventListener("change", keep);
  $("#asker-note")?.addEventListener("input", keep);
  $("#change-opts").addEventListener("click", () => { goLanding(); document.getElementById("raid").scrollIntoView({ behavior: "smooth" }); });
}

function buildJump() {
  const ids = [...document.querySelectorAll("#ai-sections section, #stats-sections section")].map((s) => [s.id, s.querySelector("h2")?.textContent || s.id]);
  const short = { focus: "Speciality", verdict: "Verdict", suspects: "Mugshots", ships: "Ships & beefs", unsaid: "Unsaid", awards: "Awards", fixit: "Fix-it", evidence: "Evidence", final: "Final", lineup: "Who talks most", interest: "Who likes who", badges: "Badges", web: "String board", activity: "Activity", speed: "Reply speed", words: "Words" };
  $("#jump").innerHTML = ids.map(([id, t]) => `<a href="#${id}">${esc(short[id] || t)}</a>`).join("");
}

function backToCase() {
  if (!state.chat) return;
  $("#landing").hidden = true;
  $("#report").hidden = false;
  if (!state.caseFile) renderInterrogateCard();
  caseBar.reset();
  window.scrollTo({ top: 0 });
}

function goLanding() {
  $("#report").hidden = true;
  $("#landing").hidden = false;
  $("#back-case").hidden = !state.chat;
}

// ---------- the investigation ----------
const MAX_BYTES = 240_000;
const bytes = (s) => new TextEncoder().encode(s).length;

function buildPrompt(s, ev, asker) {
  const anon = ev.anon;
  const askerBlock = buildAskerBlock({
    me: asker.me ? (anon ? anon.name(asker.me) : asker.me) : "",
    outsider: asker.outsider,
    note: asker.note ? (anon ? anon.text(scrub(asker.note)) : scrub(asker.note)) : "",
  });
  return `${buildSystemPrompt({ persona: s.persona, spice: s.spice, hasContext: ev.contexts.length > 0 })}

${DEPTH_HINT[s.depth]}

${askerBlock}

FORMAT
Reply with only one JSON object, no other text, matching this JSON Schema exactly (every property is required):
${JSON.stringify(CASE_SCHEMA)}

${buildUserMessage({ stats: ev.mainStats, transcript: ev.mainTranscript, contexts: ev.contexts })}`;
}

const ERROR_COPY = {
  rate_limited: "Claude is busy or you've hit your usage limit. Try again in a little while.",
  session_expired: "Your Claude session expired. Sign in again, then try once more.",
  refused: "Claude declined to analyse this chat. The free stats below still work.",
  invalid_json: "The case file came back garbled. Tap Start investigation to try again.",
  empty_completion: "Claude returned an empty case file. Try again, or try a smaller chat.",
  prompt_too_large: "This chat is too big to send. Try exporting a shorter period.",
  upstream_error: "The connection to Claude dropped. Try again.",
  render_error: "Something went wrong drawing the case file. Try again, or pick a lighter depth.",
};

async function startInvestigation() {
  if (state.busy) return;
  const s = settings();
  if (state.isSample) return runSample(s);
  if (state.ai !== "ready") return renderInterrogateCard();

  state.busy = true;
  state.ctl = new AbortController();
  showOverlay("FBI, OPEN UP!", ["Hiding real names", "Waiting for Claude (it asks your permission the first time)", "Interrogating suspects", "Writing the case file"], LINES[s.persona], true);
  try {
    setStep(0); await tick();
    if (s.depth === "secret" && !state.owner) s.depth = "deep";
    const asker = readAsker();
    state.asker = asker;
    const prepare = (b) => prepareEvidence({ bag: state.bag, mainId: state.mainId, userAliases: state.userAliases, hide: s.anon, budget: b });
    let budget = DEPTH_BUDGET[s.depth], ev = prepare(budget), prompt = buildPrompt(s, ev, asker);
    while (bytes(prompt) > MAX_BYTES && budget > 20_000) { budget = Math.floor(budget * 0.75); ev = prepare(budget); prompt = buildPrompt(s, ev, asker); }
    const anon = ev.anon;
    setStep(1);
    let started = false;
    const want = DEPTHS[s.depth];
    const res = await state.sample(prompt, {
      signal: state.ctl.signal,
      model: want.model,
      modelTier: want.tier,
      ...(want.effort ? { effort: want.effort } : {}),
      onText: ({ text }) => {
        if (!started) { started = true; setStep(3); }
        $("#ov-progress").textContent = `${text.length.toLocaleString()} characters of evidence written…`;
      },
    });
    let cf = coerceCase(parseCaseJson(res?.text));
    if (res?.truncated) toast("The case file was cut short, so a few sections may be missing. A lighter depth gives a complete one.", 6000);
    // Tell the viewer which depth actually ran (their plan may have used a lighter model).
    const ranDepth = res.modelApplied === want.model ? s.depth : (TIER_DEPTH[res.modelTierApplied] || s.depth);
    state.ranDepth = ranDepth;
    if (ranDepth !== s.depth && !(s.depth === "secret" && ranDepth === "deep")) {
      toast(`Your Claude plan ran this as ${DEPTHS[ranDepth].emoji} ${DEPTHS[ranDepth].label} instead of ${want.label}.`, 6000);
    }
    if (anon) cf = restoreDeep(cf, anon.restore);
    showCase(cf);
  } catch (e) {
    if (e instanceof Error) console.error(e);
    const code = e instanceof Error ? "render_error" : e?.code || "upstream_error";
    if (code === "cancelled") renderInterrogateCard();
    else if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) {
      state.ai = "off"; state.aiOffReason = code === "not_granted" ? "declined" : "unavailable";
      $("#ai-text").innerHTML = aiLabel();
      renderInterrogateCard();
    } else renderInterrogateCard(ERROR_COPY[code] || ERROR_COPY.upstream_error);
  } finally {
    state.busy = false;
    hideOverlay();
  }
}

async function runSample(s) {
  state.busy = true;
  showOverlay("FBI, OPEN UP!", ["Seizing the evidence", "Interrogating suspects", "Writing the case file"], LINES.sherlock);
  for (let i = 0; i < 3; i++) { setStep(i); await sleep(800); }
  state.busy = false;
  hideOverlay();
  showCase(coerceCase(SAMPLE_CASE));
  if (s.persona !== DEFAULT_PERSONA || s.spice !== "spicy") toast("The sample is pre-written by Sherlock. Your own chats get the investigator you pick.", 4500);
}

function showCase(cf) {
  state.caseFile = cf;
  const d = state.isSample ? null : DEPTHS[state.ranDepth];
  if (d) $("#case-meta").textContent = metaText(`${d.emoji} ${d.label}`);
  $("#interrogate-wrap").innerHTML = "";
  $("#ai-sections").innerHTML = renderCase(cf, state.stats, { chat: state.chat, me: state.isSample ? "" : state.asker.me });
  $("#stats-sections").innerHTML = renderStats(state.stats, cf);
  $("#share-btn").hidden = false;
  buildJump();
  caseBar.reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- overlay ----------
let lineTimer = null;
function showOverlay(title, steps, lines = null, stoppable = false) {
  $("#ov-title").textContent = title;
  $("#ov-steps").innerHTML = steps.map((s) => `<div class="todo">${esc(s)}</div>`).join("");
  $("#ov-line").textContent = lines ? lines[0] : "";
  $("#ov-progress").textContent = "";
  $("#ov-stop").hidden = !stoppable;
  $("#overlay").hidden = false;
  clearInterval(lineTimer);
  if (lines) {
    let i = 0;
    lineTimer = setInterval(() => { i = (i + 1) % lines.length; $("#ov-line").textContent = lines[i]; }, 2600);
  }
}
function setStep(n) { [...$("#ov-steps").children].forEach((el, i) => (el.className = i < n ? "done" : i === n ? "now" : "todo")); }
function hideOverlay() { $("#overlay").hidden = true; clearInterval(lineTimer); }

// ---------- share card ----------
async function doShare() {
  if (!state.caseFile) return;
  let blob;
  try {
    blob = await makeShareCard(state.caseFile, { blurNames: false });
  } catch (err) {
    console.error(err);
    toast("Couldn't draw the share card on this device. Try the copy button instead.", 5000);
    return;
  }
  if (state.downloads) {
    try {
      await state.downloads.save({ filename: "fbi-open-up-case.png", data: blob });
      toast("Saved the share card. Post it to your story!");
      return;
    } catch (e) {
      if (e?.code === "declined") return;
      if (e?.code === "rate_limited") { toast("A save is already waiting for you. Finish that one first."); return; }
    }
  }
  // Fallback: show the card so the viewer can long-press or right-click to save it.
  closeCard();
  state.cardUrl = URL.createObjectURL(blob);
  $("#card-img").src = state.cardUrl;
  $("#card-modal").hidden = false;
}
function closeCard() {
  $("#card-modal").hidden = true;
  if (state.cardUrl) { URL.revokeObjectURL(state.cardUrl); state.cardUrl = null; }
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
  $("#back-case").addEventListener("click", backToCase);
  $("#new-raid").addEventListener("click", () => { goLanding(); window.scrollTo({ top: 0 }); });
  $("#share-btn").addEventListener("click", doShare);
  $("#ov-stop").addEventListener("click", () => state.ctl?.abort());
  $("#card-close").addEventListener("click", closeCard);
  $("#card-modal").addEventListener("click", (e) => { if (e.target.id === "card-modal") closeCard(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#card-modal").hidden) closeCard(); });

  $("#report").addEventListener("click", async (e) => {
    const tr = e.target.closest(".translate, .redact");
    if (tr) { tr.classList.toggle("open"); tr.setAttribute("aria-expanded", tr.classList.contains("open")); return; }
    const act = e.target.closest("[data-action]")?.dataset.action;
    if (act === "share") doShare();
    if (act === "again") investigateAgain();
    if (act === "copy" && state.caseFile) {
      try { await navigator.clipboard.writeText(roastText(state.caseFile)); toast("📋 Roast copied. Go cause problems."); }
      catch { toast("Couldn't copy here. Use the share card instead."); }
    }
  });
}

buildPersonas();
const caseBar = initCaseBar();
bind();
$("#ai-text").innerHTML = aiLabel();
connect();
