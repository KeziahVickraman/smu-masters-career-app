import type { Config } from "tailwindcss";

/** Mirrors DESIGN.md token mapping for editors / tooling integration. Tailwind v4 tokens are wired in app/globals.css via @theme. */
const config: Config = {
  theme: {
    extend: {
      colors: {
        background: "#F7F6F3",
        surface: "#FFFFFF",
        "surface-muted": "#EFEFEC",
        primary: "#002147",
        "primary-light": "#1A3A6B",
        accent: "#C8102E",
        border: "#E4E3DF",
        "border-strong": "#C9C8C4",
      },
      fontFamily: {
        display: ["Instrument Serif", "Georgia", "serif"],
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
};

export default config;
