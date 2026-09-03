import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Livanto Green's own logo colors: green accent, navy headers/sidebar
        // — not a competitor's palette. Every primary button, active nav
        // item, link and focus ring draws from brand-*, so this token is the
        // one place that re-themes the whole CRM at once.
        brand: {
          50: "#eefdf3",
          100: "#d3f8e0",
          200: "#a3efc1",
          300: "#6de29c",
          400: "#3ecb74",
          500: "#1fae54",
          600: "#148a3f",
          700: "#0f6e33",
          800: "#10572b",
          900: "#0f4725",
        },
        // The dark navy from the "livanto" wordmark — used for the sidebar
        // and headings, distinct from the neutral ink-* grays so it reads as
        // an intentional brand color rather than just "dark text."
        navy: {
          50: "#eef1f7",
          100: "#d7deec",
          200: "#adbcd9",
          300: "#7f95bf",
          400: "#51699c",
          500: "#33477a",
          600: "#263660",
          700: "#1c2a4c",
          800: "#17233f",
          900: "#101830",
          950: "#0a0f1f",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e2",
          300: "#b0b8c8",
          400: "#8590a8",
          500: "#66738d",
          600: "#515c74",
          700: "#434b5e",
          800: "#3a4050",
          900: "#171a21",
          950: "#0d0f14",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)",
      },
    },
  },
  plugins: [],
};

export default config;
