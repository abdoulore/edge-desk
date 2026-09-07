import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        desk: {
          bg: "#0a0e13",
          panel: "#111820",
          elevated: "#161e2a",
          border: "#1c2736",
          accent: "#34c77b",
          "accent-dim": "#1a3d2e",
          warn: "#d4a017",
          down: "#e0544a",
          muted: "#7d8fa8",
          ink: "#e6edf5",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-outfit)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "var(--font-jb-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        desk: "12px",
        "desk-sm": "8px",
        "desk-lg": "16px",
      },
      boxShadow: {
        desk: "0 12px 40px rgba(0, 0, 0, 0.35)",
        "desk-accent": "0 8px 28px rgba(52, 199, 123, 0.18)",
      },
      keyframes: {
        "skeleton-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "skeleton-shimmer 1.6s ease-in-out infinite",
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
