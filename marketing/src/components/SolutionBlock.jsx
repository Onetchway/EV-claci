import ScrollReveal from './ScrollReveal';
import ChargerGlyph from './ChargerGlyph';

export default function SolutionBlock({ eyebrow, title, body, reverse, dark, intensity = 0.4 }) {
  return (
    <section className={dark ? 'mode-dark' : 'mode-light'}>
      <div className="container-lv py-24">
        <div className={`grid items-center gap-12 lg:grid-cols-2 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
          <ScrollReveal>
            <span className="eyebrow">{eyebrow}</span>
            <h2 className="mt-4 font-display text-display-md font-semibold">{title}</h2>
            <p className={`mt-5 max-w-md ${dark ? 'text-white/65' : 'text-muted'}`}>{body}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1} className="flex h-72 items-center justify-center rounded-3xl border border-line bg-surface-alt data-[dark=true]:border-line-dark data-[dark=true]:bg-white/[0.03]" data-dark={dark}>
            <ChargerGlyph intensity={intensity} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
