/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Official Livanto Green core palette (design system, section 01):
        // Navy #071A35 · Green #20A84A · Deep Green #003D2B ·
        // Off White #F7F9F7 · Light Green #EAF7EE · Muted Grey #667085.
        ink: {
          DEFAULT: '#071A35', // Livanto Navy — primary typography/navigation
          soft: '#0F2A4A',
        },
        surface: {
          DEFAULT: '#F7F9F7', // Off White — main page background
          alt: '#EAF7EE', // Light Green — soft cards/highlights
          dark: '#003D2B', // Deep Green — dark CTA sections/footer
          darkAlt: '#0A4A36',
        },
        line: {
          DEFAULT: '#E4ECE8',
          dark: 'rgba(255,255,255,.14)',
        },
        muted: {
          DEFAULT: '#667085', // Muted Grey — secondary text
          light: '#9AA5B1',
        },
        brand: {
          50: '#EAF7EE',
          100: '#D2EEDB',
          200: '#A6DDB8',
          300: '#79CC96',
          400: '#3EBA69',
          500: '#20A84A', // Livanto Green — primary CTA / accents / active states
          600: '#1B8F3F',
          700: '#167034',
          800: '#003D2B', // Deep Green
          900: '#00291D',
        },
        lime: {
          // No separate accent hue in the approved palette — this is a
          // lighter tint of Livanto Green, used only for emphasis on dark
          // (Deep Green) surfaces where the primary green needs more contrast.
          DEFAULT: '#6FDB92',
          soft: '#A6EFC0',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Fluid, editorial type scale (desktop hero ≈120px → mobile ≈44px)
        'display-xl': ['clamp(2.75rem, 3.2vw + 2rem, 7.5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2.25rem, 2.4vw + 1.75rem, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.9rem, 1.6vw + 1.5rem, 3.25rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-sm': ['clamp(1.5rem, 1vw + 1.25rem, 2rem)', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        lead: ['clamp(1.125rem, 0.4vw + 1rem, 1.5rem)', { lineHeight: '1.5' }],
      },
      maxWidth: {
        container: '1360px',
        prose: '38rem',
      },
      transitionTimingFunction: {
        cinematic: 'cubic-bezier(.16,.84,.44,1)',
      },
    },
  },
  plugins: [],
};
