import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "soft";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const styles = {
    primary:
      "text-white bg-brand-grad shadow-glow hover:brightness-110 active:brightness-95",
    soft: "text-ink bg-surface2 border border-line hover:bg-line/60",
    ghost: "text-muted hover:text-ink hover:bg-surface2",
  }[variant];
  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      whileHover={{ y: disabled ? 0 : -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
        active
          ? "bg-brand-grad text-white border-transparent shadow-glow"
          : "bg-surface2 text-muted border-line hover:text-ink hover:border-brand-soft/50"
      }`}
    >
      {children}
    </motion.button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-2xl shadow-card ${className}`}>{children}</div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </span>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? "w-7 bg-brand-grad"
              : i < current
              ? "w-3 bg-brand-soft/70"
              : "w-3 bg-line"
          }`}
        />
      ))}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-xl bg-brand-grad shadow-glow"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <path d="M8 5v14l11-7L8 5z" fill="white" />
        </svg>
      </div>
      <span className="text-lg font-extrabold tracking-tight">
        Reel<span className="text-gradient">io</span>
      </span>
    </div>
  );
}
