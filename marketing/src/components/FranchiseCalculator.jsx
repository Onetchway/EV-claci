'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Info, Minus, Plus } from 'lucide-react';
import { FRANCHISE_TIERS, CALC_ASSUMPTIONS, fmtINR } from '@/lib/franchise';

const EASE = [0.16, 0.84, 0.44, 1];
const CHARGER_COUNTS = [1, 2, 4, 6, 10];

function Segmented({ options, value, onChange, getLabel = (o) => o }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={getLabel(opt)}
          onClick={() => onChange(opt)}
          className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors duration-200 ${
            value === opt
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-line text-ink/70 hover:border-brand-500/50'
          }`}
        >
          {getLabel(opt)}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, onChange, step = 0.5, min = 0, suffix = '' }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/70">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink/60 hover:border-brand-500"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="w-20 text-center text-sm font-semibold">
          {value}
          {suffix}
        </div>
        <button
          onClick={() => onChange(+(value + step).toFixed(2))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink/60 hover:border-brand-500"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, accent, big }) {
  return (
    <div className="flex items-center justify-between border-b border-line/70 py-2.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`font-display font-bold ${big ? 'text-lg' : 'text-sm'} ${accent ? 'text-brand-600' : 'text-ink'}`}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function FranchiseCalculator() {
  const [tierIdx, setTierIdx] = useState(3); // 180 kW default
  const [count, setCount] = useState(1);
  const [landOwned, setLandOwned] = useState(true);
  const [electricityCost, setElectricityCost] = useState(CALC_ASSUMPTIONS.discomCost);
  const [sellingPrice, setSellingPrice] = useState(FRANCHISE_TIERS[3].tariff);
  const [sessions, setSessions] = useState(FRANCHISE_TIERS[3].vehiclesPerDay);
  const [utilisation, setUtilisation] = useState(80);

  const tier = FRANCHISE_TIERS[tierIdx];

  const selectTier = (idx) => {
    setTierIdx(idx);
    setSellingPrice(FRANCHISE_TIERS[idx].tariff);
    setSessions(FRANCHISE_TIERS[idx].vehiclesPerDay);
  };

  const results = useMemo(() => {
    const capex = tier.investment * count * (1 + CALC_ASSUMPTIONS.gstRate);
    const effectiveSessions = sessions * (utilisation / 100);
    const dailyUnits = effectiveSessions * tier.avgEnergyPerSession * count;
    const monthlyUnits = dailyUnits * 30;
    const monthlyRevenue = monthlyUnits * sellingPrice;
    const costPerUnit = electricityCost + CALC_ASSUMPTIONS.cpoShare + (landOwned ? 0 : CALC_ASSUMPTIONS.landownerShare);
    const monthlyOpex = monthlyUnits * costPerUnit;
    const monthlyNet = monthlyRevenue - monthlyOpex;
    const annualRevenue = monthlyRevenue * 12;
    const roi = capex > 0 ? (monthlyNet * 12) / capex : 0;
    const paybackYears = monthlyNet > 0 ? capex / (monthlyNet * 12) : Infinity;

    return { capex, monthlyRevenue, monthlyOpex, monthlyNet, annualRevenue, roi, paybackYears };
  }, [tier, count, sessions, utilisation, sellingPrice, electricityCost, landOwned]);

  return (
    <div className="rounded-[28px] border border-line bg-white p-6 sm:p-9">
      <div className="text-center">
        <span className="eyebrow">Try it live</span>
        <h3 className="mt-2 font-display text-2xl font-extrabold uppercase sm:text-3xl">
          Calculate your <span className="text-brand-500">charging opportunity.</span>
        </h3>
        <p className="mt-2 text-sm text-muted">See potential returns based on your investment, location and utilisation.</p>
      </div>

      <div className="mt-9 grid gap-10 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-ink/70">Charger capacity</label>
            <div className="mt-1.5">
              <Segmented
                options={FRANCHISE_TIERS.map((_, i) => i)}
                value={tierIdx}
                onChange={selectTier}
                getLabel={(i) => `${FRANCHISE_TIERS[i].kw} kW`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink/70">Number of chargers</label>
            <div className="mt-1.5">
              <Segmented options={CHARGER_COUNTS} value={count} onChange={setCount} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink/70">Land</label>
            <div className="mt-1.5">
              <Segmented
                options={[true, false]}
                value={landOwned}
                onChange={setLandOwned}
                getLabel={(v) => (v ? 'Owned' : 'Leased')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Stepper label="Electricity cost (₹/kWh)" value={electricityCost} onChange={setElectricityCost} step={0.5} min={0} />
            <Stepper label="Selling price (₹/kWh)" value={sellingPrice} onChange={setSellingPrice} step={0.5} min={0} />
          </div>

          <Stepper label="Sessions / charger / day" value={sessions} onChange={setSessions} step={1} min={0} />

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink/70">Utilisation</label>
              <span className="text-sm font-bold text-brand-600">{utilisation}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={utilisation}
              onChange={(e) => setUtilisation(Number(e.target.value))}
              className="calc-slider mt-2 w-full"
              style={{
                background: `linear-gradient(to right, #12B76A 0%, #12B76A ${utilisation}%, #E4ECE8 ${utilisation}%, #E4ECE8 100%)`,
              }}
            />
            <style>{`
              .calc-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; }
              .calc-slider::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 9999px;
                background: #12B76A; box-shadow: 0 0 0 4px rgba(18,183,106,.18); border: 2px solid white;
              }
              .calc-slider::-moz-range-thumb {
                width: 20px; height: 20px; border-radius: 9999px; background: #12B76A;
                box-shadow: 0 0 0 4px rgba(18,183,106,.18); border: 2px solid white;
              }
            `}</style>
          </div>
        </div>

        {/* Outputs */}
        <div className="rounded-2xl bg-surface-alt p-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-600">Estimated returns</h4>
          <div className="mt-3">
            <Metric label="Estimated CAPEX" value={fmtINR(results.capex)} big />
            <Metric label="Estimated monthly revenue" value={fmtINR(results.monthlyRevenue)} />
            <Metric label="Estimated monthly OPEX" value={fmtINR(results.monthlyOpex)} />
            <Metric label="Estimated monthly net income" value={fmtINR(results.monthlyNet)} accent big />
            <Metric label="Estimated annual revenue" value={fmtINR(results.annualRevenue)} />
            <Metric label="Estimated ROI" value={(results.roi * 100).toFixed(1) + '%'} accent big />
            <Metric
              label="Estimated payback period"
              value={Number.isFinite(results.paybackYears) ? results.paybackYears.toFixed(1) + ' years' : '—'}
              big
            />
          </div>

          <div className="mt-5 flex gap-2 rounded-xl bg-white p-3 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
            <p>
              These are indicative estimates only. Actual returns depend on location, utilisation, electricity
              tariff, charger mix, land cost, operating costs and commercial agreement.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-surface-alt p-6 sm:flex-row">
        <p className="text-sm font-semibold text-ink">Want a detailed project report for your location?</p>
        <Link href="/contact" className="btn btn-primary shrink-0">
          Get Site Assessment →
        </Link>
      </div>
    </div>
  );
}
