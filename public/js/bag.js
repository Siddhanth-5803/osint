// The evidence bag panel, used on the landing page (before the report) and on the interrogation card.
// A "target" t is any object { bag, mainId, userAliases }: the landing stage or the open case.
import { esc } from "./report.js";
import { MAX_CONTEXT, NOT_SAME, analysePeople, sourceName, isGroup, readUploads, parseUploads, addToBag, pickMain } from "./evidence.js";

const ACCEPT = ".zip,.txt,.json,application/zip,text/plain,application/json";

// opts.fileId: id of the hidden file input (must be unique on the page). opts.light: for the white landing card.
export function bagHtml(t, { fileId = "bag-file", light = false, removeLast = false } = {}) {
  const { bag, mainId, userAliases = {} } = t;
  if (!bag.length) return "";
  const multi = bag.length > 1;
  const rows = bag.map((b) => {
    const isMain = b.id === mainId;
    const kind = isGroup(b) ? "group" : "private chat";
    const meta = `${esc(sourceName(b.chat.source))} · ${esc(kind)} · ${b.stats.totalMessages.toLocaleString()} msgs · ${b.stats.people.length} people`;
    return `<div class="bag-row${isMain ? " is-main" : ""}">
  ${multi ? `<label class="bag-pick"><input type="radio" name="bag-main-${esc(fileId)}" value="${esc(b.id)}" ${isMain ? "checked" : ""}><span>${isMain ? "Main chat" : "Context"}</span></label>` : `<span class="bag-tag">Main chat</span>`}
  <span class="bag-name"><b>${esc(b.chat.title)}</b><small>${meta}</small></span>
  ${multi || removeLast ? `<button class="bag-x" type="button" data-remove="${esc(b.id)}" aria-label="Remove ${esc(b.chat.title)}">✕</button>` : ""}
</div>`;
  }).join("");

  let alias = "";
  if (multi) {
    const { mainNames, auto, unmatched } = analysePeople(bag, mainId, userAliases);
    const autoLine = auto.length ? `<p class="bag-auto">Matched automatically: ${auto.map(([a, c]) => `${esc(a)} → ${esc(c)}`).join(", ")}</p>` : "";
    const selects = unmatched.map((u) => `<label class="bag-alias-row"><span>${esc(u.name)} <small>(${u.messages} msgs)</small></span>
  <select data-alias="${esc(u.name)}"><option value="">Not sure / someone else</option>${mainNames.map((n) => `<option value="${esc(n)}" ${userAliases[u.name] === n ? "selected" : ""}>Same as ${esc(n)}</option>`).join("")}</select></label>`).join("");
    const count = Object.keys(userAliases).length;
    alias = `<details class="bag-alias">
  <summary>Same person under another name?${unmatched.length ? ` <small>(${unmatched.length} to check${count ? `, ${count} linked` : ""})</small>` : ""}</summary>
  ${autoLine}${selects || '<p class="bag-auto">Everyone in the extra chats is matched or already in the main chat.</p>'}
</details>`;
  }

  const room = bag.length < MAX_CONTEXT + 1;
  const hint = multi
    ? "Pick the main chat. The others add context."
    : "Optional: drop more chats of any kind (groups, private chats, other apps). More context gives a better picture.";
  return `<div class="ebag${light ? " light" : ""}">
  <div class="bag-head"><b>📚 Evidence bag <small>(${bag.length} of ${MAX_CONTEXT + 1})</small></b><small>${hint}</small></div>
  ${rows}
  ${room ? `<label class="btn small yellow bag-add" for="${esc(fileId)}">➕ Drop more chats (optional)</label><input type="file" id="${esc(fileId)}" accept="${ACCEPT}" multiple hidden>` : `<small class="bag-full">The bag is full: the main chat plus ${MAX_CONTEXT} extra chats.</small>`}
  ${alias}
</div>`;
}

// handlers: { onAdd(fileList), onRemove(id), onMain(id), onAlias(name, choice) }
export function bindBag(root, handlers, fileId = "bag-file") {
  const file = root.querySelector("#" + fileId);
  file?.addEventListener("change", () => { const files = file.files; if (files?.length) handlers.onAdd(files); file.value = ""; });
  root.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => handlers.onRemove(b.dataset.remove)));
  root.querySelectorAll(`input[name="bag-main-${fileId}"]`).forEach((r) => r.addEventListener("change", () => handlers.onMain(r.value)));
  root.querySelectorAll("select[data-alias]").forEach((sel) => sel.addEventListener("change", () => handlers.onAlias(sel.dataset.alias, sel.value || NOT_SAME)));
}

// ---------- shared actions (work on any target) ----------
// ui: { begin(), step(n), end(), toast(msg) } so each page can show its own overlay.
export async function addFilesTo(t, fileList, ui, JSZip) {
  if (!fileList?.length) return 0;
  ui.begin();
  try {
    ui.step(0);
    const { groups, errors } = await readUploads(fileList, JSZip);
    ui.step(1);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    const { items, errors: more } = parseUploads(groups);
    const { bag, notes } = addToBag(t.bag, items);
    const added = bag.length - t.bag.length;
    const wasEmpty = t.bag.length === 0;
    t.bag = bag;
    if (added && (wasEmpty || !bag.some((b) => b.id === t.mainId))) { t.mainId = pickMain(bag); t.userAliases = {}; }
    const problems = [...errors, ...more, ...notes];
    if (added) ui.toast(`Added ${added} chat${added > 1 ? "s" : ""} to the bag.${problems.length ? ` Skipped: ${problems.join(" · ")}` : ""}`, 7000);
    else ui.toast(problems.join(" · ") || "Nothing new to add.", 7000);
    return added;
  } catch (err) {
    console.error(err);
    ui.toast("Couldn't read that file. Try exporting it again.", 5000);
    return 0;
  } finally {
    ui.end();
  }
}

// Returns true when the main chat changed.
export function removeFrom(t, id) {
  t.bag = t.bag.filter((b) => b.id !== id);
  if (t.mainId === id || !t.bag.some((b) => b.id === t.mainId)) {
    t.mainId = t.bag.length ? pickMain(t.bag) : null;
    t.userAliases = {};
    return true;
  }
  return false;
}

export function setMainOf(t, id) {
  if (id === t.mainId || !t.bag.some((b) => b.id === id)) return false;
  t.mainId = id; t.userAliases = {};
  return true;
}
