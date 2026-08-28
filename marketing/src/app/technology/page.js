import Image from 'next/image';
import Link from 'next/link';
import { Radio, Cog, Smile, BarChart3, ShieldCheck, Unplug, Wifi, Clock3, RefreshCw, Radar, Gauge, TrendingUp } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import PhoneShowcase from '@/components/PhoneShowcase';
import ConnectivityFlow from '@/components/ConnectivityFlow';
import TechPlatform from '@/components/TechPlatform';
import { FindScreen, DiscoverScreen, StartScreen, LiveScreen, PayScreen, HistoryScreen } from '@/components/PhoneScreens';

export const metadata = {
  title: 'Technology',
  description:
    'The Livanto Green app, CMS and OCPP-managed network — find, reserve, start with OTP, monitor live, pay and review history, all backed by real-time analytics.',
};

const STEPS = [
  { tag: 'Find', title: 'Not just the closest. The best.', body: 'Discover nearby stations in real time — by power, connector type and live availability.', screen: <FindScreen /> },
  { tag: 'Discover', title: 'Know everything before you arrive.', body: 'See charger type, certification and tariff up front, then reserve your slot.', screen: <DiscoverScreen /> },
  { tag: 'Start', title: 'Just an OTP away.', body: 'OTP-based smart charging authentication — no card taps, no guesswork.', screen: <StartScreen /> },
  { tag: 'Live', title: 'Watch it happen.', body: 'Real-time session monitoring: energy delivered, time elapsed, live status.', screen: <LiveScreen /> },
  { tag: 'Pay', title: 'Cards, UPI or wallet.', body: 'Multiple payment modes with an integrated wallet for balance management.', screen: <PayScreen /> },
  { tag: 'History', title: 'Every session, remembered.', body: 'A running log of past charges — for you, or for a fleet manager watching dozens.', screen: <HistoryScreen /> },
];

const FEATURE_ROW = [
  { icon: Radio, title: 'Smart & Connected', body: 'Every charger connected in real-time for maximum uptime and reliability.' },
  { icon: Cog, title: 'Intelligent Operations', body: 'Remote monitoring, diagnostics and alerts for proactive action.' },
  { icon: Smile, title: 'Seamless Experience', body: 'Easy-to-use apps, digital payments and smooth user journeys.' },
  { icon: BarChart3, title: 'Data & Insights', body: 'Advanced analytics for better decisions and optimised performance.' },
  { icon: ShieldCheck, title: 'Secure & Scalable', body: 'Enterprise-grade security and a platform built to scale with demand.' },
  { icon: Unplug, title: 'Open & Integrated', body: 'Open APIs to integrate with partners, fleets and third-party systems.' },
];

const AT_WORK = [
  { icon: Wifi, value: '>95%', label: 'Network Uptime' },
  { icon: Clock3, value: '24×7', label: 'Network Operations' },
  { icon: RefreshCw, value: 'Real-time', label: 'Status Updates' },
  { icon: Radar, value: 'Remote', label: 'Diagnostics' },
  { icon: Gauge, value: 'Faster', label: 'Issue Resolution' },
  { icon: TrendingUp, value: 'Higher', label: 'Utilisation' },
];

const AUDIENCES = [
  { title: 'Individual EV Drivers', body: 'Convenient, fast and reliable charging.' },
  { title: 'Fleet Operators', body: 'Manage fleets, bookings and energy.' },
  { title: 'Businesses', body: 'Offer charging to customers & employees.' },
  { title: 'Partners', body: 'Real-time performance & revenue tracking.' },
];

const SMART_FEATURES = [
  { title: 'OCPP management', body: 'Every charger speaks a standard protocol — swap hardware without losing software.' },
  { title: 'Analytics dashboard', body: 'Live chargers, sessions, energy and revenue in one operator view.' },
  { title: 'Payment processing', body: 'Cards, UPI and wallet, reconciled automatically per session.' },
  { title: '24/7 monitoring & SLA', body: 'Uptime backed by round-the-clock monitoring and support commitments.' },
];

export default function TechnologyPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white pb-16 pt-32 sm:pt-36">
        <div className="container-lv">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <ScrollReveal>
              <span className="eyebrow">Our Technology</span>
              <h1 className="mt-3 font-display text-display-lg font-bold leading-tight">
                Intelligence behind
                <br />
                every <span className="text-brand-500">charge.</span>
              </h1>
              <p className="mt-5 max-w-md text-muted">
                Livanto Green combines advanced hardware, intelligent software
                and 24×7 operations to deliver a seamless, reliable and
                future-ready charging experience.
              </p>
              <Link href="#platform" className="btn btn-primary mt-7">
                Explore Platform →
              </Link>
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="flex justify-center gap-3">
              <Image src="/products/livanto-dc-120.png" alt="Livanto charger" width={110} height={220} className="h-56 w-auto object-contain" />
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.15} className="mt-14 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface-alt p-6 sm:grid-cols-3 lg:grid-cols-6">
            {FEATURE_ROW.map((f) => (
              <div key={f.title} className="text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <div className="mt-2 text-xs font-bold">{f.title}</div>
                <div className="mt-1 text-[10px] leading-tight text-muted">{f.body}</div>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      <div id="platform">
        <TechPlatform />
      </div>

      {/* Technology at work */}
      <section className="bg-white py-16">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Technology at work
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-2 font-display text-display-sm font-extrabold uppercase leading-tight">
            Built for reliability. <span className="text-brand-500">Designed for the future.</span>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {AT_WORK.map((s) => (
              <ScrollReveal key={s.label} className="text-center">
                <s.icon className="mx-auto h-5 w-5 text-brand-600" />
                <div className="mt-2 font-display text-sm font-bold">{s.value}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.label}</div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <div className="mode-dark border-t border-line-dark">
        <PhoneShowcase steps={STEPS} />
      </div>

      {/* App: checklist + badges + audiences */}
      <section className="bg-white py-24">
        <div className="container-lv grid gap-12 lg:grid-cols-2">
          <ScrollReveal>
            <span className="eyebrow">Livanto Green App</span>
            <h2 className="mt-3 font-display text-display-sm font-extrabold uppercase leading-tight">
              Charge. Pay. Track. <span className="text-brand-500">All in one app.</span>
            </h2>
            <ul className="mt-6 space-y-2.5">
              {['Find nearby chargers', 'Start & stop charging', 'Real-time status & navigation', 'Secure digital payments', 'Charging history & invoices', 'Smart notifications'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-ink/75">
                  <span className="text-brand-600">✓</span> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <span className="rounded-lg border border-line px-4 py-2 text-xs font-semibold text-muted">Download on the App Store</span>
              <span className="rounded-lg border border-line px-4 py-2 text-xs font-semibold text-muted">Get it on Google Play</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="rounded-2xl border border-line bg-surface-alt p-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-600">Powering experiences for</h4>
            <div className="mt-4 grid grid-cols-2 gap-5">
              {AUDIENCES.map((a) => (
                <div key={a.title}>
                  <div className="text-sm font-bold">{a.title}</div>
                  <div className="mt-1 text-xs text-muted">{a.body}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CMS / dashboard */}
      <section className="bg-surface-alt py-28">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Livanto CMS
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-5 max-w-2xl font-display text-display-md font-semibold">
            One dashboard for the entire network.
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="mt-14 overflow-hidden rounded-3xl border border-line bg-ink text-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-lime/70" />
              <span className="ml-3 text-xs text-white/40">cms.livantogreen.com</span>
            </div>
            <div className="grid gap-px bg-white/5 p-px sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Live chargers', value: '—' },
                { label: 'Active sessions', value: '—' },
                { label: 'Energy today', value: '—' },
                { label: 'Uptime', value: '>95%' },
              ].map((k) => (
                <div key={k.label} className="bg-ink px-6 py-8">
                  <div className="text-xs uppercase tracking-wide text-white/40">{k.label}</div>
                  <div className="mt-2 font-display text-3xl font-bold text-lime">{k.value}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-px bg-white/5 p-px sm:grid-cols-3">
              {['Sessions', 'Revenue', 'Users', 'Alerts', 'Reports', 'Fleet'].map((m) => (
                <div key={m} className="bg-ink px-6 py-5 text-sm text-white/60">
                  {m}
                </div>
              ))}
            </div>
          </ScrollReveal>
          <p className="mt-3 text-xs text-muted">
            Live figures shown once network telemetry is public — uptime commitment (&gt;95%) is confirmed today.
          </p>
        </div>
      </section>

      {/* Connectivity flow */}
      <section className="mode-dark py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="text-center font-display text-display-sm font-semibold">
            Vehicle to driver, connected.
          </ScrollReveal>
          <div className="mt-16">
            <ConnectivityFlow />
          </div>
        </div>
      </section>

      {/* Smart charging capabilities */}
      <section className="bg-white py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Smart charging, built in.
          </ScrollReveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {SMART_FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 0.08}>
                <Card3D className="h-full rounded-2xl border border-line bg-white p-8">
                  <h3 className="font-display text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted">{f.body}</p>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">
            Technology that powers today. Intelligence that builds tomorrow.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="btn bg-white text-brand-800 hover:bg-white/90">
              Explore Our Platform →
            </Link>
            <Link href="/contact" className="btn btn-outline">
              Talk to Our Team →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
