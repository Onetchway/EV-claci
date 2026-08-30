import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NAKJM's brand, sampled from the real logo/letterhead: the red
        // accent (the triangle in the "K" and the "Infrastructure"
        // wordmark) and the navy of "NAKJM" itself. Every primary button,
        // active nav item, link and focus ring draws from brand-*, so this
        // token is the one place that re-themes the whole CRM at once.
        brand: {
          50: "#fdecec",
          100: "#f9cdd0",
          200: "#f2999f",
          300: "#e9636d",
          400: "#dc3743",
          500: "#c8102e",
          600: "#a80c26",
          700: "#870a20",
          800: "#6b0919",
          900: "#560913",
        },
        navy: {
          50: "#e9edf3",
          100: "#ccd6e5",
          200: "#9aacc9",
          300: "#6580a9",
          400: "#3c5c88",
          500: "#1f3d68",
          600: "#152f54",
          700: "#0f2445",
          800: "#0a1c38",
          900: "#052757",
          950: "#031a3d",
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
