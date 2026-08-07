import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // A deliberately tight scale — the design leans on two or three sizes,
    // not a dozen, which is what keeps large-format layouts feeling composed.
    container: { center: true, padding: { DEFAULT: "1.5rem", lg: "3rem", "2xl": "4rem" } },
    extend: {
      colors: {
        navy: {
          DEFAULT: "#001E4B",
          50: "#F2F5FA",
          100: "#DDE5F0",
          200: "#B4C4DC",
          400: "#3C5A8C",
          600: "#002A63",
          800: "#001E4B",
          900: "#00132F",
          950: "#000A1C",
        },
        crimson: {
          DEFAULT: "#C1121F",
          400: "#E03340",
          500: "#D01722",
          600: "#C1121F",
          700: "#9A0E18",
        },
        ink: "#111111",
        carbon: "#0A0A0A",
        mist: "#F7F7F7",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Neue Haas Grotesk", "Helvetica Neue", "Arial", "sans-serif"],
      },
      fontSize: {
        // fluid display sizes — no breakpoint jumps
        display: ["clamp(3rem, 9vw, 9.5rem)", { lineHeight: "0.92", letterSpacing: "-0.045em", fontWeight: "700" }],
        headline: ["clamp(2.25rem, 5.4vw, 5rem)", { lineHeight: "0.98", letterSpacing: "-0.035em", fontWeight: "700" }],
        title: ["clamp(1.75rem, 3.2vw, 3rem)", { lineHeight: "1.06", letterSpacing: "-0.028em", fontWeight: "500" }],
        lede: ["clamp(1.0625rem, 1.35vw, 1.375rem)", { lineHeight: "1.55", letterSpacing: "-0.011em" }],
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.22em", fontWeight: "500" }],
      },
      // 13vw stacked top+bottom put ~450px of dead band between sections on a
      // laptop. This keeps the rhythm generous without the page reading empty.
      spacing: { section: "clamp(4.25rem, 7.5vw, 8.5rem)", gutter: "clamp(1.5rem, 5vw, 5rem)" },
      maxWidth: { shell: "96rem", measure: "44rem", wide: "78rem" },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.16, 1, 0.3, 1)",
        swift: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
      keyframes: {
        marquee: { from: { transform: "translate3d(0,0,0)" }, to: { transform: "translate3d(-50%,0,0)" } },
        scrollHint: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "40%": { opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        shimmer: { from: { transform: "translateX(-120%)" }, to: { transform: "translateX(120%)" } },
      },
      animation: {
        marquee: "marquee 46s linear infinite",
        scrollHint: "scrollHint 2.1s cubic-bezier(0.16,1,0.3,1) infinite",
        shimmer: "shimmer 0.75s cubic-bezier(0.22,0.61,0.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
