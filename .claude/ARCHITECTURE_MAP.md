# Architecture Map

---

## Directory Structure

```
server/            Node server (no framework): index.js routes, analyze.js (Claude call), prompt.js, payments.js, config.js
public/            The website: index.html, styles.css
  js/parser.js       WhatsApp / Telegram / Instagram parsers
  js/stats.js        local stats, badges, name hiding, compact transcripts
  js/evidence.js     the evidence bag: many chats, aliases, what the AI reads
  js/bag.js          evidence bag panel and add/remove/main actions
  js/schema.js       the case-file format (shared)
  js/casefile.js     parse + coerce the AI reply so it can't crash the page
  js/report.js       renders the case file and the free stats
  js/depth.js        depth (model) and reading options
  js/asker.js        "who are you in this chat?"
  js/casebar.js, share.js, sample.js, app.js
artifact/          one-click Claude page: app.js (uses window.claude sample), build.mjs (bundles to dist/)
dist/              GENERATED. Do not edit by hand.
test/              node:test suites
blueprint/         the original design page
```

## Key File Locations

- **Configuration**: `server/config.js`, `.env.example`, `render.yaml`
- **Main entry**: `server/index.js` (website), `artifact/app.js` and `public/js/app.js` (the two front ends: change both)
- **Prompt and personas**: `server/prompt.js`
- **Tests**: `test/*.test.js`

---

**Last Updated**: 2026-11-17
