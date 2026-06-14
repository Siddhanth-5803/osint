// The reel renderer: a deterministic beat-synced slideshow drawn to a canvas.
// Given the same config + time it always produces the same frame, which is what
// makes preview and export match (the "EDL" idea from the blueprint, in-browser).

import type { Grade, Transition } from "./presets";

export interface ReelConfig {
  bpm: number;
  beatsPerSlide: number;
  grade: Grade;
  transition: Transition;
  title: string;
  seed: number; // varies Ken Burns direction per variant
}

export interface Variant {
  id: string;
  name: string;
  config: ReelConfig;
}

function rand(seed: number) {
  // tiny deterministic PRNG
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Build 3 distinct variants from one base config.
export function buildVariants(base: ReelConfig): Variant[] {
  const transitions: Transition[] = ["crossfade", "zoom", "cut", "slide"];
  return [
    {
      id: "v1",
      name: "Smooth",
      config: { ...base, transition: "crossfade", seed: base.seed + 1 },
    },
    {
      id: "v2",
      name: "Punchy",
      config: {
        ...base,
        transition: "cut",
        beatsPerSlide: Math.max(1, base.beatsPerSlide - 1),
        seed: base.seed + 7,
      },
    },
    {
      id: "v3",
      name: "Dynamic",
      config: {
        ...base,
        transition: transitions[(base.seed + 2) % transitions.length],
        seed: base.seed + 13,
      },
    },
  ];
}

const GRADES: Record<
  Grade,
  { filter: string; wash: [number, number, number, number]; vignette: number; letterbox: boolean }
> = {
  cinematic: { filter: "contrast(1.12) saturate(1.05)", wash: [20, 60, 90, 0.18], vignette: 0.55, letterbox: true },
  aesthetic: { filter: "contrast(0.98) saturate(1.1) brightness(1.04)", wash: [255, 200, 220, 0.12], vignette: 0.25, letterbox: false },
  vibrant: { filter: "contrast(1.18) saturate(1.5) brightness(1.03)", wash: [255, 120, 200, 0.06], vignette: 0.2, letterbox: false },
  warm: { filter: "contrast(1.08) saturate(1.2) sepia(0.12)", wash: [255, 150, 80, 0.14], vignette: 0.35, letterbox: false },
  mono: { filter: "grayscale(0.85) contrast(1.05) brightness(0.96)", wash: [120, 130, 160, 0.1], vignette: 0.5, letterbox: false },
  dreamy: { filter: "contrast(0.95) saturate(1.15) brightness(1.06) blur(0.4px)", wash: [200, 180, 255, 0.16], vignette: 0.3, letterbox: false },
};

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Draw an image to fully cover the target rect (object-fit: cover) with an
// optional scale/offset for the Ken Burns effect.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  scale: number,
  panX: number,
  panY: number,
  alpha: number
) {
  if (!img.complete || img.naturalWidth === 0) return;
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = w / h;
  let dw = w * scale;
  let dh = h * scale;
  if (ir > tr) dw = dh * ir;
  else dh = dw / ir;
  const dx = (w - dw) / 2 + panX * (dw - w) * 0.5;
  const dy = (h - dh) / 2 + panY * (dh - h) * 0.5;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.globalAlpha = 1;
}

export interface FrameInfo {
  beat: number;
  beatPhase: number; // 0..1 within current beat (for pulse)
  slideIndex: number;
}

// Render a single frame. Returns timing info (used to drive a beat pulse UI).
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  cfg: ReelConfig,
  t: number,
  w: number,
  h: number
): FrameInfo {
  const beatDur = 60 / cfg.bpm;
  const slideDur = beatDur * cfg.beatsPerSlide;
  const n = Math.max(1, images.length);
  const beat = t / beatDur;
  const beatPhase = beat - Math.floor(beat);

  const slidePos = t / slideDur;
  const slideIndex = Math.floor(slidePos) % n;
  const nextIndex = (slideIndex + 1) % n;
  const within = slidePos - Math.floor(slidePos); // 0..1 through this slide

  const grade = GRADES[cfg.grade];
  const r = rand(cfg.seed + slideIndex * 31);
  const dir = r() > 0.5 ? 1 : -1;
  const dir2 = r() > 0.5 ? 1 : -1;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = grade.filter;

  // Ken Burns for current slide
  const kb = 1.06 + within * 0.08;
  const pan = within * 0.5 * dir;
  const pan2 = within * 0.3 * dir2;

  // transition window near the end of the slide
  const tw = 0.18; // 18% of slide spent transitioning
  const inTransition = within > 1 - tw;
  const tp = inTransition ? easeInOut((within - (1 - tw)) / tw) : 0;

  if (cfg.transition === "cut") {
    drawCover(ctx, images[slideIndex], w, h, kb, pan, pan2, 1);
  } else if (cfg.transition === "crossfade") {
    drawCover(ctx, images[slideIndex], w, h, kb, pan, pan2, 1);
    if (inTransition) drawCover(ctx, images[nextIndex], w, h, 1.06, 0, 0, tp);
  } else if (cfg.transition === "zoom") {
    drawCover(ctx, images[slideIndex], w, h, kb + tp * 0.25, pan, pan2, 1 - tp);
    if (inTransition) drawCover(ctx, images[nextIndex], w, h, 1.3 - tp * 0.24, 0, 0, tp);
  } else {
    // slide
    ctx.save();
    ctx.translate(-tp * w, 0);
    drawCover(ctx, images[slideIndex], w, h, kb, pan, pan2, 1);
    ctx.restore();
    if (inTransition) {
      ctx.save();
      ctx.translate((1 - tp) * w, 0);
      drawCover(ctx, images[nextIndex], w, h, 1.06, 0, 0, 1);
      ctx.restore();
    }
  }
  ctx.restore();

  // color wash
  const [wr, wg, wb, wa] = grade.wash;
  ctx.fillStyle = `rgba(${wr},${wg},${wb},${wa})`;
  ctx.fillRect(0, 0, w, h);

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // letterbox bars
  if (grade.letterbox) {
    const bar = h * 0.07;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
  }

  // title overlay (animated up on first slide, persistent lower-third otherwise)
  drawTitle(ctx, cfg.title, w, h, t, beatPhase);

  // progress bar (segments per slide)
  drawProgress(ctx, w, h, n, slideIndex, within);

  return { beat, beatPhase, slideIndex };
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  w: number,
  h: number,
  t: number,
  beatPhase: number
) {
  if (!title) return;
  const intro = Math.min(1, t / 0.6);
  const y = h * 0.8 + (1 - easeInOutLocal(intro)) * 40;
  const pulse = 1 + (1 - beatPhase) * 0.03;
  ctx.save();
  ctx.globalAlpha = intro;
  ctx.translate(w / 2, y);
  ctx.scale(pulse, pulse);
  const fs = Math.round(w * 0.072);
  ctx.font = `800 ${fs}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 18;
  ctx.lineWidth = fs * 0.16;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.strokeText(title, 0, 0);
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, "#c4b5fd");
  grad.addColorStop(0.55, "#f9a8d4");
  grad.addColorStop(1, "#67e8f9");
  ctx.fillStyle = grad;
  ctx.fillText(title, 0, 0);
  ctx.restore();
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  n: number,
  idx: number,
  within: number
) {
  const pad = w * 0.04;
  const gap = w * 0.012;
  const top = h * 0.035;
  const segW = (w - pad * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = pad + i * (segW + gap);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRect(ctx, x, top, segW, 5, 3);
    ctx.fill();
    const fill = i < idx ? 1 : i === idx ? within : 0;
    if (fill > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRect(ctx, x, top, segW * fill, 5, 3);
      ctx.fill();
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeInOutLocal(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Total loop duration so playback/export can loop cleanly.
export function loopDuration(cfg: ReelConfig, slides: number): number {
  const beatDur = 60 / cfg.bpm;
  return beatDur * cfg.beatsPerSlide * Math.max(1, slides);
}
