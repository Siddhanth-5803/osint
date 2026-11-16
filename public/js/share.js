// Draws a 1080x1920 story card and offers it to share or save.
const NAVY = "#101a3a", TAPE = "#ffd23f", RED = "#ff4e5b", BLUE = "#3168ff", SKY = "#bfe5ff", PINK = "#ff8fc7";

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function box(ctx, x, y, w, h, r, fill, shadow = 14) {
  ctx.fillStyle = NAVY;
  ctx.beginPath(); ctx.roundRect(x + shadow, y + shadow, w, h, r); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = NAVY; ctx.stroke();
}

export async function makeShareCard(cf, { blurNames = false } = {}) {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1920;
  const ctx = c.getContext("2d");
  const hide = (s) => {
    if (!blurNames) return s;
    let out = String(s);
    (cf.suspects || []).forEach((p, i) => { out = out.split(p.name).join(`Suspect ${String.fromCharCode(65 + i)}`); });
    return out;
  };

  ctx.fillStyle = SKY; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = "rgba(16,26,58,.08)";
  for (let y = 20; y < 1920; y += 44) for (let x = 20; x < 1080; x += 44) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
  ctx.fillStyle = RED; ctx.fillRect(0, 0, 540, 26);
  ctx.fillStyle = BLUE; ctx.fillRect(540, 0, 540, 26);

  ctx.textBaseline = "top";
  ctx.fillStyle = NAVY;
  ctx.font = "800 150px 'Bricolage Grotesque', 'Arial Black', sans-serif";
  ctx.fillStyle = RED; ctx.fillText("FBI,", 80, 110);
  ctx.lineWidth = 6; ctx.strokeStyle = NAVY; ctx.strokeText("FBI,", 80, 110);
  ctx.fillStyle = NAVY; ctx.fillText("OPEN UP!", 80, 260);

  // tape
  ctx.save(); ctx.translate(540, 500); ctx.rotate(-0.12);
  ctx.fillStyle = TAPE; ctx.fillRect(-700, -42, 1400, 84);
  ctx.fillRect(-700, -42, 1400, 6);
  ctx.strokeStyle = NAVY; ctx.lineWidth = 6; ctx.strokeRect(-700, -42, 1400, 84);
  ctx.fillStyle = NAVY; ctx.font = "700 36px 'Space Mono', monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.fillText("CHAT EVIDENCE • DO NOT CROSS • CHAT EVIDENCE • DO NOT CROSS", 0, 2);
  ctx.restore();
  ctx.textAlign = "left"; ctx.textBaseline = "top";

  // title
  ctx.font = "800 64px 'Bricolage Grotesque', 'Arial Black', sans-serif";
  ctx.fillStyle = NAVY;
  let y = 640;
  for (const l of wrap(ctx, hide(cf.case_title), 920).slice(0, 3)) { ctx.fillText(l, 80, y); y += 76; }

  // one-liner box
  y += 30;
  ctx.font = "800 58px 'Bricolage Grotesque', 'Arial Black', sans-serif";
  const ol = wrap(ctx, `“${hide(cf.one_liner)}”`, 840).slice(0, 5);
  const bh = ol.length * 70 + 80;
  box(ctx, 80, y, 920, bh, 30, TAPE);
  let ty = y + 40;
  ctx.fillStyle = NAVY;
  for (const l of ol) { ctx.fillText(l, 120, ty); ty += 70; }
  y += bh + 60;

  // meters
  const meter = (label, val, color, yy) => {
    ctx.font = "700 40px 'Outfit', sans-serif"; ctx.fillStyle = NAVY; ctx.fillText(label, 80, yy);
    ctx.font = "700 40px 'Space Mono', monospace"; ctx.textAlign = "right"; ctx.fillText(`${val}%`, 1000, yy); ctx.textAlign = "left";
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(80, yy + 60, 920, 46, 23); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = NAVY; ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(83, yy + 63, Math.max(30, 914 * val / 100), 40, 20); ctx.fill();
  };
  meter("🌪️ Chaos level", Math.round(cf.chaos_level || 0), RED, y);
  meter("🛟 Survival odds", Math.round(cf.survival_odds || 0), "#45d9a6", y + 150);
  y += 320;

  // top roles
  ctx.font = "700 40px 'Outfit', sans-serif";
  for (const s of (cf.suspects || []).slice(0, 4)) {
    if (y > 1680) break;
    ctx.fillStyle = NAVY;
    const t = `${s.role_emoji || "•"} ${hide(s.name)}: ${s.role}`;
    ctx.fillText(wrap(ctx, t, 920)[0], 80, y);
    y += 62;
  }

  // footer
  box(ctx, 80, 1740, 920, 110, 26, PINK, 10);
  ctx.fillStyle = NAVY; ctx.font = "800 44px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("Get your group chat raided 🚨", 540, 1797);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

export async function shareOrDownload(blob, filename = "fbi-open-up.png") {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "FBI, OPEN UP!" }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
