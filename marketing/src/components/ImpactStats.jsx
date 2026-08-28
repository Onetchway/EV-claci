import { Leaf, Cloud, PlugZap, Zap } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import StatCounter from './StatCounter';

const STATS = [
  { icon: Leaf, value: 1, decimals: 0, suffix: 'M+', label: 'kWh Clean Energy Delivered' },
  { icon: Cloud, value: 800, suffix: '+', label: 'Tonnes CO₂ Avoided' },
  { icon: PlugZap, value: 500, suffix: 'K+', label: 'Charging Sessions' },
  { icon: Zap, value: 100, suffix: '+', label: 'Charging Points Deployed' },
];

export default function ImpactStats() {
  return (
    <section className="bg-surface-alt py-24">
      <div className="container-lv">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <ScrollReveal>
            <span className="eyebrow">Our Impact</span>
            <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
              Every charge <span className="text-brand-500">moves India forward.</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.06} className="max-w-sm text-sm text-muted">
            Building a cleaner, smarter and more sustainable tomorrow through electric mobility.
          </ScrollReveal>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.06} className="rounded-2xl border border-line bg-white p-6">
              <s.icon className="h-6 w-6 text-brand-600" />
              <div className="mt-4 font-display text-2xl font-bold">
                <StatCounter value={s.value} suffix={s.suffix} decimals={s.decimals} />
              </div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
