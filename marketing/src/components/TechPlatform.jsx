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
  { icon: Clock, label: '24×7 Monitoring', body: 'Round-the-clock station uptime and performance monitoring.' },
  { icon: Radar, label: 'Remote Diagnostics', body: 'Real-time fault detection and remote issue resolution.' },
  { icon: Activity, label: 'Real-time Status', body: 'Live updates on charger availability and session status.' },
  { icon: BatteryCharging, label: 'Smart Energy Management', body: 'Intelligent load balancing and energy optimisation.' },
  { icon: CreditCard, label: 'Digital Payments', body: 'Secure, fast and seamless cashless transactions.' },
  { icon: LineChart, label: 'Analytics & Insights', body: 'Actionable data to improve utilisation and performance.' },
  { icon: Gauge, label: 'Uptime Management', body: 'Proactive maintenance and maximum uptime assurance.' },
];

const RADIUS = 140;

export default function TechPlatform({ hero = false }) {
  return (
    <section
      id="technology"
      className={
        'relative overflow-hidden bg-surface-alt ' + (hero ? 'pb-24 pt-40 sm:pt-44' : 'py-24')
      }
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-50 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(32,168,74,.12), transparent 70%)' }}
      />
      <div className="container-lv relative grid gap-14 lg:grid-cols-[1fr_1.2fr_1fr] lg:items-center">
        <ScrollReveal>
          <span className="eyebrow">Our Technology</span>
          <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
            Intelligence behind <span className="text-brand-500">every charge.</span>
          </h2>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-px w-10 bg-line" />
            <Zap className="h-3.5 w-3.5 text-brand-500" />
          </div>
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
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(32,168,74,.28), transparent 70%)' }}
          />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 380 380">
            <circle cx="190" cy="190" r={RADIUS} fill="none" stroke="#DCEFE4" strokeWidth="1.5" strokeDasharray="4 6" />
            {NODES.map((n, i) => {
              const midAngle = ((n.angle + 22.5) * Math.PI) / 180;
              const mx = 190 + RADIUS * Math.cos(midAngle);
              const my = 190 + RADIUS * Math.sin(midAngle);
              return <circle key={i} cx={mx} cy={my} r={2.5} fill="#7DCB9B" />;
            })}
          </svg>

          <div className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-brand-500 bg-white text-center shadow-xl">
            <Zap className="h-4 w-4 text-brand-500" />
            <span className="mt-1 font-display text-sm font-bold leading-tight">
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

        <ScrollReveal delay={0.15} className="relative overflow-hidden rounded-2xl border border-line bg-white p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-24 w-24 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(rgba(32,168,74,.35) 1px, transparent 1px)',
              backgroundSize: '8px 8px',
              maskImage: 'radial-gradient(circle at top right, black, transparent 70%)',
            }}
          />
          <ul className="relative space-y-4">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-sm font-bold text-ink">{f.label}</div>
                  <p className="mt-0.5 text-xs leading-snug text-muted">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}
