/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0b0b11",
        surface: "#15151f",
        surface2: "#1d1d2a",
        line: "#2a2a3a",
        ink: "#f4f4f8",
        muted: "#9a9ab0",
        brand: { DEFAULT: "#8b5cf6", soft: "#a78bfa" },
        accent: "#22d3ee",
        hot: "#f472b6",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.35), 0 18px 60px -12px rgba(139,92,246,0.45)",
        card: "0 12px 40px -16px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "brand-grad": "linear-gradient(135deg,#8b5cf6 0%,#f472b6 60%,#22d3ee 130%)",
        "brand-grad-soft":
          "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(244,114,182,0.12),rgba(34,211,238,0.14))",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
