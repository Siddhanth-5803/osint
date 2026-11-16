// "Who are you in this chat?" — the uploader picks their name and can leave the investigator a note.
import { esc } from "./report.js";

const OUTSIDER = "__outsider__";
const read = (k, d) => { try { return localStorage.getItem("fbi:" + k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem("fbi:" + k, v); } catch { /* storage blocked */ } };

// current: { me, outsider, note } kept by the page between re-renders.
export function askerHtml(people, current = {}) {
  const names = people.slice(0, 60).map((p) => p.name);
  const remembered = read("me", "");
  const me = current.me ?? (names.includes(remembered) ? remembered : "");
  const value = current.outsider ? OUTSIDER : me;
  const options = [
    `<option value="">Pick your name (optional)</option>`,
    ...names.map((n) => `<option value="${esc(n)}" ${n === value ? "selected" : ""}>${esc(n)}</option>`),
    `<option value="${OUTSIDER}" ${value === OUTSIDER ? "selected" : ""}>I'm not in this chat</option>`,
  ].join("");
  return `<div class="asker">
  <label for="asker-me">Who are you in this chat?
    <select id="asker-me">${options}</select>
  </label>
  <label for="asker-note">Anything the investigator should know? <small>Optional: who you are to them, who you like, what happened.</small>
    <textarea id="asker-note" maxlength="500" placeholder="e.g. I'm Aarav. Zoya is my crush. Kabir and I had a fight last week.">${esc(current.note || "")}</textarea>
  </label>
</div>`;
}

// Reads the fields and remembers the chosen name for next time.
export function readAsker() {
  const sel = document.getElementById("asker-me");
  const note = (document.getElementById("asker-note")?.value || "").trim().slice(0, 500);
  const v = sel?.value || "";
  const outsider = v === OUTSIDER;
  const me = outsider ? "" : v;
  if (me) write("me", me);
  return { me, outsider, note };
}
