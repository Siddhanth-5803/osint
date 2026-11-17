# Quick Start Commands

---

## Development

```bash
npm install
cp .env.example .env            # add ANTHROPIC_API_KEY, or set MOCK_AI=1 for a fake roast
npm start                       # http://localhost:3000
MOCK_AI_FILE=case.json npm start   # serve a saved case file instead of calling Claude
```

## Tests and build

```bash
npm test                        # node --test test/*.test.js
npm run build:artifact          # writes dist/fbi-open-up.html and dist/fbi-open-up-offline.html
```

## Access modes (env)

`ACCESS_MODE=free | promo_only | paid`, `PROMO_CODES=A,B`, `ALLOWED_DEPTHS=quick,standard,deep`, `MAX_READ_CHARS=600000`.

---

**Last Updated**: 2026-11-17
