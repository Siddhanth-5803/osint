# Common Mistakes

**CRITICAL - Read at session start**

---

## Top 5 Critical Mistakes

### 1. Real chat data or names ending up in the repo or the public page

**Symptom**: a real name (even in a code comment or placeholder) appears in `dist/*.html` or a commit. The artifact link is public.
**Check**: `grep -c "<real name>" dist/*.html public/js/*.js server/*.js README.md` before every publish.
**Fix**: the user's chats live only in the scratchpad folder. Use made-up names (Meera, Aarav, Zoya) in code, tests and examples.

### 2. Forgetting to rebuild and republish

**Symptom**: the claude.ai page does not show a change.
**Check**: `dist/` is generated. Any edit under `public/js`, `public/styles.css`, `public/index.html`, `artifact/` or `server/prompt.js` needs a rebuild.
**Fix**: `npm run build:artifact`, then publish `dist/fbi-open-up.html` to the existing artifact URL (never create a new one).

### 3. Changing the case-file shape in only one place

**Symptom**: the page crashes or a section is blank after the AI replies.
**Check**: the format lives in `public/js/schema.js` (shared by server, artifact and tests). Structured output needs every property required and `additionalProperties: false`.
**Fix**: also update `sample.js`, `report.js` and `casefile.js` tests. Replies must always go through `parseCaseJson` then `coerceCase`.

### 4. Message ids: plain vs prefixed

**Symptom**: a receipt shows the wrong message.
**Check**: `#12` is the main chat; `B#12`, `C#12`... are context chats. Never strip the letter.
**Fix**: look ids up with the chat map (`chatMap` in `evidence.js`), as `receiptsHtml` does.

### 5. Class and selector collisions in the one shared stylesheet

**Symptom**: an icon or element picks up another component's styling, or a test grabs the wrong element.
**Check**: the landing page and the report share `public/styles.css`. `.bag` is the luggage icon; the evidence panel is `.ebag`.
**Fix**: use specific class names and check both the landing page and the report.

---

**Last Updated**: 2026-11-17
