# Raven OSINT Collector (runnable)

A working, native implementation of Project Raven's open-internet collection — **no
third-party AI, no paid APIs, no API keys**. It uses only offline parsing and public
internet endpoints, and it reports **only what it actually retrieves** (no fabricated
values). Intended for lawful use, including checking your *own* public exposure.

## Install & run

```bash
pip install -r raven/requirements.txt

python -m raven.cli phone    "+91 98992 94332"
python -m raven.cli email    you@example.com          # validation + accounts + breach
python -m raven.cli username your_handle
python -m raven.cli domain   example.com              # DNS + RDAP + cert transparency
python -m raven.cli accounts you@example.com          # service-registration probe only
python -m raven.cli breach   you@example.com          # needs offline DB or HIBP key
python -m raven.cli auto     "+91 98992 94332"
python -m raven.cli scan --phone "..." --email "..." --username "..." --domain "..." --json
```

### Breach source (kept free for the operating agency)

```bash
# Option 1 — offline dataset of lawfully obtained breach records (free, air-gap friendly)
export RAVEN_BREACH_DB=/path/to/breaches.json   # {"email": [{name,date,data_classes}, ...]}

# Option 2 — Have I Been Pwned API (optional, paid key)
export RAVEN_HIBP_KEY=xxxxxxxx
```

## What each collector does (and does not)

| Collector | Technique | Reveals | Does NOT |
|-----------|-----------|---------|----------|
| `phone` | offline libphonenumber metadata | validity, region, carrier (original allocation), line type, timezone | call/ping the number or identify the subscriber |
| `email` | regex + DNS/MX + Gravatar + accounts + breach | syntax/deliverability, Gravatar, services the email is registered on, breach exposure | log in, send mail, or read any mailbox |
| `username` | self-calibrating public-profile presence | sites where a profile can be *reliably distinguished* from a control | bypass logins or scrape private data |
| `domain` | DNS + RDAP + crt.sh | DNS records, registrar, registration/expiry dates, nameservers, status, subdomains | port-scan or touch hosts beyond DNS |
| `accounts` | signup/reset response probing (holehe-style) | which services an email is registered on, self-calibrated against a control | complete a reset or abuse recovery flows |
| `breach` | offline dataset or HIBP API | breach names, dates, exposed data classes | display cleartext passwords (gated by approval/audit) |

> **Attribution caveat:** OSINT narrows and corroborates — it rarely *proves* who is
> behind an anonymous account on its own. Definitive identification of a harasser
> almost always requires lawful process (a data request to the platform/telco for
> subscriber and IP records). These collectors produce the leads and public footprint
> that *support* such a request.

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
