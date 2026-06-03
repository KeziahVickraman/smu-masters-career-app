import type { Config } from "tailwindcss";

/** Mirrors DESIGN.md token mapping for editors / tooling integration. Tailwind v4 tokens are wired in app/globals.css via @theme. */
const config: Config = {
  theme: {
    extend: {
      colors: {
        background: "#F9F9F9",
        paper: "#F8EFE6",
        "paper-dark": "#E5E1DA",
        surface: "#FFFFFF",
        "surface-muted": "#F3F3F4",
        primary: "#1D1F27",
        "primary-hover": "#05070E",
        accent: "#C22032",
        border: "#C7C6CB",
        "border-strong": "#46464B",
      },
      fontFamily: {
        display: ["Newsreader", "Georgia", "serif"],
        sans: ["Hanken Grotesk", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
};

export default config;
