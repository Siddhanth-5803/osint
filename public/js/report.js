// Turns stats and the AI case file into HTML.
import { humanDuration } from "./stats.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => `${Math.round(x * 100)}%`;
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const PALETTE = ["#ff8fc7", "#45d9a6", "#a998ff", "#ffd23f", "#ff9f45", "#7fc8ff", "#ff4e5b", "#b6e36b", "#f7a6ff", "#5ad1e0", "#ffb3a7", "#c9b8ff"];
export const colorFor = (i) => PALETTE[i % PALETTE.length];
const initials = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] || "").join("").toUpperCase();

const section = (id, label, title, sub, body) => `
<section class="section" id="${id}">
  <div class="section-head"><span class="label">${label}</span><h2>${title}</h2>${sub ? `<p class="muted">${sub}</p>` : ""}</div>
  ${body}
</section>`;

// ---------------- AI case file ----------------
export function renderCase(cf, stats) {
  const people = new Map(stats.people.map((p, i) => [p.name.toLowerCase(), { ...p, idx: i }]));
  const findP = (n) => people.get(String(n || "").toLowerCase());
  const parts = [];

  const mix = cf.relationship_mix || {};
  const mixRows = [["friends", "Friends", "#45d9a6"], ["crush", "Crush", "#ff8fc7"], ["lovers", "Lovers", "#ff4e5b"], ["situationship", "Situationship", "#a998ff"], ["rivalry", "Rivalry", "#ff9f45"], ["family", "Family", "#ffd23f"], ["work", "Work", "#7fc8ff"]]
    .filter(([k]) => (mix[k] || 0) > 0)
    .sort((a, b) => (mix[b[0]] || 0) - (mix[a[0]] || 0))
    .map(([k, l, c]) => `<div class="r"><span>${l}</span><div class="bar"><i style="width:${clamp(mix[k])}%;background:${c}"></i></div><span>${clamp(mix[k])}%</span></div>`).join("");

  parts.push(`
<section class="section" id="verdict">
  <div class="card verdict">
    <div>
      <span class="label">Case file · ${esc(cf.chat_type === "one_on_one" ? "one-on-one" : "group chat")}</span>
      <h2 style="margin-top:8px">${esc(cf.case_title)}</h2>
      <p class="class">Classified as: ${esc(cf.classification)}</p>
      <p class="oneliner">“${esc(cf.one_liner)}”</p>
      <p class="summary">${esc(cf.raid_summary)}</p>
      ${cf.safety_note ? `<p class="callout" style="margin-top:14px">💛 ${esc(cf.safety_note)}</p>` : ""}
      ${cf.minors_suspected ? `<p class="callout" style="margin-top:14px;background:#e4f4ff">This chat looks like it includes people under 18, so romance analysis is switched off.</p>` : ""}
      <span class="stamp">RAIDED</span>
    </div>
    <div class="gauges">
      <div class="gauge"><div class="top"><span>🌪️ Chaos level</span><span>${clamp(cf.chaos_level)}%</span></div><div class="meter"><i style="width:${clamp(cf.chaos_level)}%"></i></div><small>${esc(cf.chaos_label)}</small></div>
      <div class="gauge"><div class="top"><span>🛟 Survival odds</span><span>${clamp(cf.survival_odds)}%</span></div><div class="meter green"><i style="width:${clamp(cf.survival_odds)}%"></i></div><small>${esc(cf.survival_reason)}</small></div>
      <div class="gauge"><div class="top"><span>🧪 What this chat really is</span></div><div class="mix" style="margin-top:10px">${mixRows}</div><small style="margin-top:10px">${esc(cf.group_purpose)}</small></div>
    </div>
  </div>
</section>`);

  const fr = cf.focus_report;
  if (fr && Array.isArray(fr.items) && fr.items.length) {
    const files = fr.items.map((it, i) => `
<article class="file">
  <span class="file-tab">FILE ${String(i + 1).padStart(2, "0")}</span>
  <h3>${esc(it.title)}</h3>
  <p>${esc(it.body)}</p>
  <p class="fverdict">⚖️ ${esc(it.verdict)}</p>
  ${(it.evidence || []).length ? `<small class="mono muted">Evidence: ${esc(it.evidence.join(", "))}</small>` : ""}
</article>`).join("");
    parts.push(section("focus", "Speciality report", esc(fr.title || "The investigator's report"), esc(fr.intro || ""), `<div class="files">${files}</div>`));
  }

  const mugs = (cf.suspects || []).map((s, i) => {
    const p = findP(s.name);
    const color = colorFor(p ? p.idx : i);
    const t = s.traits || {};
    const traitRow = (k, label) => `<div class="trait"><span>${label}</span><div class="bar"><i style="width:${clamp(t[k])}%"></i></div><span>${clamp(t[k])}</span></div>`;
    const chips = p ? `<div class="statchips"><span>${pct(p.share)} of msgs</span><span>reply ${humanDuration(p.medianReply)}</span><span>${p.starts} convo starts</span>${p.deleted ? `<span>${p.deleted} deleted</span>` : ""}</div>` : "";
    return `
<article class="mug">
  <div class="mug-top">
    <div class="avatar" style="background:${color}">${esc(s.role_emoji || initials(s.name))}</div>
    <div class="placard"><b>${esc(s.name)}</b><span>SUSPECT #${String(i + 1).padStart(3, "0")} · ${esc(s.confidence || "")} confidence</span></div>
  </div>
  <div class="mug-body">
    <div><div class="role">${esc(s.role)}</div><p class="caption">${esc(s.mugshot_caption)}</p></div>
    <div class="charges">${(s.charges || []).map((c) => `<span>⚖️ ${esc(c)}</span>`).join("")}</div>
    <button class="translate" type="button" aria-expanded="false">
      <span class="said"><small>What they type</small>“${esc(s.what_they_type)}”</span>
      <span class="hint">tap to translate 🔍</span>
      <span class="meant"><small>What they mean</small>${esc(s.what_they_mean)}</span>
    </button>
    <div class="kv"><small>Inner monologue</small><p>💭 ${esc(s.inner_monologue)}</p></div>
    <div class="kv"><small>The tell</small><p>🔎 ${esc(s.tell)}</p></div>
    <div class="roast"><small>THE ROAST</small>${esc(s.roast)}</div>
    <div class="good"><b>Redeeming quality:</b> ${esc(s.redeeming_quality)}</div>
    <div class="kv"><small>Texting style</small><p>${esc(s.texting_style)}</p></div>
    <div class="traits">${traitRow("chaos", "Chaos")}${traitRow("loyalty", "Loyalty")}${traitRow("drama", "Drama")}${traitRow("braincells", "Braincells")}${traitRow("rizz", "Rizz")}</div>
    ${chips}
  </div>
</article>`;
  }).join("");
  parts.push(section("suspects", "The lineup", "Mugshots", "Everyone's real role in this chat, whether they admit it or not.", `<div class="mugs">${mugs}</div>`));

  const TYPE = { besties: ["👯", "#45d9a6"], crush: ["💘", "#ff8fc7"], couple: ["💑", "#ff4e5b"], situationship: ["🌀", "#a998ff"], rivals: ["⚔️", "#ff9f45"], frenemies: ["🙃", "#ffd23f"], siblings_energy: ["👊", "#7fc8ff"], hype_duo: ["📣", "#b6e36b"], parent_child: ["🧸", "#f7a6ff"], work_spouse: ["💼", "#5ad1e0"], strangers: ["🧍", "#e4f4ff"] };
  const pairs = (cf.pairs || []).map((p) => {
    const [emo, col] = TYPE[p.type] || ["🔗", "#e4f4ff"];
    return `
<div class="pair">
  <div class="names">${esc(p.a)} ${emo} ${esc(p.b)}</div>
  <span class="lbl" style="background:${col}">${esc(p.label)}</span>
  <p>${esc(p.summary)}</p>
  <div class="two">
    <div><small>Warmth ${clamp(p.warmth)}</small><div class="mini"><i style="width:${clamp(p.warmth)}%;background:#45d9a6"></i></div></div>
    <div><small>Tension ${clamp(p.tension)}</small><div class="mini"><i style="width:${clamp(p.tension)}%;background:#ff4e5b"></i></div></div>
  </div>
  <small class="mono">Puts in more effort: <b>${esc(p.who_invests_more)}</b> · <span class="conf ${esc(p.confidence)}">${esc(p.confidence)}</span></small>
</div>`;
  }).join("");
  if (pairs) parts.push(section("ships", "Ships & beefs", "Who's what to whom", "", `<div class="pairs">${pairs}</div>`));

  const unsaid = (cf.unsaid || []).map((u, i) => `
<button class="redact" type="button" aria-expanded="false">
  <span class="top"><span class="label">Classified #${i + 1} · tap to declassify</span><span class="conf ${esc(u.confidence)}">${esc(u.confidence)}</span></span>
  <span class="txt">${esc(u.finding)}</span>
</button>`).join("");
  if (unsaid) parts.push(section("unsaid", "Top secret", "The unsaid", "Things everyone in this chat knows and nobody says.", `<div class="unsaid">${unsaid}</div>`));

  const awards = (cf.awards || []).map((a) => `<div class="award"><b>${esc(a.emoji || "🏆")}</b><h3>${esc(a.title)}</h3><span class="w">${esc(a.winner)}</span><p>${esc(a.reason)}</p></div>`).join("");
  if (awards) parts.push(section("awards", "Awards night", "And the award goes to…", "", `<div class="awards">${awards}</div>`));

  const fixes = (cf.fix_it || []).map((f, i) => `<div class="fix"><span class="n">${i + 1}</span><div><p class="p">${esc(f.problem)}</p><p>${esc(f.fix)}</p><small>For: ${esc(f.for_whom)}</small></div></div>`).join("");
  if (fixes) parts.push(section("fixit", "Agent's recommendations", "The fix-it plan", "If you actually want things to get better, start here.", `<div class="fixes">${fixes}</div>`));

  const ex = (cf.exhibits || []).map((e, i) => `<div class="exhibit"><span class="tag">Exhibit ${String.fromCharCode(65 + i)} · ${esc(e.msg_id)} · ${esc(e.speaker)}</span><q>${esc(e.quote)}</q><p>${esc(e.why)}</p></div>`).join("");
  const tl = (cf.timeline || []).map((t) => `<div class="tl"><small>${esc(t.date)}</small><b>${esc(t.title)}</b><p>${esc(t.what_happened)}</p></div>`).join("");
  parts.push(section("evidence", "Evidence locker", "Exhibits & timeline", "", `<div class="two-col"><div class="stack">${ex}</div><div class="card"><div class="timeline">${tl}</div></div></div>`));

  parts.push(`
<section class="section" id="final">
  <div class="card final">
    <span class="label">Final verdict</span>
    <h2>${esc(cf.final_verdict)}</h2>
    <span class="stamp">GUILTY</span>
    <div class="actions"><button class="btn primary" type="button" data-action="share">📸 Make share card</button><button class="btn" type="button" data-action="copy">📋 Copy the roast</button></div>
  </div>
</section>`);
  return parts.join("");
}

// ---------------- Free stats ----------------
export function renderStats(stats, cf = null) {
  const parts = [];
  const maxShare = Math.max(...stats.people.map((p) => p.share), 0.01);
  const lineup = stats.people.slice(0, 15).map((p, i) => `
<div class="lu"><span class="n" title="${esc(p.name)}">${esc(p.name)}</span><div class="bar"><i style="width:${(p.share / maxShare) * 100}%;background:${colorFor(i)}"></i></div><span class="v">${p.messages.toLocaleString()} · ${pct(p.share)}</span></div>`).join("");
  const more = stats.people.length > 15 ? `<p class="muted" style="margin-top:8px">+ ${stats.people.length - 15} quieter people</p>` : "";
  parts.push(section("lineup", "Free forensics", "Who talks the most", `${stats.totalMessages.toLocaleString()} messages from ${stats.people.length} people${stats.range ? `, ${stats.range.from} to ${stats.range.to}` : ""}.`, `<div class="card lineup">${lineup}${more}</div>`));

  if (stats.interest) {
    const it = stats.interest;
    parts.push(section("interest", "One-on-one", "Who's more into who?", "Based on message count, who starts conversations, message length, double texts and reply speed.", `
<div class="card interest">
  <div class="split"><div style="width:${it.aScore}%">${esc(it.a)} ${it.aScore}%</div><div style="width:${it.bScore}%">${it.bScore}% ${esc(it.b)}</div></div>
  <p class="muted" style="margin-top:10px">${esc(it.a)} replies in ${humanDuration(it.aReply)} on average. ${esc(it.b)} replies in ${humanDuration(it.bReply)}.</p>
</div>`));
  }

  const badges = stats.badges.map((b) => `<div class="bdg"><b>${b.emoji}</b><div><strong>${esc(b.title)}</strong><span class="who">${esc(b.winner)}</span><p>${esc(b.desc)}</p></div></div>`).join("");
  if (badges) parts.push(section("badges", "Rap sheet", "Badges, earned the hard way", "", `<div class="badges">${badges}</div>`));

  parts.push(section("web", "Red string board", "Who talks to whom", "Thicker string means they reply to each other within five minutes more often.", `<div class="web">${webSvg(stats, cf)}</div>`));

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxH = Math.max(...stats.heat.flat(), 1);
  let heat = `<span></span>${Array.from({ length: 24 }, (_, h) => `<span class="h">${h % 3 === 0 ? h : ""}</span>`).join("")}`;
  stats.heat.forEach((row, d) => {
    heat += `<span>${days[d]}</span>` + row.map((v, h) => `<span class="c" title="${days[d]} ${h}:00 · ${v} msgs" style="background:rgba(49,104,255,${(0.06 + (v / maxH) * 0.94).toFixed(2)})"></span>`).join("");
  });
  const sil = stats.silences[0];
  const facts = [
    stats.peak.count > 0 ? [`${stats.peak.day} ${fmtHour(stats.peak.hour)}`, "Peak chaos hour"] : null,
    stats.busiestDay ? [`${stats.busiestDay.count} msgs`, `Busiest day: ${stats.busiestDay.day}`] : null,
    sil ? [humanDuration(sil.ms), `Longest silence (${sil.from} → ${sil.to}), broken by ${sil.brokenBy}`] : null,
    stats.spikes[0] ? [`${stats.spikes[0].day}`, `"The incident": ${stats.spikes[0].count} messages in one day`] : null,
  ].filter(Boolean).map(([b, s]) => `<div class="fact"><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join("");
  parts.push(section("activity", "Surveillance log", "When this chat is awake", "", `<div class="card"><div class="heat-wrap"><div class="heat">${heat}</div></div></div><div class="facts" style="margin-top:14px">${facts}</div>`));

  const top8 = stats.people.slice(0, 8);
  const pairMap = new Map(stats.pairs.map((x) => [x.from + "\u0000" + x.to, x]));
  const rows = top8.map((r) => `<tr><th scope="row">${esc(r.name)}</th>${top8.map((c) => {
    if (c.name === r.name) return `<td class="num">—</td>`;
    const x = pairMap.get(c.name + "\u0000" + r.name);
    return `<td class="num">${x && x.replies >= 3 ? humanDuration(x.medianReply) : "·"}</td>`;
  }).join("")}</tr>`).join("");
  if (top8.length > 1) {
    parts.push(section("speed", "Interrogation timing", "Reply speed", "How long each person (row) takes to reply to each other person (column). Lower means keener.", `
<div class="tbl-wrap"><table><thead><tr><th>replier ↓ / to →</th>${top8.map((c) => `<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`));
  }

  const words = stats.topWords.map((w) => `<span>${esc(w.w)} <small class="mono">${w.c}</small></span>`).join("");
  const emojis = stats.topEmojis.map((e) => `<span>${esc(e.e)} <small class="mono">${e.c}</small></span>`).join("");
  const perPerson = stats.people.slice(0, 10).map((p) => `<tr><th scope="row">${esc(p.name)}</th><td>${esc(p.topEmojis.join(" ") || "·")}</td><td>${esc(p.topWords.slice(0, 4).join(", ") || "·")}</td><td class="num">${p.avgWords.toFixed(1)}</td><td class="num">${pct(p.nightRate)}</td><td class="num">${pct(p.questionRate)}</td></tr>`).join("");
  parts.push(section("words", "Wiretap", "Favourite words & emojis", "", `
<div class="two-col">
  <div class="card"><span class="label">Group's top words</span><div class="wordcloud" style="margin-top:10px">${words || "<span>·</span>"}</div></div>
  <div class="card"><span class="label">Group's top emojis</span><div class="wordcloud" style="margin-top:10px">${emojis || "<span>·</span>"}</div></div>
</div>
<div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>Person</th><th>Emojis</th><th>Words</th><th>Words/msg</th><th>Night</th><th>Questions</th></tr></thead><tbody>${perPerson}</tbody></table></div>`));

  return parts.join("");
}

function fmtHour(h) {
  const s = h % 12 === 0 ? 12 : h % 12;
  return `${s} ${h < 12 ? "a.m." : "p.m."}`;
}

function webSvg(stats, cf) {
  const people = stats.people.slice(0, 10);
  const W = 640, H = 460, cx = W / 2, cy = H / 2, R = people.length <= 2 ? 150 : 175;
  const pos = new Map(people.map((p, i) => {
    const a = -Math.PI / 2 + (i / people.length) * Math.PI * 2;
    return [p.name, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), i }];
  }));
  const edges = new Map();
  for (const x of stats.pairs) {
    if (!pos.has(x.from) || !pos.has(x.to)) continue;
    const k = [x.from, x.to].sort().join("\u0000");
    edges.set(k, (edges.get(k) || 0) + x.quick);
  }
  const list = [...edges.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 18);
  const maxW = Math.max(...list.map(([, w]) => w), 1);
  const aiLabel = new Map((cf?.pairs || []).map((p) => [[p.a, p.b].sort().join("\u0000"), p.label]));
  const lines = list.map(([k, w]) => {
    const [a, b] = k.split("\u0000").map((n) => pos.get(n));
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#ff4e5b" stroke-width="${(1.2 + (w / maxW) * 7).toFixed(1)}" stroke-linecap="round" opacity="${(0.35 + (w / maxW) * 0.65).toFixed(2)}"/>`;
  }).join("");
  // Place AI labels along their string, nudging them to avoid other labels and the name tags.
  const taken = people.flatMap((p) => {
    const { x, y } = pos.get(p.name);
    const r = 18 + p.share * 40;
    const nameW = Math.min(14, p.name.length) * 8 + 8;
    return [{ x: x - r, y: y - r, w: 2 * r, h: 2 * r }, { x: x - nameW / 2, y: y + r + 4, w: nameW, h: 20 }];
  });
  const hit = (a) => taken.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  const labels = list.filter(([k]) => aiLabel.has(k)).map(([k]) => {
    const [a, b] = k.split("\u0000").map((n) => pos.get(n));
    const raw = aiLabel.get(k);
    const text = raw.length > 22 ? raw.slice(0, 21) + "…" : raw;
    const w = text.length * 7.4 + 16, h = 22;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const spots = [];
    for (const off of [0, 16, -16, 30, -30]) for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) spots.push([t, off]);
    for (const [t, off] of spots) {
      const mx = a.x + (b.x - a.x) * t + nx * off, my = a.y + (b.y - a.y) * t + ny * off;
      const rect = { x: mx - w / 2, y: my - h / 2, w, h };
      if (rect.x < 4 || rect.x + w > W - 4 || hit(rect)) continue;
      taken.push(rect);
      return `<g><rect x="${rect.x.toFixed(1)}" y="${rect.y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="6" fill="#ffd23f" stroke="#101a3a" stroke-width="2"/><text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" text-anchor="middle" font-family="Space Mono, monospace" font-size="11" fill="#101a3a">${esc(text)}</text></g>`;
    }
    return "";
  }).join("");
  const nodes = people.map((p) => {
    const { x, y, i } = pos.get(p.name);
    const name = esc(p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name);
    const r = 18 + p.share * 40;
    return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colorFor(i)}" stroke="#101a3a" stroke-width="3"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-family="Bricolage Grotesque, Arial, sans-serif" font-weight="800" font-size="15" fill="#101a3a">${esc(initials(p.name))}</text><text x="${x.toFixed(1)}" y="${(y + r + 18).toFixed(1)}" text-anchor="middle" font-family="Outfit, Arial, sans-serif" font-weight="700" font-size="14" fill="#101a3a">${name}</text></g>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Network of who replies to whom">${lines}${labels}${nodes}</svg>`;
}

// Plain-text roast for copying.
export function roastText(cf) {
  const lines = [`🚨 FBI, OPEN UP! — ${cf.case_title}`, `"${cf.one_liner}"`, "", `Chaos level: ${clamp(cf.chaos_level)}% · Survival odds: ${clamp(cf.survival_odds)}%`, ""];
  for (const s of cf.suspects || []) lines.push(`${s.role_emoji || "•"} ${s.name}: ${s.role}. ${s.roast}`);
  lines.push("", `Verdict: ${cf.final_verdict}`);
  return lines.join("\n");
}
