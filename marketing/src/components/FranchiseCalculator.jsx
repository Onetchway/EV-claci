'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FRANCHISE_TIERS, fmtINR, fmtLakh } from '@/lib/franchise';

const EASE = [0.16, 0.84, 0.44, 1];

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={`mt-1.5 font-display text-2xl font-bold ${accent ? 'text-lime' : 'text-white'}`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function FranchiseCalculator() {
  const [idx, setIdx] = useState(3); // default to the featured 180 kW tier
  const t = FRANCHISE_TIERS[idx];

  return (
    <div className="rounded-[32px] border border-line-dark bg-white/[0.02] p-8 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="eyebrow">Franchise investment model</span>
          <h3 className="mt-2 font-display text-2xl font-bold">
            {t.kw} kW · {t.vehicleType}
          </h3>
        </div>
        <span className="text-xs text-white/40">Source: Livanto Franchise Investment Model</span>
      </div>

      {/* Power tier slider */}
      <div className="mt-8">
        <input
          type="range"
          min={0}
          max={FRANCHISE_TIERS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="Charger power tier"
          className="franchise-slider w-full"
          style={{
            background: `linear-gradient(to right, #12B76A 0%, #C6F94E ${
              (idx / (FRANCHISE_TIERS.length - 1)) * 100
            }%, rgba(255,255,255,0.1) ${(idx / (FRANCHISE_TIERS.length - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`,
          }}
        />
        <style>{`
          .franchise-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; }
          .franchise-slider::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 9999px;
            background: radial-gradient(circle at 35% 30%, #ffffff, #C6F94E 55%, #12B76A 100%);
            box-shadow: 0 0 14px 3px rgba(198,249,78,.7), 0 0 0 4px #0C1C15; border: none;
          }
          .franchise-slider::-moz-range-thumb {
            width: 22px; height: 22px; border-radius: 9999px;
            background: radial-gradient(circle at 35% 30%, #ffffff, #C6F94E 55%, #12B76A 100%);
            box-shadow: 0 0 14px 3px rgba(198,249,78,.7), 0 0 0 4px #0C1C15; border: none;
          }
        `}</style>
        <div className="mt-3 flex justify-between text-xs font-medium text-white/40">
          {FRANCHISE_TIERS.map((f, i) => (
            <button
              key={f.kw}
              onClick={() => setIdx(i)}
              className={i === idx ? 'font-bold text-lime' : 'hover:text-white'}
            >
              {f.kw}kW
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label="Total investment" value={fmtLakh(t.totalCost)} accent />
        <Metric label="Down payment (30%)" value={fmtLakh(t.downPayment)} />
        <Metric label="EMI · 5yr @ 9%" value={fmtINR(t.emi5yr) + '/mo'} />
        <Metric label="Projected monthly income" value={fmtINR(t.projectedMonthlyIncome)} accent />
        <Metric label="Assured minimum (24 mo)" value={fmtINR(t.assuredMinimum) + '/mo'} />
        <Metric label="Annual ROI" value={t.roiPct.toFixed(1) + '%'} accent />
        <Metric label="Payback period" value={t.paybackYears.toFixed(1) + ' yrs'} />
        <Metric label="3-year cumulative income" value={fmtLakh(t.cumulative3yr)} />
        <Metric label="5-year cumulative income" value={fmtLakh(t.cumulative5yr)} />
      </div>

      <p className="mt-6 text-xs text-white/35">
        Figures shown are Livanto Green’s published franchise model (all-inclusive investment incl. 18% GST, 70%
        loan-to-value financing at 9% p.a.). Actual returns depend on site utilisation, tariff and DISCOM cost at
        the time of commissioning.
      </p>
    </div>
  );
}
