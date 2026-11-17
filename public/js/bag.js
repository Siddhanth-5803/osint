// The evidence bag panel shown on the interrogation card.
import { esc } from "./report.js";
import { MAX_CONTEXT, NOT_SAME, analysePeople, sourceName } from "./evidence.js";

const ACCEPT = ".zip,.txt,.json,application/zip,text/plain,application/json";

export function bagHtml({ bag, mainId, userAliases = {} }) {
  if (!bag.length) return "";
  const multi = bag.length > 1;
  const rows = bag.map((b) => {
    const isMain = b.id === mainId;
    const meta = `${esc(sourceName(b.chat.source))} · ${b.stats.totalMessages.toLocaleString()} messages · ${b.stats.people.length} people`;
    return `<div class="bag-row${isMain ? " is-main" : ""}">
  ${multi ? `<label class="bag-pick"><input type="radio" name="bag-main" value="${esc(b.id)}" ${isMain ? "checked" : ""}><span>${isMain ? "Main chat" : "Context"}</span></label>` : `<span class="bag-tag">Main chat</span>`}
  <span class="bag-name"><b>${esc(b.chat.title)}</b><small>${meta}</small></span>
  ${multi ? `<button class="bag-x" type="button" data-remove="${esc(b.id)}" aria-label="Remove ${esc(b.chat.title)}">✕</button>` : ""}
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
  return `<div class="ebag">
  <div class="bag-head"><b>📚 Evidence bag</b><small>${multi ? "Pick the main chat. The others add context." : "Optional: add chats from other apps to give the investigator more context."}</small></div>
  ${rows}
  ${room ? `<label class="btn small yellow bag-add" for="bag-file">➕ Add another chat (optional)</label><input type="file" id="bag-file" accept="${ACCEPT}" multiple hidden>` : `<small class="bag-full">The bag is full: the main chat plus ${MAX_CONTEXT} extra chats.</small>`}
  ${alias}
</div>`;
}

// handlers: { onAdd(fileList), onRemove(id), onMain(id), onAlias(name, choice) }
export function bindBag(root, handlers) {
  const file = root.querySelector("#bag-file");
  file?.addEventListener("change", () => { const files = file.files; if (files?.length) handlers.onAdd(files); file.value = ""; });
  root.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => handlers.onRemove(b.dataset.remove)));
  root.querySelectorAll('input[name="bag-main"]').forEach((r) => r.addEventListener("change", () => handlers.onMain(r.value)));
  root.querySelectorAll("select[data-alias]").forEach((sel) => sel.addEventListener("change", () => handlers.onAlias(sel.dataset.alias, sel.value || NOT_SAME)));
}
