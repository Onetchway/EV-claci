import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Statiq-style vivid red-orange accent — replaces the previous green.
        // Every primary button, active nav item, link and focus ring in the
        // app draws from this token, so this one swap re-themes the whole
        // CRM without touching individual components.
        brand: {
          50: "#fff5f0",
          100: "#ffe4d6",
          200: "#ffc4a3",
          300: "#ff9d6b",
          400: "#fb7343",
          500: "#f0501f",
          600: "#d63d12",
          700: "#b02f0d",
          800: "#8a260f",
          900: "#6e2210",
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
