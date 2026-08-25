import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NAKJM's brand: amber/industrial accent for an EPC contractor, navy
        // for the sidebar/headings. Every primary button, active nav item,
        // link and focus ring draws from brand-*, so this token is the one
        // place that re-themes the whole CRM at once.
        brand: {
          50: "#fff8eb",
          100: "#ffecc6",
          200: "#ffd98a",
          300: "#ffc04d",
          400: "#ffa91f",
          500: "#f98c07",
          600: "#dc6a02",
          700: "#b64b06",
          800: "#943a0c",
          900: "#7a300d",
        },
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
