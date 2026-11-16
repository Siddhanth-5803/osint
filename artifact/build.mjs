// Builds the one-click version of FBI, OPEN UP! from the same source as the site.
//   node artifact/build.mjs
// Output:
//   dist/fbi-open-up.html          the page published as a Claude artifact (one link, AI included)
//   dist/fbi-open-up-offline.html  the same page as a standalone file (double-click; free stats only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---- 1. bundle the ES modules into one classic script ----
const modules = new Map(); // abs path -> { id, code, deps }
let counter = 0;

function load(abs) {
  if (modules.has(abs)) return modules.get(abs);
  const src = fs.readFileSync(abs, "utf8");
  const id = `__m${counter++}_${path.basename(abs, ".js").replace(/\W/g, "_")}`;
  const entry = { id, code: "", deps: [] };
  modules.set(abs, entry);
  const exportsList = [];
  let code = src.replace(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?\s*$/gm, (_, names, spec) => {
    const dep = load(path.resolve(path.dirname(abs), spec));
    entry.deps.push(dep);
    const binding = names.split(",").map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ": ")).join(", ");
    return `const { ${binding} } = ${dep.id};`;
  });
  if (/^\s*import\s/m.test(code)) throw new Error(`Unsupported import form in ${abs}`);
  code = code.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exportsList.push(name);
    return `${kind} ${name}`;
  });
  if (/^\s*export\s/m.test(code)) throw new Error(`Unsupported export form in ${abs}`);
  entry.code = `const ${id} = (() => {\n${code}\nreturn { ${exportsList.join(", ")} };\n})();\n`;
  return entry;
}

const entryAbs = path.join(ROOT, "artifact/app.js");
load(entryAbs);
const ordered = [];
const seen = new Set();
(function visit(m) {
  if (seen.has(m)) return;
  seen.add(m);
  m.deps.forEach(visit);
  ordered.push(m);
})(modules.get(entryAbs));
const bundle = `(() => {\n"use strict";\n${ordered.map((m) => m.code).join("\n")}\n})();`;

// ---- 2. page markup from the site's index.html, adapted for one-click use ----
const index = read("public/index.html");
let body = index.slice(index.indexOf("<body>") + 6, index.indexOf("</body>"));
const swap = (from, to) => {
  if (!body.includes(from)) throw new Error(`build: markup changed, cannot find: ${from.slice(0, 70)}`);
  body = body.replace(from, to);
};
swap('        <button class="btn small yellow" type="button" id="promo-btn">🎟️ Promo code</button>\n', "");
swap('<span id="price-text"></span>', '<span id="ai-text"></span>');
swap("Nothing is uploaded until you start the interrogation.", "Nothing leaves this page until you start the investigation.");
swap(
  body.slice(body.indexOf("<!-- promo / paywall modal -->"), body.indexOf('<div class="toast"')),
  `<!-- share card fallback -->
<div class="modal" id="card-modal" hidden role="dialog" aria-modal="true" aria-labelledby="card-title">
  <div class="card">
    <h3 id="card-title">📸 Your share card</h3>
    <p class="muted">Long-press (phone) or right-click (computer) the image to save it.</p>
    <img id="card-img" alt="Share card for this case" style="width:100%;border:3px solid var(--navy);border-radius:12px">
    <div class="row"><button class="btn" type="button" id="card-close">Close</button></div>
  </div>
</div>

`,
);
swap('    <div class="steps" id="ov-steps"></div>\n', '    <div class="steps" id="ov-steps"></div>\n    <p class="mono" id="ov-progress" aria-live="polite"></p>\n    <button class="btn" type="button" id="ov-stop" hidden>Stop</button>\n');
body = body.replace(/<script type="module"[^>]*><\/script>\s*/, "");
body = body.replace(/<script src="https:\/\/cdnjs[^"]+jszip[^"]+"><\/script>\s*/, "");

// The privacy copy changes: the AI runs on the viewer's own Claude account.
body = body.replace(
  /<p>For the AI roast we send a <b>sample<\/b>[^<]*<\/p>/,
  "<p>For the investigation, a <b>sample</b> of messages goes to Claude through <b>your own Claude account</b>, with names swapped for \"Suspect A, B, C\". Numbers and emails are removed.</p>",
);

const css = read("public/styles.css") + `
/* one-click version: the platform already pads the page for phone notches */
body { padding-top: 0; padding-bottom: 0; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 30; background: var(--sky); }
#ai-text .free { background: var(--mint); border: 2px solid var(--navy); border-radius: 8px; padding: 1px 10px; font-family: var(--f-mono); font-size: .85rem; }
#ov-progress { min-height: 1.4em; font-size: .85rem; color: var(--navy-soft); }
`;

const head = `<title>FBI, OPEN UP!</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Drop a WhatsApp, Telegram or Instagram chat export and get a funny forensic case file about everyone in it.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Outfit:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap">
<style>
${css}
</style>`;

const scripts = `<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
${bundle}
</script>`;

fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const artifactPage = `${head}\n${body.trim()}\n${scripts}\n`;
fs.writeFileSync(path.join(ROOT, "dist/fbi-open-up.html"), artifactPage);
fs.writeFileSync(
  path.join(ROOT, "dist/fbi-open-up-offline.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body.trim()}\n${scripts}\n</body>\n</html>\n`,
);
console.log(`built dist/fbi-open-up.html (${(artifactPage.length / 1024).toFixed(0)} KB) and dist/fbi-open-up-offline.html from ${ordered.length} modules`);
