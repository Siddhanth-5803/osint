// FBI, OPEN UP! — one-click version. Runs entirely in the page; the AI
// investigation asks Claude through the viewer's own Claude account
// (the artifact `sample` capability), so there is no server and no key.
import { parseFiles } from "../public/js/parser.js";
import { computeStats, statsForAi, buildTranscript, makeNameMap, restoreDeep } from "../public/js/stats.js";
import { renderCase, renderStats, roastText, esc } from "../public/js/report.js";
import { makeShareCard } from "../public/js/share.js";
import { SAMPLE_CHAT_TEXT, SAMPLE_CASE, SAMPLE_TITLE } from "../public/js/sample.js";
import { initCaseBar } from "../public/js/casebar.js";
import { DEPTHS, DEFAULT_DEPTH } from "../public/js/depth.js";
import { buildSystemPrompt, buildUserMessage, CASE_SCHEMA } from "../server/prompt.js";

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
const state = { chat: null, stats: null, caseFile: null, isSample: false, busy: false, ai: "checking", aiOffReason: "", sample: null, downloads: null, ctl: null };

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
  const note = () => { $("#depth-note").textContent = DEPTHS[settings().depth].desc; };
  document.querySelectorAll('input[name="depth"]').forEach((el) => el.addEventListener("change", note));
  note();
  document.querySelectorAll('input[name="persona"],input[name="spice"],input[name="depth"],#anon').forEach((el) => el.addEventListener("change", saveSettings));
}

// ---------- capabilities ----------
async function connect() {
  const c = window.claude;
  if (!c || typeof c.use !== "function") {
    state.ai = "off"; state.aiOffReason = "outside";
  } else {
    const [sample, downloads] = await Promise.all([c.use("sample").catch(() => null), c.use("downloads").catch(() => null)]);
    state.sample = sample; state.downloads = downloads;
    state.ai = sample ? "ready" : "off";
    if (!sample) state.aiOffReason = "unavailable";
  }
  $("#ai-text").innerHTML = aiLabel();
  if (state.chat && !state.caseFile) renderInterrogateCard();
}
function aiLabel() {
  if (state.ai === "checking") return "Connecting to Claude…";
  if (state.ai === "ready") return '<span class="free">FREE</span> The investigation runs on your Claude account.';
  return "Free stats work here. Open this page on claude.ai to unlock the investigation.";
}

// ---------- file handling ----------
async function readFiles(fileList) {
  const out = [];
  for (const f of fileList) {
    if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
      if (!window.JSZip) throw new Error("Couldn't load the zip reader. Unzip the file and drop the .txt instead.");
      const zip = await window.JSZip.loadAsync(f);
      const entries = Object.values(zip.files).filter((e) => !e.dir && /\.(txt|json)$/i.test(e.name) && !/__MACOSX/.test(e.name));
      for (const e of entries) {
        let name = e.name.split("/").pop();
        if (/^_chat\.txt$/i.test(name)) name = f.name.replace(/\.zip$/i, ".txt");
        out.push({ name, text: await e.async("string") });
      }
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
    setStep(1); await tick();
    const chat = parseFiles(files);
    const stats = computeStats(chat);
    if (stats.totalMessages < 10 || stats.people.length < 2) throw new Error("This chat is too small to investigate. We need at least 10 messages from 2 people.");
    setStep(2); await sleep(400);
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
  caseBar.setTitle(`Case: ${chat.title}`);
  $("#case-meta").textContent = `${stats.totalMessages.toLocaleString()} messages · ${stats.people.length} suspects · ${chat.source}`;
  $("#ai-sections").innerHTML = "";
  renderInterrogateCard();
  $("#stats-sections").innerHTML = renderStats(stats);
  buildJump();
  caseBar.reset();
  window.scrollTo({ top: 0 });
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
    <p class="note">${esc(note)}</p>
    ${errorMsg ? `<p class="note" style="color:#ffb3b9">⚠️ ${esc(errorMsg)}</p>` : ""}
  </div>
  <div style="display:grid;gap:10px">
    <button class="btn primary big" type="button" id="go" ${disabled ? "disabled" : ""}>Start investigation</button>
    <button class="btn small" type="button" id="change-opts">Change investigator</button>
  </div>
</div>`;
  $("#go").addEventListener("click", () => startInvestigation());
  $("#change-opts").addEventListener("click", () => { goLanding(); document.getElementById("raid").scrollIntoView({ behavior: "smooth" }); });
}

function buildJump() {
  const ids = [...document.querySelectorAll("#ai-sections section, #stats-sections section")].map((s) => [s.id, s.querySelector("h2")?.textContent || s.id]);
  const short = { focus: "Speciality", verdict: "Verdict", suspects: "Mugshots", ships: "Ships & beefs", unsaid: "Unsaid", awards: "Awards", fixit: "Fix-it", evidence: "Evidence", final: "Final", lineup: "Who talks most", interest: "Who likes who", badges: "Badges", web: "String board", activity: "Activity", speed: "Reply speed", words: "Words" };
  $("#jump").innerHTML = ids.map(([id, t]) => `<a href="#${id}">${esc(short[id] || t)}</a>`).join("");
}

function goLanding() {
  $("#report").hidden = true;
  $("#landing").hidden = false;
}

// ---------- the investigation ----------
const MAX_BYTES = 240_000;
const bytes = (s) => new TextEncoder().encode(s).length;

function buildPrompt(s, anon, budget) {
  const transcript = buildTranscript(state.chat, state.stats, { anon, budget });
  const stats = statsForAi(state.stats, anon ? anon.name : (n) => n);
  return `${buildSystemPrompt({ persona: s.persona, spice: s.spice })}

FORMAT
Reply with only one JSON object, no other text, matching this JSON Schema exactly (every property is required):
${JSON.stringify(CASE_SCHEMA)}

${buildUserMessage({ stats, transcript })}`;
}

function normalise(cf) {
  if (!cf || typeof cf !== "object" || !Array.isArray(cf.suspects)) throw { code: "invalid_json" };
  for (const k of ["pairs", "unsaid", "awards", "exhibits", "timeline", "fix_it", "share_lines"]) if (!Array.isArray(cf[k])) cf[k] = [];
  if (!cf.relationship_mix || typeof cf.relationship_mix !== "object") cf.relationship_mix = {};
  for (const k of ["case_title", "classification", "one_liner", "raid_summary", "final_verdict"]) cf[k] = String(cf[k] ?? "");
  return cf;
}

const ERROR_COPY = {
  rate_limited: "Claude is busy or you've hit your usage limit. Try again in a little while.",
  session_expired: "Your Claude session expired. Sign in again, then try once more.",
  refused: "Claude declined to analyse this chat. The free stats below still work.",
  invalid_json: "The case file came back garbled. Tap Start investigation to try again.",
  empty_completion: "Claude returned an empty case file. Try again, or try a smaller chat.",
  prompt_too_large: "This chat is too big to send. Try exporting a shorter period.",
  upstream_error: "The connection to Claude dropped. Try again.",
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
    const anon = s.anon ? makeNameMap(state.stats.people) : null;
    let budget = 150_000, prompt = buildPrompt(s, anon, budget);
    while (bytes(prompt) > MAX_BYTES && budget > 20_000) { budget = Math.floor(budget * 0.75); prompt = buildPrompt(s, anon, budget); }
    setStep(1);
    let started = false;
    let cf = await state.sample.json(prompt, {
      signal: state.ctl.signal,
      model: DEPTHS[s.depth].model,
      modelTier: DEPTHS[s.depth].tier,
      onText: ({ text }) => {
        if (!started) { started = true; setStep(3); }
        $("#ov-progress").textContent = `${text.length.toLocaleString()} characters of evidence written…`;
      },
    });
    cf = normalise(cf);
    if (anon) cf = restoreDeep(cf, anon.restore);
    showCase(cf);
  } catch (e) {
    const code = e?.code || "upstream_error";
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
  showCase(SAMPLE_CASE);
  if (s.persona !== DEFAULT_PERSONA || s.spice !== "spicy") toast("The sample is pre-written by Sherlock. Your own chats get the investigator you pick.", 4500);
}

function showCase(cf) {
  state.caseFile = cf;
  $("#interrogate-wrap").innerHTML = "";
  $("#ai-sections").innerHTML = renderCase(cf, state.stats);
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
  const blob = await makeShareCard(state.caseFile, { blurNames: false });
  if (state.downloads) {
    try {
      await state.downloads.save({ filename: "fbi-open-up-case.png", data: blob });
      toast("Saved the share card. Post it to your story!");
      return;
    } catch (e) {
      if (e?.code === "declined") return;
    }
  }
  // Fallback: show the card so the viewer can long-press or right-click to save it.
  const url = URL.createObjectURL(blob);
  $("#card-img").src = url;
  $("#card-modal").hidden = false;
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
  $("#new-raid").addEventListener("click", () => { goLanding(); window.scrollTo({ top: 0 }); });
  $("#share-btn").addEventListener("click", doShare);
  $("#ov-stop").addEventListener("click", () => state.ctl?.abort());
  $("#card-close").addEventListener("click", () => { $("#card-modal").hidden = true; });

  $("#report").addEventListener("click", async (e) => {
    const tr = e.target.closest(".translate, .redact");
    if (tr) { tr.classList.toggle("open"); tr.setAttribute("aria-expanded", tr.classList.contains("open")); return; }
    const act = e.target.closest("[data-action]")?.dataset.action;
    if (act === "share") doShare();
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
