import Image from 'next/image';
import Link from 'next/link';
import {
  Fuel,
  Truck,
  MapPin,
  Building2,
  Home,
  ArrowRight,
  Zap,
  Radio,
  ShieldCheck,
  Unplug,
  Headphones,
  Leaf,
  CheckCircle2,
  Activity,
  Gauge,
} from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';
import DashboardMock from '@/components/DashboardMock';

export const metadata = {
  title: 'Solutions',
  description: 'Charging solutions for every need — public, fleet, highway, destination and home charging from Livanto Green.',
};

const SEGMENTS = [
  {
    id: 'home',
    icon: Fuel,
    title: 'Public Charging',
    body: 'High-performance charging for public spaces, malls, commercial hubs and more.',
    image: '/brand/hero-charging.jpg',
  },
  {
    id: 'fleet',
    icon: Truck,
    title: 'Fleet Charging',
    body: 'Scalable charging solutions to keep your electric fleet moving efficiently.',
    image: null,
  },
  {
    id: 'highway',
    icon: MapPin,
    title: 'Highway Charging',
    body: 'Ultra-fast charging on highways for a seamless long-distance journey.',
    image: '/brand/station-dehradun.jpg',
  },
  {
    id: 'commercial',
    icon: Building2,
    title: 'Destination Charging',
    body: 'Enhance customer & employee experience with convenient EV charging at destinations.',
    image: '/brand/station-lucknow.jpg',
  },
  {
    id: 'home-charging',
    icon: Home,
    title: 'Home Charging',
    body: 'Smart, safe and reliable charging solutions for every EV home.',
    image: null,
  },
];

const WHY = [
  { icon: Zap, title: 'Complete Portfolio', body: 'AC to ultra-fast DC chargers for every use case.' },
  { icon: Radio, title: 'Smart & Connected', body: 'Cloud-connected chargers with real-time monitoring and analytics.' },
  { icon: ShieldCheck, title: 'Reliable & Safe', body: 'Engineered for 24×7 uptime with advanced safety.' },
  { icon: Unplug, title: 'Easy to Integrate', body: 'Open protocols & APIs for seamless platform integration.' },
  { icon: Headphones, title: 'Pan-India Support', body: 'Strong service network for installation and maintenance.' },
  { icon: Leaf, title: 'Sustainable Impact', body: 'Driving clean energy adoption for a greener India.' },
];

const PLATFORM_CHECKS = [
  { icon: Activity, label: 'Real-time Monitoring' },
  { icon: Gauge, label: 'Smart Load Management' },
  { icon: Zap, label: 'OTA Updates' },
  { icon: Radio, label: 'Remote Diagnostics' },
  { icon: CheckCircle2, label: 'Analytics & Reporting' },
  { icon: ShieldCheck, label: 'Secure & Scalable' },
];

export default function SolutionsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white pb-16 pt-32 sm:pt-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(32,168,74,.14), transparent 70%)' }}
        />
        <div className="container-lv relative">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <ScrollReveal as="span" className="eyebrow">
                Our Solutions
              </ScrollReveal>
              <ScrollReveal as="h1" delay={0.05} className="mt-4 font-display text-display-lg font-bold leading-[1.05]">
                Charging solutions
                <br />
                for <span className="text-brand-500">every need.</span>
              </ScrollReveal>
              <ScrollReveal delay={0.1} as="p" className="mt-5 max-w-md text-muted">
                From public networks to home chargers, we deliver intelligent
                and reliable EV charging solutions for a sustainable tomorrow.
              </ScrollReveal>
              <ScrollReveal delay={0.15} className="mt-7">
                <Link href="/contact" className="btn btn-primary">
                  Talk to Our Experts →
                </Link>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.1} className="relative overflow-hidden rounded-3xl shadow-[0_30px_60px_-25px_rgba(0,61,43,0.35)]">
              <Image
                src="/brand/hero-charging.jpg"
                alt="Livanto Green charging solutions"
                width={1672}
                height={941}
                priority
                className="h-[280px] w-full object-cover sm:h-[360px] lg:h-[420px]"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Segment cards */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv text-center">
          <ScrollReveal as="span" className="eyebrow">
            What we offer
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-2 font-display text-display-sm font-bold">
            Solutions built for every segment.
          </ScrollReveal>

          <div className="mt-14 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-5">
            {SEGMENTS.map((s, i) => (
              <ScrollReveal key={s.id} delay={i * 0.06}>
                <Card3D className="h-full overflow-hidden rounded-2xl border border-line bg-white transition-shadow duration-300 hover:shadow-[0_20px_40px_-20px_rgba(0,61,43,0.35)]">
                  <div className="relative">
                    {s.image ? (
                      <Image src={s.image} alt={s.title} width={420} height={280} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink">
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 opacity-50"
                          style={{ background: 'radial-gradient(120px circle at 30% 30%, rgba(111,219,146,.5), transparent 70%)' }}
                        />
                      </div>
                    )}
                    <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-md ring-4 ring-white/40">
                      <s.icon className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-sm font-bold">{s.title}</h3>
                    <p className="mt-2 text-xs text-muted">{s.body}</p>
                    <Link href={`#${s.id}`} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                      Explore Solution <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </Card3D>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why Livanto Green */}
      <section className="relative overflow-hidden bg-white py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(32,168,74,.12), transparent 70%)' }}
        />
        <div className="container-lv relative text-center">
          <ScrollReveal as="span" className="eyebrow">
            Why Livanto Green
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-2 font-display text-display-sm font-bold">
            End-to-end. Intelligent. Future-ready.
          </ScrollReveal>
          <div className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {WHY.map((w, i) => (
              <ScrollReveal key={w.title} delay={(i % 6) * 0.05} className="group">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
                  <w.icon className="h-6 w-6" />
                </span>
                <div className="mt-3 text-sm font-bold">{w.title}</div>
                <p className="mt-1 text-xs text-muted">{w.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Platform band */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv">
          <div className="relative grid gap-10 overflow-hidden rounded-3xl bg-ink p-8 shadow-2xl lg:grid-cols-2 lg:items-center lg:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(111,219,146,.4), transparent 70%)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(32,168,74,.5), transparent 70%)' }}
            />

            <ScrollReveal className="relative">
              <span className="eyebrow text-lime">Livanto Platform</span>
              <h2 className="mt-3 font-display text-display-sm font-bold leading-tight text-white">
                Powering the network with <span className="text-lime">intelligence.</span>
              </h2>
              <p className="mt-4 max-w-md text-sm text-white/65">
                Our unified platform helps operators monitor, manage and
                optimise their charging network in real-time.
              </p>
              <Link href="/technology" className="btn btn-primary mt-6">
                Explore Platform →
              </Link>
            </ScrollReveal>

            <ScrollReveal delay={0.1} className="relative">
              <DashboardMock compact />
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {PLATFORM_CHECKS.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-white/75">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/15 text-lime">
                      <c.icon className="h-3 w-3" />
                    </span>
                    {c.label}
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </>
  );
}
