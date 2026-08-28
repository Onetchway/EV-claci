import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import PhoneShowcase from '@/components/PhoneShowcase';
import ConnectivityFlow from '@/components/ConnectivityFlow';
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

const SMART_FEATURES = [
  { title: 'OCPP management', body: 'Every charger speaks a standard protocol — swap hardware without losing software.' },
  { title: 'Analytics dashboard', body: 'Live chargers, sessions, energy and revenue in one operator view.' },
  { title: 'Payment processing', body: 'Cards, UPI and wallet, reconciled automatically per session.' },
  { title: '24/7 monitoring & SLA', body: 'Uptime backed by round-the-clock monitoring and support commitments.' },
];

export default function TechnologyPage() {
  return (
    <>
      <section className="mode-dark pt-40 pb-28">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Technology
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-5 max-w-3xl font-display text-display-lg font-bold">
            The intelligence behind every charge.
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.1} className="mt-6 max-w-xl text-lead text-white/65">
            Hardware connects the vehicle. Software connects everything else.
          </ScrollReveal>
        </div>
      </section>

      <div className="mode-dark border-t border-line-dark">
        <PhoneShowcase steps={STEPS} />
      </div>

      {/* CMS / dashboard */}
      <section className="mode-light py-28">
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
      <section className="mode-light py-28">
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
          <h2 className="max-w-xl font-display text-display-sm font-semibold">See the hardware behind the software.</h2>
          <Link href="/products" className="btn bg-white text-brand-800 hover:bg-white/90">
            View products →
          </Link>
        </div>
      </section>
    </>
  );
}
