'use client';

import { motion } from 'framer-motion';

/**
 * Abstract charger silhouette used in place of product photography we
 * don't have real renders for yet. Intensity (0–1) maps to power tier so
 * higher-kW products read as visually "hotter".
 */
export default function ChargerGlyph({ intensity = 0.5, connectors = 1 }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <motion.div
        aria-hidden="true"
        className="absolute h-64 w-64 rounded-full blur-3xl"
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: `radial-gradient(circle, rgba(198,249,78,${0.25 + intensity * 0.35}), transparent 70%)`,
        }}
      />
      <svg width="220" height="320" viewBox="0 0 220 320" fill="none" className="relative">
        <rect x="40" y="30" width="140" height="240" rx="26" fill="#0E2119" stroke="#1C4033" />
        <rect x="58" y="56" width="104" height="72" rx="10" fill="#07150F" stroke="#12B76A" strokeOpacity="0.5" />
        <motion.text
          x="110"
          y="100"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize="22"
          fontWeight="700"
          fill="#C6F94E"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ⚡
        </motion.text>
        <circle cx="90" cy="160" r="7" fill="#12B76A" />
        {connectors > 1 && <circle cx="130" cy="160" r="7" fill="#12B76A" />}
        <rect x="70" y="185" width="80" height="8" rx="4" fill="#1C4033" />
        <rect x="70" y="202" width="55" height="8" rx="4" fill="#1C4033" />
        <rect x="20" y="260" width="180" height="14" rx="7" fill="#0A2119" />
        <path
          d="M180 150 C 200 170, 195 210, 210 230"
          stroke="#C6F94E"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        <circle cx="212" cy="234" r="6" fill="#C6F94E" />
      </svg>
    </div>
  );
}
