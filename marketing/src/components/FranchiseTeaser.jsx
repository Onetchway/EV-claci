import Image from 'next/image';
import Link from 'next/link';
import { Landmark, HardHat, Settings, TrendingUp } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const STEPS = [
  { icon: Landmark, title: 'You Invest', body: 'Build your EV charging asset.' },
  { icon: HardHat, title: 'We Build', body: 'We handle deployment and commissioning.' },
  { icon: Settings, title: 'We Operate', body: '24×7 operations and network management.' },
  { icon: TrendingUp, title: 'You Earn', body: 'Generate recurring revenue from charging activity.' },
];

export default function FranchiseTeaser() {
  return (
    <section className="bg-white py-24">
      <div className="container-lv grid gap-12 lg:grid-cols-[1fr_1.1fr_1fr] lg:items-center">
        <ScrollReveal>
          <span className="eyebrow">Partner With Livanto Green</span>
          <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
            Own the future <span className="text-brand-500">of EV charging.</span>
          </h2>
          <p className="mt-4 max-w-sm text-muted">
            Invest in EV charging infrastructure while Livanto Green handles
            technology, operations and network management.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/franchise" className="btn btn-primary">
              Explore Franchise →
            </Link>
            <Link href="/franchise" className="btn btn-outline">
              Calculate Returns →
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="overflow-hidden rounded-3xl">
          <Image
            src="/brand/station-dehradun.jpg"
            alt="Livanto Green franchise station"
            width={760}
            height={650}
            className="h-72 w-full object-cover"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.15} className="space-y-5">
          {STEPS.map((s) => (
            <div key={s.title} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand-600">
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-sm font-bold uppercase tracking-wide">{s.title}</div>
                <div className="text-sm text-muted">{s.body}</div>
              </div>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
