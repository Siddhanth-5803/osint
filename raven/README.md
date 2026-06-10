# Raven OSINT Collector (runnable)

A working, native implementation of Project Raven's open-internet collection — **no
third-party AI, no paid APIs, no API keys**. It uses only offline parsing and public
internet endpoints, and it reports **only what it actually retrieves** (no fabricated
values). Intended for lawful use, including checking your *own* public exposure.

## Install & run

```bash
pip install -r raven/requirements.txt

python -m raven.cli phone    "+91 98992 94332"
python -m raven.cli email    you@example.com
python -m raven.cli username your_handle
python -m raven.cli auto     "+91 98992 94332"
python -m raven.cli scan --phone "..." --email "..." --username "..." --json
```

## What each collector does (and does not)

| Collector | Technique | Reveals | Does NOT |
|-----------|-----------|---------|----------|
| `phone` | offline libphonenumber metadata | validity, region, carrier (original allocation), line type, timezone | call/ping the number or identify the subscriber |
| `email` | regex + DNS/MX + public Gravatar | syntax validity, domain deliverability, public Gravatar profile if one exists, username candidates | log in, send mail, or read any mailbox |
| `username` | self-calibrating public-profile presence | sites where a profile can be *reliably distinguished* from a control | bypass logins or scrape private data |

## Honesty by design

- **Self-calibrating presence**: each site is probed with the real handle *and* a
  random non-existent control handle in parallel. A "found" is recorded only when the
  real response differs meaningfully from the control. Anti-bot single-page sites that
  return HTTP 200 for any path are reported as **inconclusive**, never as a match.
  This eliminates the false positives a naive status-code check produces.
- **No fabrication**: absent data is reported as "nothing found", never guessed.
- **Provenance + confidence** on every finding.

## Limitations

- Major platforms (Instagram, X, TikTok, etc.) actively block server-side checks;
  presence there often cannot be confirmed without their official API or a
  headless-browser connector. The tool says so rather than guessing.
- Carrier reflects the number's *original* allocation and may differ after porting.
- Breach/credential exposure requires a lawful breach feed (none bundled); add one as
  a connector per `docs/16-connector-framework.md`.
