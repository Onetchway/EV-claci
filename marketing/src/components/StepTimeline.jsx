import ScrollReveal from './ScrollReveal';

export default function StepTimeline({ steps }) {
  return (
    <div className="relative grid grid-cols-2 gap-y-10 sm:grid-cols-4">
      <div className="absolute left-[12.5%] right-[12.5%] top-4 hidden h-px bg-line sm:block" />
      {steps.map((s, i) => (
        <ScrollReveal key={s.title} delay={i * 0.08} className="relative text-center">
          <div className="relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand-500 bg-white font-display text-xs font-bold text-brand-600">
            {String(i + 1).padStart(2, '0')}
          </div>
          <h4 className="mt-3 text-xs font-bold uppercase tracking-wide">{s.title}</h4>
          <p className="mx-auto mt-1 max-w-[16ch] text-xs text-muted">{s.body}</p>
        </ScrollReveal>
      ))}
    </div>
  );
}
