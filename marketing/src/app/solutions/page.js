import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import SolutionBlock from '@/components/SolutionBlock';

export const metadata = {
  title: 'Solutions',
  description: 'Charging solutions for every journey — home, workplace, fleet, commercial, public and highway.',
};

const SOLUTIONS = [
  { eyebrow: 'Home', title: 'Charge where you live.', body: 'A 7.4 kW smart AC charger for everyday residential charging — reliable, app-connected, and simple to install.', intensity: 0.15 },
  { eyebrow: 'Workplace', title: 'Charge while you work.', body: 'Smart AC charging for offices and campuses, with usage tracking and access control for every employee.', intensity: 0.25, reverse: true },
  { eyebrow: 'Fleet', title: 'Keep your fleet moving.', body: 'High-throughput DC charging with dynamic load balancing, built for delivery, logistics and mobility fleets that can’t afford downtime.', intensity: 0.65 },
  { eyebrow: 'Commercial', title: 'Turn parking into charging.', body: 'The AD Wall Smart Charger turns a charging bay into an advertising surface — revenue from the wall, not just the session.', intensity: 0.5, reverse: true },
  { eyebrow: 'Public', title: 'Charge wherever the journey takes you.', body: 'ARAI-certified 60 kW dual-CCS2 DC charging for public hubs, with dynamic load balancing built in.', intensity: 0.55 },
  { eyebrow: 'Highway', title: 'Fast charging for long-distance mobility.', body: 'The Livanto DC 240 — fleet-grade, dual-gun DC fast charging engineered for buses, trucks and rapid highway turnaround.', intensity: 1, reverse: true },
];

export default function SolutionsPage() {
  return (
    <>
      <section className="mode-dark pt-40 pb-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Solutions
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-5 max-w-3xl font-display text-display-lg font-bold">
            Charging solutions for every journey.
          </ScrollReveal>
        </div>
      </section>

      {SOLUTIONS.map((s, i) => (
        <SolutionBlock key={s.eyebrow} {...s} dark={i % 2 === 1} />
      ))}

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">Not sure which solution fits your site?</h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Talk to us →
          </Link>
        </div>
      </section>
    </>
  );
}
