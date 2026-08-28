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
} from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import Card3D from '@/components/Card3D';

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

const PLATFORM_CHECKS = ['Real-time Monitoring', 'Smart Load Management', 'OTA Updates', 'Remote Diagnostics', 'Analytics & Reporting', 'Secure & Scalable'];

const INDIA_PATH =
  'M 279.3,84.3 L 280.0,87.7 L 276.9,89.3 L 277.6,94.8 L 271.3,93.2 L 259.7,99.4 L 260.0,104.4 L 255.1,111.9 L 254.6,116.2 L 250.7,123.6 L 243.7,121.6 L 243.4,130.8 L 241.4,133.8 L 242.3,137.6 L 237.9,139.7 L 233.2,125.6 L 230.8,125.6 L 229.3,131.3 L 224.5,126.7 L 227.2,121.6 L 231.2,121.1 L 235.3,113.6 L 213.4,111.0 L 212.7,104.8 L 208.4,104.3 L 201.4,100.5 L 198.2,106.5 L 204.6,111.2 L 199.1,114.5 L 197.1,117.8 L 202.6,120.2 L 201.1,125.5 L 205.5,139.6 L 204.3,142.8 L 187.2,144.5 L 187.8,151.2 L 183.0,156.5 L 170.2,162.5 L 160.2,172.9 L 144.7,184.4 L 144.7,188.5 L 128.1,194.3 L 125.4,201.1 L 127.7,220.1 L 124.0,228.5 L 123.9,243.6 L 119.3,244.1 L 115.3,250.8 L 118.0,253.8 L 109.9,256.3 L 106.9,262.3 L 103.3,264.9 L 94.9,256.6 L 87.3,235.2 L 79.5,222.4 L 75.8,205.7 L 67.7,193.5 L 61.3,164.9 L 59.6,145.8 L 46.7,151.1 L 40.4,150.0 L 28.8,139.3 L 33.1,136.0 L 30.4,132.5 L 20.0,125.0 L 25.9,119.1 L 45.5,119.1 L 43.7,111.4 L 38.7,106.9 L 37.7,100.1 L 31.9,96.1 L 41.7,86.8 L 52.0,87.4 L 75.6,60.2 L 75.4,53.8 L 83.0,48.7 L 75.8,44.3 L 69.6,30.5 L 73.9,26.6 L 87.4,28.8 L 97.4,27.5 L 105.9,20.0 L 115.5,30.4 L 114.6,37.7 L 118.1,42.2 L 117.9,46.8 L 111.5,45.6 L 114.0,55.4 L 135.1,67.2 L 129.4,71.3 L 126.0,79.6 L 154.6,92.3 L 166.8,93.5 L 171.9,98.0 L 196.9,100.8 L 197.4,87.8 L 202.8,85.9 L 203.8,94.7 L 211.9,98.1 L 217.5,96.7 L 232.2,97.0 L 232.9,91.5 L 229.2,88.7 L 236.4,87.6 L 254.8,75.3 L 262.2,77.5 L 268.6,73.7 L 272.7,79.3 L 269.7,83.0 L 279.3,84.3 Z';

export default function SolutionsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white pb-16 pt-32 sm:pt-36">
        <div className="container-lv">
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
            <ScrollReveal delay={0.1} className="overflow-hidden rounded-3xl">
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
                <Card3D className="h-full overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="relative">
                    {s.image ? (
                      <Image src={s.image} alt={s.title} width={420} height={280} className="h-32 w-full object-cover" />
                    ) : (
                      <div className="h-32 w-full bg-gradient-to-br from-brand-700 via-brand-800 to-ink" />
                    )}
                    <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
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
      <section className="bg-white py-24">
        <div className="container-lv text-center">
          <ScrollReveal as="span" className="eyebrow">
            Why Livanto Green
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-2 font-display text-display-sm font-bold">
            End-to-end. Intelligent. Future-ready.
          </ScrollReveal>
          <div className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {WHY.map((w, i) => (
              <ScrollReveal key={w.title} delay={(i % 6) * 0.05}>
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-brand-600">
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
        <div className="container-lv grid gap-10 overflow-hidden rounded-3xl border border-line bg-white p-8 lg:grid-cols-2 lg:items-center lg:p-12">
          <ScrollReveal className="rounded-2xl bg-ink p-6 text-white">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-lime/70" />
              <span className="ml-2 text-xs text-white/40">Livanto Green Platform</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {PLATFORM_CHECKS.map((c) => (
                <div key={c} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-xs font-medium text-white/80">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-lime" />
                  {c}
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <span className="eyebrow">Livanto Platform</span>
            <h2 className="mt-3 font-display text-display-sm font-bold leading-tight">
              Powering the network with <span className="text-brand-500">intelligence.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted">
              Our unified platform helps operators monitor, manage and
              optimise their charging network in real-time.
            </p>
            <Link href="/technology" className="btn btn-primary mt-6">
              Explore Platform →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Dark CTA with India silhouette */}
      <section className="mode-dark py-24">
        <div className="container-lv relative overflow-hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 300 340"
            className="pointer-events-none absolute -right-6 top-1/2 hidden w-64 -translate-y-1/2 opacity-40 sm:block lg:w-80"
          >
            <path d={INDIA_PATH} fill="none" stroke="#6FDB92" strokeWidth="1.2" />
          </svg>
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-display-sm font-semibold">
                Let&apos;s build the future of <span className="text-lime">EV charging together.</span>
              </h2>
              <p className="mt-2 max-w-md text-sm text-white/70">
                Partner with Livanto Green to create impact and drive sustainable growth.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/franchise" className="btn bg-white text-brand-800 hover:bg-white/90">
                Partner With Us →
              </Link>
              <Link href="/contact" className="btn btn-outline">
                Contact Us →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
