import { motion } from "framer-motion";
import {
  Sparkles,
  Wand2,
  Music4,
  LayoutGrid,
  Captions,
  Share2,
  ArrowRight,
} from "lucide-react";
import { Button, Eyebrow, Card, Logo } from "./ui";
import ReelPlayer from "./ReelPlayer";

const DEMO = {
  bpm: 112,
  beatsPerSlide: 2,
  grade: "cinematic" as const,
  transition: "crossfade" as const,
  title: "Golden Hour",
  seed: 5,
};

const FEATURES = [
  { icon: Wand2, title: "AI auto-edit", body: "Describe a vibe, get a finished cut. No timeline required." },
  { icon: Music4, title: "Beat-synced", body: "Cuts land on the beat automatically, every time." },
  { icon: LayoutGrid, title: "Every format", body: "Reels, Stories, posts and carousels from one upload." },
  { icon: Captions, title: "Captions + tags", body: "On-brand captions and hashtags generated for you." },
  { icon: Sparkles, title: "3 versions", body: "Pick the best from multiple AI variants — no guessing." },
  { icon: Share2, title: "Export anywhere", body: "Download platform-ready video in a tap." },
];

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted sm:flex">
          <a className="hover:text-ink" href="#features">Features</a>
          <a className="hover:text-ink" href="#how">How it works</a>
          <Button variant="soft" onClick={onStart}>Open studio</Button>
        </nav>
      </header>

      <section className="grid items-center gap-10 pt-10 md:grid-cols-2 md:pt-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Eyebrow>
              <Sparkles size={14} className="text-brand-soft" /> AI Reel Studio
            </Eyebrow>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Photos in.
            <br />
            <span className="text-gradient">Scroll-stopping reels</span> out.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-5 max-w-md text-lg text-muted"
          >
            Upload your media, pick a vibe, and Reelio edits a beat-synced reel
            for you — captions, transitions and all. Three versions, in seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button onClick={onStart} className="px-6 py-3.5 text-base">
              Create a reel <ArrowRight size={18} />
            </Button>
            <span className="text-sm text-muted">No sign-up to try · runs in your browser</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, type: "spring", stiffness: 120, damping: 16 }}
          className="mx-auto w-full max-w-[300px] md:justify-self-end"
        >
          <div className="animate-float">
            <ReelPlayer images={[]} config={DEMO} width={300} height={534} />
          </div>
        </motion.div>
      </section>

      <section id="features" className="mt-28">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Everything you'd hire an editor for
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          Reelio handles the tedious parts so you just pick the vibe and post.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            >
              <Card className="h-full p-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-grad-soft text-brand-soft">
                  <f.icon size={20} />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="how" className="mt-28">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          From camera roll to reel in 4 steps
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            ["Upload", "Drop in photos and clips."],
            ["Pick a vibe", "Choose a theme, mood and track."],
            ["Generate", "AI builds beat-synced variants."],
            ["Export", "Download or share, ready to post."],
          ].map(([t, b], i) => (
            <Card key={t} className="p-5">
              <div className="text-sm font-bold text-brand-soft">
                Step {i + 1}
              </div>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </Card>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button onClick={onStart} className="px-7 py-4 text-base">
            Open the studio <ArrowRight size={18} />
          </Button>
        </div>
      </section>
    </div>
  );
}
