'use client';

import { motion } from 'framer-motion';
import {
  Smartphone,
  Users,
  Zap,
  UserCog,
  CreditCard,
  Truck,
  BarChart3,
  Battery,
  Clock,
  Radar,
  Activity,
  BatteryCharging,
  LineChart,
  Gauge,
} from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const NODES = [
  { icon: Zap, label: 'Chargers', angle: -90 },
  { icon: UserCog, label: 'Operations', angle: -45 },
  { icon: CreditCard, label: 'Payments', angle: 0 },
  { icon: BarChart3, label: 'Analytics', angle: 45 },
  { icon: Battery, label: 'Energy', angle: 90 },
  { icon: Truck, label: 'Fleets', angle: 135 },
  { icon: Users, label: 'Customers', angle: 180 },
  { icon: Smartphone, label: 'Mobile App', angle: -135 },
];

const FEATURES = [
  { icon: Clock, label: '24×7 Monitoring' },
  { icon: Radar, label: 'Remote Diagnostics' },
  { icon: Activity, label: 'Real-time Status' },
  { icon: BatteryCharging, label: 'Smart Energy Management' },
  { icon: CreditCard, label: 'Digital Payments' },
  { icon: LineChart, label: 'Analytics & Insights' },
  { icon: Gauge, label: 'Uptime Management' },
];

const RADIUS = 140;

export default function TechPlatform() {
  return (
    <section id="technology" className="bg-surface-alt py-24">
      <div className="container-lv grid gap-14 lg:grid-cols-[1fr_1.2fr_1fr] lg:items-center">
        <ScrollReveal>
          <span className="eyebrow">Our Technology</span>
          <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
            Intelligence behind <span className="text-brand-500">every charge.</span>
          </h2>
          <p className="mt-5 max-w-sm text-muted">
            Livanto Green combines advanced hardware, intelligent software and
            24×7 operations to deliver a seamless charging experience.
          </p>
          <a href="/technology" className="mt-5 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
            Explore Technology →
          </a>
        </ScrollReveal>

        {/* Circular diagram */}
        <ScrollReveal delay={0.1} className="relative mx-auto h-[380px] w-[380px]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 380 380">
            <circle cx="190" cy="190" r={RADIUS} fill="none" stroke="#DCEFE4" strokeWidth="1.5" strokeDasharray="4 6" />
          </svg>

          <div className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-brand-500 bg-white text-center shadow-lg">
            <span className="font-display text-sm font-bold leading-tight">
              Livanto<br /><span className="text-brand-500">Green</span>
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-wide text-muted">Platform</span>
          </div>

          {NODES.map((n, i) => {
            const rad = (n.angle * Math.PI) / 180;
            const x = 190 + RADIUS * Math.cos(rad);
            const y = 190 + RADIUS * Math.sin(rad);
            return (
              <motion.div
                key={n.label}
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                style={{ left: x, top: y }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-brand-600 shadow-sm">
                  <n.icon className="h-4.5 w-4.5" />
                </span>
                <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-ink/60">{n.label}</span>
              </motion.div>
            );
          })}
        </ScrollReveal>

        <ScrollReveal delay={0.15} className="rounded-2xl border border-line bg-white p-6">
          <ul className="space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-sm font-medium text-ink/75">
                <f.icon className="h-4 w-4 shrink-0 text-brand-600" />
                {f.label}
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}
