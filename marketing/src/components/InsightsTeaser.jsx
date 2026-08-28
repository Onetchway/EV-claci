import ScrollReveal from './ScrollReveal';

const ARTICLES = [
  { tag: 'Infrastructure', title: 'The Road Ahead for EV Infrastructure in India', gradient: 'from-brand-800 to-ink' },
  { tag: 'Technology', title: 'Smart Charging: Building Intelligent Networks', gradient: 'from-ink to-brand-900' },
  { tag: 'Energy', title: 'Renewable Energy for a Greener Tomorrow', gradient: 'from-brand-700 to-ink' },
  { tag: 'Mobility', title: "EV Adoption Trends Shaping India's Future", gradient: 'from-ink to-brand-800' },
];

export default function InsightsTeaser() {
  return (
    <section className="bg-white py-24">
      <div className="container-lv">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <ScrollReveal>
            <span className="eyebrow">Insights &amp; Updates</span>
            <h2 className="mt-3 font-display text-display-md font-extrabold uppercase leading-tight">
              What&apos;s moving <span className="text-brand-500">the EV industry.</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.06} className="text-sm font-semibold text-brand-600">
            View all articles →
          </ScrollReveal>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ARTICLES.map((a, i) => (
            <ScrollReveal key={a.title} delay={i * 0.06} className="group overflow-hidden rounded-2xl border border-line">
              <div className={`flex h-36 flex-col justify-between bg-gradient-to-br ${a.gradient} p-4`}>
                <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {a.tag}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-sm font-bold leading-snug">{a.title}</h3>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
