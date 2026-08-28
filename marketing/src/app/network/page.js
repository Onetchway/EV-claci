import Link from 'next/link';
import ScrollReveal from '@/components/ScrollReveal';
import ConnectivityFlow from '@/components/ConnectivityFlow';

export const metadata = {
  title: 'Network',
  description: 'The Livanto Green charging network — built for movement, backed by >95% uptime.',
};

const FILTERS = ['City', 'AC / DC', 'Power', 'Availability'];

export default function NetworkPage() {
  return (
    <>
      <section className="mode-dark pt-40 pb-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Network
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-5 max-w-3xl font-display text-display-lg font-bold">
            A network built for movement.
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.1} className="mt-6 max-w-xl text-lead text-white/65">
            Livanto is expanding across homes, workplaces, commercial sites
            and highways — every station backed by the same uptime commitment.
          </ScrollReveal>
        </div>
      </section>

      {/* Stat strip — real figures only */}
      <section className="mode-dark border-t border-line-dark py-14">
        <div className="container-lv grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { label: 'Network uptime', value: '>95%' },
            { label: 'Charging points', value: 'Growing weekly' },
            { label: 'Cities', value: 'Expanding' },
            { label: 'States', value: 'Expanding' },
          ].map((s) => (
            <ScrollReveal key={s.label}>
              <div className="font-display text-2xl font-bold text-lime md:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-white/40">{s.label}</div>
            </ScrollReveal>
          ))}
        </div>
        <p className="container-lv mt-6 text-xs text-white/35">
          Station-count, city and state figures will be published here once network telemetry goes live.
        </p>
      </section>

      {/* Abstract growth visualization */}
      <section className="mode-dark py-24">
        <div className="container-lv">
          <ScrollReveal as="h2" className="text-center font-display text-display-sm font-semibold">
            One network, always connected.
          </ScrollReveal>
          <div className="mt-16">
            <ConnectivityFlow />
          </div>
        </div>
      </section>

      {/* Station finder shell (demo UI — real station data pending) */}
      <section className="mode-light py-28">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-2xl font-display text-display-md font-semibold">
            Find a station.
          </ScrollReveal>
          <ScrollReveal delay={0.08} className="mt-8 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink/70 hover:border-brand-500/50">
                {f}
              </button>
            ))}
          </ScrollReveal>
          <ScrollReveal
            delay={0.14}
            className="mt-8 flex h-72 items-center justify-center rounded-3xl border border-dashed border-line bg-surface-alt text-center"
          >
            <p className="max-w-sm text-sm text-muted">
              Live station search will appear here once the network directory
              is public. In the meantime, get directions to the nearest
              charger by reaching out directly.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="mode-brand py-24">
        <div className="container-lv flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="max-w-xl font-display text-display-sm font-semibold">Want a Livanto station near you?</h2>
          <Link href="/contact" className="btn bg-white text-brand-800 hover:bg-white/90">
            Get in touch →
          </Link>
        </div>
      </section>
    </>
  );
}
