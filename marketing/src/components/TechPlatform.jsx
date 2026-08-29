'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap,
  Activity,
  BatteryCharging,
  CreditCard,
  Users,
  ShieldCheck,
  LineChart,
  Clock,
  Radar,
  Gauge,
  Download,
  ChevronRight,
  Star,
  ArrowUpRight,
  MapPin,
  Leaf,
  Headphones,
  LayoutGrid,
  Wifi,
} from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const FEATURE_CARDS = [
  {
    icon: Activity,
    title: 'Smart Operations',
    body: 'Real-time monitoring and intelligent control of your entire charging network.',
    metricLabel: 'Network Status',
    render: () => (
      <div className="mt-1">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-brand-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          All systems operational
        </div>
        <svg viewBox="0 0 90 32" className="mt-1.5 h-7 w-24">
          {[6, 10, 8, 14, 11, 18, 15, 22, 19, 26, 20, 28].map((h, i) => (
            <rect key={i} x={i * 7 + 1} y={30 - h} width={4} height={h} rx={1} fill="#20A84A" opacity={0.4 + i * 0.05} />
          ))}
        </svg>
      </div>
    ),
  },
  {
    icon: BatteryCharging,
    title: 'Energy Intelligence',
    body: 'Optimise energy usage with smart load balancing and AI-driven insights.',
    metricLabel: 'Energy Delivered',
    render: () => (
      <div className="mt-1">
        <div className="font-display text-base font-bold text-ink">
          2.45 <span className="text-xs font-semibold text-muted">MWh</span>
        </div>
        <svg viewBox="0 0 90 24" className="mt-1 h-6 w-24">
          <path d="M0,20 L15,14 L30,17 L45,10 L60,12 L75,5 L90,2" fill="none" stroke="#20A84A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M0,20 L15,14 L30,17 L45,10 L60,12 L75,5 L90,2 L90,24 L0,24 Z" fill="url(#eGrad)" opacity="0.25" />
          <defs>
            <linearGradient id="eGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#20A84A" />
              <stop offset="100%" stopColor="#20A84A" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
  },
  {
    icon: CreditCard,
    title: 'Seamless Payments',
    body: 'Secure, fast and seamless digital payments for every transaction.',
    metricLabel: 'Transactions Today',
    render: () => (
      <div className="mt-1">
        <div className="font-display text-base font-bold text-ink">1,245</div>
        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-brand-600">
          <ArrowUpRight className="h-2.5 w-2.5" /> 12.5%
        </div>
      </div>
    ),
  },
  {
    icon: Users,
    title: 'Customer Experience',
    body: 'Delight users with reliable sessions, easy access and 24×7 support.',
    metricLabel: 'Customer Satisfaction',
    render: () => (
      <div className="mt-1">
        <div className="font-display text-base font-bold text-ink">4.8<span className="text-xs font-medium text-muted">/5</span></div>
        <div className="mt-0.5 flex gap-0.5 text-brand-500">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="h-2.5 w-2.5 fill-current" />
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Reliable & Secure',
    body: 'Enterprise-grade security, uptime assurance and proactive maintenance.',
    metricLabel: 'Uptime',
    render: () => (
      <div className="mt-1">
        <div className="font-display text-base font-bold text-brand-600">99.9%</div>
        <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-muted">
          <ShieldCheck className="h-2.5 w-2.5 text-brand-500" /> SLA-backed
        </div>
      </div>
    ),
  },
  {
    icon: LineChart,
    title: 'Insights & Growth',
    body: 'Actionable analytics to improve utilisation, performance and business growth.',
    metricLabel: 'Utilisation Rate',
    render: () => {
      const pct = 71;
      const c = 2 * Math.PI * 14;
      const off = c - (pct / 100) * c;
      return (
        <div className="mt-1 flex items-center gap-2">
          <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
            <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(32,168,74,.15)" strokeWidth="4" />
            <circle cx="20" cy="20" r="14" fill="none" stroke="#20A84A" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
          </svg>
          <div className="font-display text-base font-bold text-ink">{pct}%</div>
        </div>
      );
    },
  },
];

const CAPABILITIES = [
  { icon: Clock, title: '24×7 Monitoring', body: 'Round-the-clock station uptime and performance monitoring.' },
  { icon: Radar, title: 'Remote Diagnostics', body: 'Real-time fault detection and remote issue resolution.' },
  { icon: Activity, title: 'Real-time Status', body: 'Live updates on charger availability and session status.' },
  { icon: BatteryCharging, title: 'Smart Energy Management', body: 'Intelligent load balancing and energy optimisation.' },
  { icon: CreditCard, title: 'Digital Payments', body: 'Secure, fast and seamless cashless transactions.' },
  { icon: LineChart, title: 'Analytics & Insights', body: 'Actionable data to improve utilisation and performance.' },
  { icon: Gauge, title: 'Uptime Management', body: 'Proactive maintenance and maximum uptime assurance.' },
];

const STATS = [
  { icon: ShieldCheck, value: '24×7', label: 'Operations' },
  { icon: Wifi, value: '99.9%', label: 'Network Uptime' },
  { icon: MapPin, value: 'Pan-India', label: 'Presence' },
  { icon: Users, value: '500+', label: 'Enterprise Clients' },
  { icon: Leaf, value: 'Green', label: 'Energy Focused' },
  { icon: Headphones, value: '24×7', label: 'Support' },
];

function CarIllustration() {
  return (
    <div className="relative mt-8 h-56 w-full overflow-hidden rounded-3xl bg-gradient-to-b from-white via-brand-50/40 to-brand-100/60">
      {/* wind turbines + city silhouette */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 160"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-full w-full opacity-40"
      >
        {/* skyline */}
        <path
          d="M0,120 L20,120 L20,90 L40,90 L40,110 L55,110 L55,80 L75,80 L75,105 L95,105 L95,95 L120,95 L120,115 L145,115 L145,85 L170,85 L170,110 L200,110 L200,100 L225,100 L225,95 L250,95 L250,115 L280,115 L280,90 L310,90 L310,105 L340,105 L340,110 L365,110 L365,95 L400,95 L400,160 L0,160 Z"
          fill="#7DCB9B"
          opacity="0.35"
        />
        {/* wind turbines */}
        {[80, 320].map((cx, i) => (
          <g key={i} transform={`translate(${cx}, 60)`}>
            <line x1="0" y1="0" x2="0" y2="55" stroke="#20A84A" strokeWidth="1.5" opacity="0.5" />
            <g>
              <line x1="0" y1="0" x2="0" y2="-16" stroke="#20A84A" strokeWidth="1.5" opacity="0.5" />
              <line x1="0" y1="0" x2="14" y2="8" stroke="#20A84A" strokeWidth="1.5" opacity="0.5" />
              <line x1="0" y1="0" x2="-14" y2="8" stroke="#20A84A" strokeWidth="1.5" opacity="0.5" />
              <circle cx="0" cy="0" r="1.8" fill="#20A84A" />
            </g>
          </g>
        ))}
        {/* ground line */}
        <line x1="0" y1="140" x2="400" y2="140" stroke="#20A84A" strokeWidth="1" opacity="0.5" strokeDasharray="4 4" />
      </svg>

      {/* charger */}
      <div className="absolute bottom-6 left-6 h-40 w-24 sm:w-28">
        <Image
          src="/products/livanto-dc-120.png"
          alt="Livanto DC charger"
          fill
          sizes="112px"
          className="object-contain drop-shadow-lg"
        />
      </div>

      {/* car silhouette */}
      <svg
        aria-hidden="true"
        viewBox="0 0 260 100"
        className="absolute bottom-6 right-3 h-24 w-56 sm:right-6 sm:w-64"
      >
        <defs>
          <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#E4ECE8" />
          </linearGradient>
        </defs>
        {/* body */}
        <path
          d="M20,72 C30,54 60,42 100,38 L150,36 C180,36 210,44 232,56 L246,60 C252,62 254,66 254,72 L254,82 C254,86 250,88 246,88 L14,88 C10,88 8,86 8,82 L8,74 C8,72 12,72 20,72 Z"
          fill="url(#carBody)"
          stroke="#7DCB9B"
          strokeWidth="1.5"
        />
        {/* windows */}
        <path
          d="M70,48 L110,42 L152,42 L200,50 L210,66 L60,66 Z"
          fill="rgba(15,42,74,.1)"
          stroke="#7DCB9B"
          strokeWidth="1"
        />
        {/* wheels */}
        <circle cx="70" cy="88" r="12" fill="#0F2A4A" />
        <circle cx="70" cy="88" r="5" fill="#7DCB9B" />
        <circle cx="200" cy="88" r="12" fill="#0F2A4A" />
        <circle cx="200" cy="88" r="5" fill="#7DCB9B" />
        {/* charging cable connecting to charger */}
        <path
          d="M-20,80 Q0,68 20,72"
          fill="none"
          stroke="#20A84A"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/2 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(32,168,74,.1), transparent 70%)' }}
      />

      <div className="container-lv relative">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr_1fr] lg:items-start">
          {/* Column 1 — hero copy + illustration */}
          <ScrollReveal>
            <span className="eyebrow">Our Technology</span>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-px w-10 bg-line" />
              <Zap className="h-3.5 w-3.5 text-brand-500" />
            </div>
            <h2 className="mt-3 font-display text-display-md font-bold leading-[1.05]">
              Intelligence behind <span className="text-brand-500">every charge.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm text-muted">
              Livanto Green combines advanced hardware, intelligent software and
              24×7 operations to deliver a seamless, reliable and future-ready
              charging experience.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/technology" className="btn btn-primary">
                Explore Technology →
              </Link>
              <a href="#" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
                <Download className="h-4 w-4" /> Download Brochure
              </a>
            </div>
            <CarIllustration />
          </ScrollReveal>

          {/* Column 2 — platform feature cards */}
          <ScrollReveal delay={0.08} className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Powered by <span className="text-brand-600">Livanto Green Platform</span>
            </span>
            <div className="mt-4 space-y-3">
              {FEATURE_CARDS.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.04 * i }}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">{f.title}</div>
                    <p className="mt-0.5 text-xs leading-snug text-muted">{f.body}</p>
                  </div>
                  <div className="ml-auto min-w-[92px] shrink-0 border-l border-line pl-3">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">
                      {f.metricLabel}
                    </div>
                    {f.render()}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500/10 text-brand-600">
                <LayoutGrid className="h-3.5 w-3.5" />
              </span>
              <span className="font-semibold text-ink">One platform.</span>
              <span className="text-brand-600 font-semibold">Complete control.</span>
              <span className="text-ink">Limitless growth.</span>
            </div>
          </ScrollReveal>

          {/* Column 3 — capabilities list + CTA */}
          <ScrollReveal delay={0.16} className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Platform Capabilities
            </span>
            <ul className="mt-4 space-y-3">
              {CAPABILITIES.map((c) => (
                <li key={c.title}>
                  <a
                    href="#"
                    className="flex items-start gap-3 rounded-xl border border-line bg-white p-3 transition-colors hover:border-brand-500/40 hover:bg-brand-50/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                      <c.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-ink">{c.title}</div>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{c.body}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brand-500" />
                  </a>
                </li>
              ))}
            </ul>

            <Link
              href="/franchise"
              className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <div>
                <div className="text-sm font-bold">Ready to grow with Livanto Green?</div>
                <div className="mt-1 text-xs text-white/80">Join our franchise network today.</div>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <ChevronRight className="h-5 w-5" />
              </span>
            </Link>
          </ScrollReveal>
        </div>

        {/* Bottom dark stat bar */}
        <ScrollReveal delay={0.2} className="mt-10">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-[#04122a] p-6 shadow-xl">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-8 h-48 w-48 rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(111,219,146,.5), transparent 70%)' }}
            />
            <div className="relative grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {STATS.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lime">
                    <s.icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-white">{s.value}</div>
                    <div className="text-[10px] text-white/60">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
