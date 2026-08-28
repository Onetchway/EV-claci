import Hero from '@/components/Hero';
import ScrollReveal from '@/components/ScrollReveal';

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Ecosystem, Solutions, Products, Technology, Network, Franchise,
          Final CTA — built next, per the step-by-step process. */}
      <section className="mode-light py-32">
        <div className="container-lv">
          <ScrollReveal as="h2" className="max-w-3xl font-display text-display-lg font-semibold">
            One ecosystem. Every charging need.
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
