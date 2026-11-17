# CLAUDE.md

**Quick-start guide for Claude Code - Complete details in linked docs**

---

## Project Overview

"FBI, OPEN UP!": a funny forensic analyser for exported chats (WhatsApp, Telegram, Instagram). Parses on the device, then Claude writes a case file. Ships as a Node website and as a one-click Claude artifact.

**Tech Stack**: Node 20+ (no framework, ESM), vanilla JS front end, `@anthropic-ai/sdk`, Razorpay (optional), `node:test`

---

## Session Start Protocol ⚡

**MANDATORY** at start of each session:

```bash
# Load essential docs (~800 tokens - 2 min read)
✓ .claude/COMMON_MISTAKES.md      # ⚠️ CRITICAL - Read FIRST
✓ .claude/QUICK_START.md          # Essential commands
✓ .claude/ARCHITECTURE_MAP.md     # File locations
```

**At task completion:**
- Create completion doc in `.claude/completions/YYYY-MM-DD-task-name.md`
- Move session file to `.claude/sessions/archive/` (if created)

**⚠️ NEVER auto-load:**
- Files in `.claude/completions/` (0 token cost)
- Files in `.claude/sessions/` (0 token cost)
- Files in `docs/archive/` (0 token cost)

---

## Quick Start Commands

```bash
npm install
npm start                     # website on :3000 (needs ANTHROPIC_API_KEY in .env, or MOCK_AI=1)
npm test                      # unit tests
npm run build:artifact        # rebuild dist/ (then republish dist/fbi-open-up.html to the SAME artifact URL)
```

---

**Last Updated**: 2026-11-17
**Optimized with**: [Claude Token Optimizer](https://github.com/nadimtuhin/claude-token-optimizer)
