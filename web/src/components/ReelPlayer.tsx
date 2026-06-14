import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { drawFrame, loopDuration, type ReelConfig } from "../lib/reel";

interface Props {
  images: string[]; // object URLs
  config: ReelConfig;
  width?: number;
  height?: number;
  autoplay?: boolean;
  onCanvasReady?: (c: HTMLCanvasElement) => void;
  className?: string;
}

// Loads images once and runs a requestAnimationFrame loop drawing the reel.
export default function ReelPlayer({
  images,
  config,
  width = 540,
  height = 960,
  autoplay = true,
  onCanvasReady,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(performance.now());
  const pausedAtRef = useRef<number>(0);
  const [playing, setPlaying] = useState(autoplay);
  const [pulse, setPulse] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // load images when the list changes
  useEffect(() => {
    let cancelled = false;
    const list = (images.length ? images : [PLACEHOLDER]).map((src) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = src;
      return im;
    });
    Promise.all(
      list.map(
        (im) =>
          new Promise<void>((res) => {
            if (im.complete) return res();
            im.onload = () => res();
            im.onerror = () => res();
          })
      )
    ).then(() => {
      if (!cancelled) {
        imgsRef.current = list;
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    if (canvasRef.current && onCanvasReady) onCanvasReady(canvasRef.current);
  }, [onCanvasReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dur = loopDuration(config, imgsRef.current.length) * 1000;
    startRef.current = performance.now() - pausedAtRef.current;

    const render = () => {
      const now = playing
        ? (performance.now() - startRef.current) % dur
        : pausedAtRef.current % dur;
      const info = drawFrame(
        ctx,
        imgsRef.current,
        config,
        now / 1000,
        canvas.width,
        canvas.height
      );
      setPulse(1 - info.beatPhase);
      if (playing) {
        pausedAtRef.current = now;
        rafRef.current = requestAnimationFrame(render);
      }
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [config, playing, loaded]);

  return (
    <div className={`relative ${className}`}>
      <div
        className="relative overflow-hidden rounded-[26px] border border-line bg-black shadow-card"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="h-full w-full"
        />
        {/* beat pulse ring */}
        <div
          className="pointer-events-none absolute right-3 top-3 h-3 w-3 rounded-full bg-hot"
          style={{
            transform: `scale(${1 + pulse * 0.9})`,
            opacity: 0.5 + pulse * 0.5,
            boxShadow: `0 0 ${8 + pulse * 16}px rgba(244,114,182,0.9)`,
            transition: "transform 60ms linear",
          }}
        />
        {/* play/pause */}
        <button
          onClick={() => setPlaying((p) => !p)}
          className="absolute inset-0 grid place-items-center bg-black/0 transition-colors hover:bg-black/10"
        >
          <span
            className={`grid h-14 w-14 place-items-center rounded-full bg-black/45 backdrop-blur transition-opacity ${
              playing ? "opacity-0 hover:opacity-100" : "opacity-100"
            }`}
          >
            {playing ? (
              <Pause className="text-white" size={22} />
            ) : (
              <Play className="ml-0.5 text-white" size={22} />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

// 1x1 transparent-ish placeholder gradient when no media yet.
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='540' height='960'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#8b5cf6'/><stop offset='0.6' stop-color='#f472b6'/>
      <stop offset='1' stop-color='#22d3ee'/></linearGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/></svg>`
  );
