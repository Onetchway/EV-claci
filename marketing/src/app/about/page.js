import Image from 'next/image';
import Link from 'next/link';
import { Linkedin, Target, Eye, Heart, UserCheck, ShieldCheck, Lightbulb, Leaf, Award, Users, Play, Calendar, MapPin, Zap, Clock } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import LeaderAvatar from '@/components/LeaderAvatar';

export const metadata = {
  title: 'About',
  description: 'Livanto Green — an emerging energy-tech company revolutionising EV charging in India.',
};

const HERO_STATS = [
  { icon: Calendar, value: '2025', label: 'Year Founded' },
  { icon: MapPin, value: '2', label: 'Office Locations' },
  { icon: Zap, value: 'AC + DC', label: 'Charger Portfolio' },
  { icon: Clock, value: '24×7', label: 'Operations Support' },
];

const PILLARS = [
  { icon: Target, title: 'Our Mission', body: 'To build India’s most reliable and accessible EV charging network and accelerate the transition towards sustainable mobility.' },
  { icon: Eye, title: 'Our Vision', body: 'A future where clean energy powers every journey and every community, everywhere in India.' },
  { icon: Heart, title: 'What Drives Us', body: 'We are driven by innovation, sustainability, and the passion to create a better tomorrow for generations to come.' },
];

const JOURNEY = [
  { year: '2025', title: 'Livanto Green', body: 'is founded with a vision to build a future-ready charging network.' },
  { year: '2025 Q2', title: 'First deployment', body: 'Launched first set of AC & DC chargers and deployed initial stations across key cities.' },
  { year: '2025 Q3', title: 'Scaling up', body: 'Expanded operations and strengthened our pan-India charging network vision.' },
  { year: '2025 Q4', title: 'Network growth', body: 'Scaled network infrastructure and onboarded strategic partners.' },
  { year: '2026+', title: 'What’s next', body: 'Continuing to innovate, expand and empower India’s clean mobility revolution.' },
];

const LEADERS = [
  { name: 'Ashwani Dixit', title: 'Chief Executive Officer' },
  { name: 'Divya Chowdhary', title: 'Head of Media Operations' },
  { name: 'Anand', title: 'Business Head' },
];

const VALUES = [
  { icon: UserCheck, title: 'Customer First', body: 'We build for our customers and their future.' },
  { icon: ShieldCheck, title: 'Integrity', body: 'Honesty and transparency in every action.' },
  { icon: Lightbulb, title: 'Innovation', body: 'We embrace technology to create better solutions.' },
  { icon: Leaf, title: 'Sustainability', body: 'We are committed to a cleaner, greener tomorrow.' },
  { icon: Award, title: 'Excellence', body: 'We strive for the highest standards in everything.' },
  { icon: Users, title: 'Collaboration', body: 'Stronger together. We grow by lifting others.' },
];

const IMPACT_STATS = [
  ['2025', 'Founded'],
  ['6+', 'Charger Models'],
  ['2', 'Livanto Offices'],
  ['Pan-India', 'Growth Vision'],
];

const CLIENT_LOGO_SHEETS = [
  { key: 'automotive', label: 'Automotive' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'hospitality', label: 'Hospitality' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'residential', label: 'Residential' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white pb-16 pt-32 sm:pt-36">
        <div className="container-lv">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <ScrollReveal as="span" className="eyebrow">
                About Livanto Green
              </ScrollReveal>
              <ScrollReveal as="h1" delay={0.05} className="mt-4 font-display text-display-lg font-bold leading-[1.05]">
                Powering mobility.
                <br />
                <span className="text-brand-500">Driving sustainability.</span>
              </ScrollReveal>
              <ScrollReveal delay={0.1} as="p" className="mt-5 max-w-md text-muted">
                Livanto Green is an emerging energy-tech company formed in
                2025, revolutionising the EV charging landscape with
                comprehensive solutions.
              </ScrollReveal>
              <ScrollReveal delay={0.15} className="mt-7">
                <button className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-white" />
                  </span>
                  Watch our story
                </button>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.1} className="overflow-hidden rounded-3xl">
              <Image
                src="/brand/hero-charging.jpg"
                alt="Livanto Green EV charger"
                width={1672}
                height={711}
                priority
                className="h-[280px] w-full object-cover sm:h-[340px]"
              />
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.2} className="mt-12 grid grid-cols-2 gap-6 rounded-2xl border border-line bg-surface-alt px-6 py-7 sm:grid-cols-4">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
                  <s.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="font-display text-lg font-bold">{s.value}</div>
                  <div className="text-xs text-muted">{s.label}</div>
                </div>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* Mission / Vision / What Drives Us */}
      <section className="bg-surface-alt py-16">
        <div className="container-lv grid gap-6 sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <ScrollReveal key={p.title} delay={i * 0.06} className="rounded-2xl border border-line bg-white p-6">
              <p.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-4 text-sm font-bold">{p.title}</h3>
              <p className="mt-2 text-xs text-muted">{p.body}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Journey */}
      <section className="bg-white py-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Our Journey
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-2 font-display text-display-sm font-bold">
            A new journey. A lasting impact.
          </ScrollReveal>

          <div className="relative mt-16 grid grid-cols-2 gap-y-10 sm:grid-cols-5">
            <div className="absolute left-[10%] right-[10%] top-2 hidden h-px bg-line sm:block" />
            {JOURNEY.map((j, i) => (
              <ScrollReveal key={j.year} delay={i * 0.07} className="relative">
                <div className="relative z-10 h-3 w-3 rounded-full bg-brand-500" />
                <div className="mt-3 text-xs font-bold text-brand-600">{j.year}</div>
                <div className="mt-1 text-sm font-bold">{j.title}</div>
                <p className="mt-1 max-w-[20ch] text-xs text-muted">{j.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Leadership</span>
            <h2 className="mt-2 font-display text-display-sm font-bold leading-tight">
              Experienced leaders.
              <br />
              Driving change.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-muted">
              Our leadership team brings together deep industry expertise and
              a shared commitment to building a sustainable future.
            </p>
            <Link href="/contact" className="btn btn-outline mt-6">
              Meet the team →
            </Link>
          </ScrollReveal>

          <div className="grid gap-5 sm:grid-cols-3">
            {LEADERS.map((l, i) => (
              <ScrollReveal key={l.name} delay={i * 0.08} className="overflow-hidden rounded-2xl border border-line bg-white">
                <LeaderAvatar name={l.name} />
                <div className="p-4">
                  <div className="text-sm font-bold">{l.name}</div>
                  <div className="text-xs text-muted">{l.title}</div>
                  <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded bg-brand-600 text-white">
                    <Linkedin className="h-3 w-3" />
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white py-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Our Values
          </ScrollReveal>
          <ScrollReveal as="h2" delay={0.05} className="mt-2 font-display text-display-sm font-bold leading-tight">
            The principles that guide everything we do.
          </ScrollReveal>
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {VALUES.map((v, i) => (
              <ScrollReveal key={v.title} delay={(i % 6) * 0.05} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-brand-600">
                  <v.icon className="h-6 w-6" />
                </span>
                <div className="mt-3 text-sm font-bold">{v.title}</div>
                <p className="mt-1 text-xs text-muted">{v.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="bg-surface-alt py-24">
        <div className="container-lv grid gap-10 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <span className="eyebrow">Our Impact</span>
            <h2 className="mt-2 font-display text-display-sm font-bold leading-tight">
              Building the foundation for India&apos;s electric future.
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-6">
              {IMPACT_STATS.map(([v, l]) => (
                <div key={l}>
                  <div className="font-display text-xl font-bold text-brand-600">{v}</div>
                  <div className="mt-1 text-xs text-muted">{l}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="overflow-hidden rounded-3xl">
            <div className="h-72 w-full bg-gradient-to-br from-brand-700 via-brand-800 to-ink" />
          </ScrollReveal>
        </div>
      </section>

      {/* Trust logos */}
      <section className="bg-white py-24">
        <div className="container-lv text-center">
          <ScrollReveal as="span" className="eyebrow">
            Our Clients
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.04} className="mt-3 font-display text-display-sm font-bold">
            Trusted across fleets, automotive, hospitality &amp; more.
          </ScrollReveal>
          <div className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {CLIENT_LOGO_SHEETS.map((c, i) => (
              <ScrollReveal key={c.key} delay={i * 0.06} className="overflow-hidden rounded-2xl border border-line bg-surface-alt">
                <div className="border-b border-line bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-brand-600">
                  {c.label}
                </div>
                <Image
                  src={`/brand/clients/${c.key}.jpg`}
                  alt={`Livanto Green ${c.label} clients`}
                  width={640}
                  height={1440}
                  className="w-full object-cover"
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-display-sm font-semibold">
              Let&apos;s build India&apos;s <span className="text-lime">next charging network.</span>
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Partner with us and be a part of the movement towards a sustainable tomorrow.
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
      </section>
    </>
  );
}
