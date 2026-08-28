import Image from 'next/image';
import Link from 'next/link';
import { Zap, Truck, Building2, Route } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const CARDS = [
  {
    id: 'public',
    icon: Zap,
    title: 'Public Charging',
    body: 'Fast and reliable charging infrastructure for cities and highways.',
    image: '/brand/station-lucknow.jpg',
  },
  {
    id: 'fleet',
    icon: Truck,
    title: 'Fleet Charging',
    body: 'Dedicated charging infrastructure for commercial EV fleets.',
    image: null,
  },
  {
    id: 'commercial',
    icon: Building2,
    title: 'Destination Charging',
    body: 'Charging at hotels, malls, offices and commercial properties.',
    image: '/brand/hero-charging.jpg',
  },
  {
    id: 'highway',
    icon: Route,
    title: 'Highway Charging',
    body: 'High-power charging hubs for long-distance electric travel.',
    image: '/brand/station-dehradun.jpg',
  },
];

export default function SolutionsGrid() {
  return (
    <section id="solutions" className="bg-white py-24">
      <div className="container-lv">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <ScrollReveal>
            <span className="eyebrow">Our Solutions</span>
            <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
              One network. <span className="text-brand-500">Every charging need.</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.06} className="max-w-sm">
            <p className="text-sm text-muted">
              From cities to highways, fleets to destinations — we build and
              operate charging infrastructure that keeps India moving.
            </p>
            <Link href="/solutions" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all solutions →
            </Link>
          </ScrollReveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c, i) => (
            <ScrollReveal key={c.id} delay={i * 0.06} className="group overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative h-40 w-full overflow-hidden">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    width={420}
                    height={280}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-800 to-ink">
                    <c.icon className="h-10 w-10 text-lime/70" />
                  </div>
                )}
                <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md">
                  <c.icon className="h-4 w-4 text-brand-600" />
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide">{c.title}</h3>
                <p className="mt-2 text-sm text-muted">{c.body}</p>
                <Link href="/solutions" className="mt-4 inline-block text-brand-600 transition-transform group-hover:translate-x-1">
                  →
                </Link>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
