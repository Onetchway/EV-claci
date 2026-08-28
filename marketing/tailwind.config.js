/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Livanto Green brand — carried over from the existing mark/site,
        // extended into a full light/dark/brand design-system.
        ink: {
          DEFAULT: '#07150F', // near-black, green-tinted — dark-mode base
          soft: '#0E2119',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F5FAF7',
          dark: '#0C1C15',
          darkAlt: '#122A20',
        },
        line: {
          DEFAULT: '#E4ECE8',
          dark: 'rgba(255,255,255,.12)',
        },
        muted: {
          DEFAULT: '#5B7368',
          light: '#9FC2B0',
        },
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#12B76A', // primary
          600: '#0A9956', // primary hover / darker
          700: '#0A7A4A',
          800: '#064E3B', // deep green, dark-section base
          900: '#053A2B',
        },
        lime: {
          DEFAULT: '#C6F94E', // accent — used sparingly for emphasis/CTA glow
          soft: '#E4FFA8',
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
