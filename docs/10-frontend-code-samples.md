# 10 — Frontend Code Samples

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion. All samples use the
Obsidian Orange tokens from doc 03.

## 1. Tailwind theme tokens

```ts
// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        raven: {
          orange: "#FF6A00", orange2: "#FF8C00", orange3: "#FFA500",
          bg: "#050505", panel: "#0A0A0A", card: "#111111", border: "#202020",
          text: "#F5F5F5", text2: "#B0B0B0",
          success: "#00D26A", warning: "#FFB020", danger: "#FF3B30",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Michroma", "Saira Semi Condensed", "sans-serif"],
      },
      boxShadow: { glow: "0 0 24px rgba(255,106,0,.35)" },
      backdropBlur: { glass: "16px" },
    },
  },
} satisfies Config;
```

## 2. App shell with classification banner + status strip

```tsx
// apps/web/src/app/(app)/layout.tsx
import { NavRail } from "@/components/shell/NavRail";
import { CommandBar } from "@/components/shell/CommandBar";
import { ClassificationBanner } from "@/components/shell/ClassificationBanner";
import { StatusStrip } from "@/components/shell/StatusStrip";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { ParticleField } from "@/components/fx/ParticleField";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-raven-bg text-raven-text">
      <ClassificationBanner />
      <div className="relative flex min-h-0 flex-1">
        <ParticleField className="pointer-events-none absolute inset-0 opacity-[0.06]" />
        <NavRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <CommandBar />
          <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
        </div>
        <CopilotPanel />
      </div>
      <StatusStrip />
    </div>
  );
}
```

## 3. Animated KPI widget (count-up + sparkline + live pulse)

```tsx
// apps/web/src/components/widgets/KpiWidget.tsx
"use client";
import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

export function KpiWidget({ label, value, delta, spark }: {
  label: string; value: number; delta?: number; spark: number[];
}) {
  const mv = useSpring(0, { stiffness: 90, damping: 18 });
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => { mv.set(value); }, [value, mv]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[10px] border border-raven-border bg-raven-card p-4
                 transition-shadow hover:border-raven-orange/40 hover:shadow-glow"
    >
      <div className="font-display text-xs uppercase tracking-[0.12em] text-raven-text2">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <motion.span className="font-display text-4xl text-raven-text">{text}</motion.span>
        {delta != null && (
          <span className={delta >= 0 ? "text-raven-success" : "text-raven-danger"}>
            {delta >= 0 ? "▲" : "▼"}{Math.abs(delta)}
          </span>
        )}
      </div>
      <Sparkline data={spark} />
    </motion.div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${28 - (d / max) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" className="mt-3 h-7 w-full">
      <polyline fill="none" stroke="#FFA500" strokeWidth="1.5" points={pts} opacity={0.8} />
    </svg>
  );
}
```

## 4. Live pulse ring (futuristic effect, reduced-motion aware)

```tsx
// apps/web/src/components/fx/PulseRing.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

export function PulseRing({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  if (!active || reduce) return null;
  return (
    <motion.span
      className="pointer-events-none absolute inset-0 rounded-full border border-raven-orange"
      initial={{ opacity: 0.5, scale: 1 }}
      animate={{ opacity: 0, scale: 1.6 }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
    />
  );
}
```

## 5. Radar sweep (situation-room "live" indicator)

```tsx
// apps/web/src/components/fx/RadarSweep.tsx
"use client";
export function RadarSweep({ size = 220 }: { size?: number }) {
  return (
    <div
      className="relative rounded-full motion-safe:animate-[spin_4s_linear_infinite]"
      style={{
        width: size, height: size,
        background:
          "conic-gradient(from 0deg, rgba(255,106,0,0) 0deg, rgba(255,106,0,0.35) 40deg, rgba(255,106,0,0) 60deg)",
        mask: "radial-gradient(circle, #000 60%, transparent 61%)",
      }}
    />
  );
}
```

## 6. WebGL graph canvas (real-time, infinite zoom)

```tsx
// apps/web/src/components/graph/GraphCanvas.tsx
"use client";
import { useEffect, useRef } from "react";
import Sigma from "sigma";
import Graph from "graphology";
import { useGraphStream } from "@/hooks/useGraph";

const TYPE_COLOR: Record<string, string> = {
  person: "#FF6A00", domain: "#38BDF8", ip: "#A78BFA", organization: "#2DD4BF",
  location: "#A3E635", email: "#FB7185", phone: "#FFB020", username: "#E879F9",
  vehicle: "#A8A29E", device: "#7DD3FC",
};

export function GraphCanvas({ caseId, onSelect }: {
  caseId: string; onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const graph = useRef(new Graph());
  const sigma = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    sigma.current = new Sigma(graph.current, ref.current, {
      renderEdgeLabels: true,
      defaultNodeColor: "#FF6A00",
      labelColor: { color: "#F5F5F5" },
      zIndex: true,
    });
    sigma.current.on("clickNode", ({ node }) => onSelect(node));
    return () => sigma.current?.kill();
  }, [onSelect]);

  // real-time deltas → animate new nodes in with a pulse
  useGraphStream(caseId, (delta) => {
    const g = graph.current;
    for (const n of delta.addNodes ?? []) {
      if (g.hasNode(n.id)) continue;
      g.addNode(n.id, {
        label: n.label, size: 4 + (n.influence ?? 0) * 16,
        color: TYPE_COLOR[n.type] ?? "#FF6A00",
        x: Math.random(), y: Math.random(), _new: true,
      });
    }
    for (const e of delta.addEdges ?? []) {
      if (!g.hasEdge(e.id)) g.addEdgeWithKey(e.id, e.source, e.target,
        { size: Math.max(1, e.weight * 4), color: "#202020" });
    }
    sigma.current?.refresh();
  });

  return <div ref={ref} className="h-full w-full rounded-[10px] border border-raven-border bg-raven-bg" />;
}
```

## 7. AI Copilot panel (streaming, model picker, citations)

```tsx
// apps/web/src/components/copilot/CopilotPanel.tsx
"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCopilot } from "@/hooks/useCopilot";
import { ModelPicker } from "./ModelPicker";
import { CitationChip } from "./CitationChip";

export function CopilotPanel() {
  const { open, toggle, messages, send, streaming, models, model, setModel } = useCopilot();
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 360, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="flex w-[360px] flex-col border-l border-raven-border
                     bg-raven-glass backdrop-blur-glass"
        >
          <header className="flex items-center justify-between border-b border-raven-border p-3">
            <span className="font-display text-sm tracking-[0.12em]">◉ RAVEN AI</span>
            <ModelPicker models={models} value={model} onChange={setModel} />
          </header>

          <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-raven-text" : "text-raven-text2"}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.citations?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.citations.map((c) => <CitationChip key={c.ref} citation={c} />)}
                  </div>
                )}
              </div>
            ))}
            {streaming && <span className="animate-pulse text-raven-orange">▌</span>}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault();
              const f = new FormData(e.currentTarget); send(String(f.get("q"))); e.currentTarget.reset(); }}
            className="border-t border-raven-border p-3"
          >
            <input name="q" placeholder="Ask anything…  /timeline /aliases /report"
              className="w-full rounded-md border border-raven-border bg-raven-card px-3 py-2
                         outline-none focus:border-raven-orange focus:shadow-glow" />
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
```

## 8. Copilot hook (GraphQL subscription streaming)

```ts
// apps/web/src/hooks/useCopilot.ts
import { useState, useCallback } from "react";
import { gqlClient } from "@/lib/graphql/client";

export function useCopilot() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);

  const send = useCallback(async (q: string) => {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: q }]);
    setStreaming(true);
    const { askCopilot } = await gqlClient.request(ASK_COPILOT, { input: { prompt: q } });
    const id = crypto.randomUUID();
    setMessages((m) => [...m, { id, role: "assistant", content: "", citations: [] }]);
    for await (const chunk of gqlClient.subscribe(COPILOT_STREAM, { turnId: askCopilot.turnId })) {
      setMessages((m) => m.map((x) => x.id === id
        ? { ...x, content: x.content + chunk.delta, citations: chunk.citations ?? x.citations } : x));
    }
    setStreaming(false);
  }, []);

  return { send, messages, streaming /* …model picker state, open/toggle… */ } as ReturnType<any>;
}
```

## 9. Entity chip with provenance + confidence

```tsx
// apps/web/src/components/entity/EntityChip.tsx
import { TYPE_GLYPH, TYPE_COLOR } from "@/lib/theme/entities";

export function EntityChip({ e }: { e: { id: string; type: string; label: string; confidence: number; sources: string[] } }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-raven-border bg-raven-card
                     px-2 py-1 text-xs" style={{ borderLeft: `3px solid ${TYPE_COLOR[e.type]}` }}>
      <span aria-hidden>{TYPE_GLYPH[e.type]}</span>
      <span className="font-mono">{e.label}</span>
      <span className="h-1 w-8 overflow-hidden rounded bg-raven-border" title={`confidence ${e.confidence}`}>
        <span className="block h-full bg-raven-orange3/60" style={{ width: `${e.confidence}%` }} />
      </span>
      <span className="text-raven-text2" title={e.sources.join(", ")}>{e.sources.length}⌖</span>
    </span>
  );
}
```

## 10. Live intelligence feed (animated stream)

```tsx
// apps/web/src/components/widgets/IntelFeed.tsx
"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveFeed } from "@/hooks/useLiveFeed";

const TAG = { BREACH: "text-raven-danger", OSINT: "text-raven-orange3",
              TI: "text-raven-warning", CASE: "text-raven-text2" } as const;

export function IntelFeed({ caseId }: { caseId?: string }) {
  const items = useLiveFeed(caseId);
  return (
    <div className="h-full overflow-hidden rounded-[10px] border border-raven-border bg-raven-card">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div key={it.id}
            initial={{ x: -12, opacity: 0, borderLeftColor: "#FF6A00" }}
            animate={{ x: 0, opacity: 1, borderLeftColor: "#202020" }}
            transition={{ duration: 0.3 }}
            className="flex gap-3 border-l-2 px-3 py-2 text-xs">
            <span className="font-mono text-raven-text2">{it.timeZ}</span>
            <span className={`font-display ${TAG[it.tag]}`}>[{it.tag}]</span>
            <span className="text-raven-text">{it.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

## 11. Tactical map (offline-capable basemap)

```tsx
// apps/web/src/components/map/TacticalMap.tsx
"use client";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

export function TacticalMap({ styleUrl = "/tiles/raven-dark/style.json", events }: {
  styleUrl?: string; events: { id: string; lng: number; lat: number; risk: number }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({ container: ref.current, style: styleUrl, center: [0, 20], zoom: 1.6 });
    map.on("load", () => {
      for (const e of events) {
        const el = document.createElement("div");
        el.className = "relative h-3 w-3 rounded-full bg-raven-orange shadow-glow";
        el.style.boxShadow = `0 0 ${4 + e.risk / 6}px rgba(255,106,0,.8)`;
        new maplibregl.Marker({ element: el }).setLngLat([e.lng, e.lat]).addTo(map);
      }
    });
    return () => map.remove();
  }, [styleUrl, events]);
  // styleUrl points to a local offline tile bundle in air-gapped deployments
  return <div ref={ref} className="h-full w-full rounded-[10px] border border-raven-border" />;
}
```

> Note `styleUrl` defaults to a **locally served** tile bundle (`/tiles/...`) so the map works in
> fully air-gapped deployments; an online style URL is used only when a connector enables it.
