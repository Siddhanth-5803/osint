// Makes whatever Claude sends back safe to render.
// 1. parseCaseJson: finds the JSON in the reply, and rescues replies that were cut off.
// 2. coerceCase: walks the schema and forces every field into the expected shape,
//    so a string where a list was expected (or a missing field) can never crash the page.
import { CASE_SCHEMA } from "./schema.js";

// Closes a JSON text that was cut off part-way, keeping every complete element.
export function repairJson(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const src = text.slice(start);
  const stack = [];
  let inStr = false, esc = false;
  let best = null; // { cut, closers }
  const closersFor = (st) => st.slice().reverse().map((c) => (c === "{" ? "}" : "]")).join("");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (!stack.length) return src.slice(0, i + 1); // complete object
      best = { cut: i + 1, closers: closersFor(stack) };
    } else if (ch === "," && stack.length) {
      best = { cut: i, closers: closersFor(stack) }; // everything before this comma is complete
    }
  }
  return best ? src.slice(0, best.cut) + best.closers : null;
}

// Returns the parsed object, or throws { code: "invalid_json" }.
export function parseCaseJson(text) {
  const raw = String(text ?? "");
  const fenced = (raw.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/) || [])[1];
  const tries = [raw, fenced, raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)];
  for (const t of tries) {
    if (!t || !t.trim()) continue;
    try {
      const v = JSON.parse(t);
      if (v && typeof v === "object") return v;
    } catch { /* try the next shape */ }
  }
  for (const t of [fenced, raw]) {
    if (!t) continue;
    const fixed = repairJson(t);
    if (!fixed) continue;
    try {
      const v = JSON.parse(fixed);
      if (v && typeof v === "object") return v;
    } catch { /* not rescuable */ }
  }
  throw { code: "invalid_json" };
}

function coerce(value, schema) {
  switch (schema.type) {
    case "string": {
      let v = value;
      if (v == null) v = "";
      else if (Array.isArray(v)) v = v.filter((x) => x != null && typeof x !== "object").join(", ");
      else if (typeof v === "object") v = "";
      else v = String(v);
      if (schema.enum) {
        const hit = schema.enum.find((e) => e === v || e === v.toLowerCase().replace(/[\s-]+/g, "_"));
        return hit || schema.enum[0];
      }
      return v;
    }
    case "integer":
    case "number": {
      const n = Number(typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }
    case "boolean":
      return value === true || value === "true";
    case "array": {
      let list = value;
      if (list == null || list === "") list = [];
      else if (!Array.isArray(list)) list = [list];
      return list.filter((x) => x != null).map((x) => coerce(x, schema.items));
    }
    case "object": {
      const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const out = {};
      for (const [k, sub] of Object.entries(schema.properties)) out[k] = coerce(src[k], sub);
      return out;
    }
    default:
      return value;
  }
}

// Returns a case file that matches the schema exactly, or throws if there's nothing usable.
export function coerceCase(raw) {
  const cf = coerce(raw, CASE_SCHEMA);
  // Drop list entries that came back completely empty.
  const hasText = (o) => Object.values(o).some((v) => (typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length : false));
  cf.suspects = cf.suspects.filter((s) => s.name.trim());
  for (const k of ["pairs", "unsaid", "awards", "exhibits", "timeline", "fix_it"]) cf[k] = cf[k].filter(hasText);
  cf.focus_report.items = cf.focus_report.items.filter(hasText);
  cf.share_lines = cf.share_lines.filter((x) => x.trim());
  if (!cf.case_title.trim() && !cf.suspects.length && !cf.focus_report.items.length) throw { code: "invalid_json" };
  if (!cf.case_title.trim()) cf.case_title = "Case file";
  return cf;
}
