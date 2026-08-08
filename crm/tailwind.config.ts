import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6f9e2",
          200: "#b0f1c9",
          300: "#7ce4a9",
          400: "#41cf83",
          500: "#1cb567",
          600: "#0f9252",
          700: "#0d7444",
          800: "#0e5c39",
          900: "#0d4c31",
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
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)",
      },
    },
  },
  plugins: [],
};

export default config;
