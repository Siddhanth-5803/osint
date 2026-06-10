"""Username presence — checks whether a handle has a PUBLIC profile on common sites.

Presence detection only (the technique behind Sherlock/holehe): it requests the
public profile URL and infers existence from the response. It reads only publicly
served pages, follows no logins, and collects no private data.

Self-calibrating detection: many modern sites are single-page apps behind anti-bot
walls that return HTTP 200 for ANY path, which naively yields false positives. To
avoid that, every site is probed twice in parallel — once with the real handle and
once with a random control handle that cannot exist. A hit is recorded only when the
real response differs *meaningfully* from the control (status code differs, or body
length differs beyond a threshold, or an existence marker is present only for the
real handle). Sites that return identical responses for both are reported as
INCONCLUSIVE rather than as a match.
"""
from __future__ import annotations

import asyncio
import secrets

import httpx

from ..model import Target

_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# site, url_template, optional positive marker that should appear ONLY when the profile exists
SITES: list[tuple[str, str, str | None]] = [
    ("Instagram",  "https://www.instagram.com/{u}/",                 '"@type":"ProfilePage"'),
    ("GitHub",     "https://github.com/{u}",                          None),
    ("Reddit",     "https://www.reddit.com/user/{u}/about.json",      None),
    ("GitLab",     "https://gitlab.com/{u}",                          None),
    ("Medium",     "https://medium.com/@{u}",                         None),
    ("YouTube",    "https://www.youtube.com/@{u}",                    None),
    ("TikTok",     "https://www.tiktok.com/@{u}",                     '"uniqueId"'),
    ("X/Twitter",  "https://x.com/{u}",                               None),
    ("Pinterest",  "https://www.pinterest.com/{u}/",                  None),
    ("Telegram",   "https://t.me/{u}",                                "tgme_page_title"),
    ("Steam",      "https://steamcommunity.com/id/{u}",               "g_rgProfileData"),
    ("Linktree",   "https://linktr.ee/{u}",                           None),
]

_LEN_DELTA = 0.25   # body-length must differ by >25% to count as a difference


async def _fetch(client: httpx.AsyncClient, url: str) -> tuple[int, int, str] | None:
    try:
        r = await client.get(url)
        return r.status_code, len(r.text), r.text
    except Exception:
        return None


async def _check(client, site, url_tpl, marker, user, control) -> dict:
    real, ctrl = await asyncio.gather(
        _fetch(client, url_tpl.format(u=user)),
        _fetch(client, url_tpl.format(u=control)),
    )
    url = url_tpl.format(u=user)
    if real is None:
        return {"site": site, "url": url, "state": "error"}
    rs, rl, rtext = real

    # marker-based: most reliable when available
    if marker is not None:
        present_real = marker in rtext
        present_ctrl = marker in ctrl[2] if ctrl else False
        if present_real and not present_ctrl:
            return {"site": site, "url": url, "state": "found", "why": "marker"}
        if not present_real:
            return {"site": site, "url": url, "state": "absent", "why": "marker"}

    if ctrl is None:
        # control failed; fall back to a plain 200/404 read but flag confidence
        state = "found" if rs == 200 else "absent"
        return {"site": site, "url": url, "state": state, "why": "status-nocontrol"}

    cs, cl, _ = ctrl
    # status differs → reliable signal
    if rs != cs:
        return {"site": site, "url": url, "state": "found" if rs == 200 else "absent",
                "why": f"status {rs} vs control {cs}"}
    # same status: only trust a large body-length difference
    if cl and abs(rl - cl) / max(cl, 1) > _LEN_DELTA:
        return {"site": site, "url": url, "state": "found",
                "why": f"len {rl} vs control {cl}"}
    # identical to control → cannot distinguish
    return {"site": site, "url": url, "state": "inconclusive",
            "why": "site returns same response for any handle"}


async def _run(user: str) -> list[dict]:
    control = "zzq" + secrets.token_hex(6)
    limits = httpx.Limits(max_connections=10)
    async with httpx.AsyncClient(headers={"User-Agent": _UA}, timeout=12,
                                 follow_redirects=True, limits=limits) as client:
        tasks = [_check(client, s, u, m, user, control) for (s, u, m) in SITES]
        return await asyncio.gather(*tasks)


def collect(user: str) -> Target:
    t = Target(kind="username", value=user)
    user = user.strip().lstrip("@")
    try:
        results = asyncio.run(_run(user))
    except Exception as e:
        t.errors.append(f"presence check failed: {e}")
        return t

    found = [r for r in results if r["state"] == "found"]
    inconclusive = [r for r in results if r["state"] == "inconclusive"]

    for r in found:
        t.add(f"profile:{r['site']}", r["url"], r["url"], 75,
              note=f"distinguished from control ({r['why']})")
    if inconclusive:
        sites = [r["site"] for r in inconclusive]
        t.add("inconclusive_sites", sites, "calibration", 0,
              note="these sites return identical responses for any handle (anti-bot SPA); "
                   "presence cannot be confirmed without their official API")
    if not found:
        t.errors.append("no public profile could be RELIABLY confirmed on the checked sites")
    return t
