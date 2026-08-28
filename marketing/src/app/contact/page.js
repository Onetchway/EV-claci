import ScrollReveal from '@/components/ScrollReveal';
import ContactForm from '@/components/ContactForm';

export const metadata = {
  title: 'Contact',
  description: 'Reach the Livanto Green team for chargers, infrastructure, franchise, fleet, software or general enquiries.',
};

export default function ContactPage() {
  return (
    <>
      <section className="mode-dark pt-40 pb-24">
        <div className="container-lv">
          <ScrollReveal as="span" className="eyebrow">
            Contact
          </ScrollReveal>
          <ScrollReveal as="h1" delay={0.05} className="mt-5 max-w-3xl font-display text-display-lg font-bold">
            Let&apos;s build the future together.
          </ScrollReveal>
          <ScrollReveal as="p" delay={0.1} className="mt-6 max-w-xl text-lead text-white/65">
            Reach our team for chargers, infrastructure, franchise, fleet or software enquiries.
          </ScrollReveal>
        </div>
      </section>

      <section className="mode-light py-24">
        <div className="container-lv grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <ScrollReveal>
              <h2 className="font-display text-2xl font-bold">Get in touch</h2>
              <dl className="mt-8 space-y-6">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Email</dt>
                  <dd className="mt-1">
                    <a href="mailto:ashwanidixit@aol.com" className="text-brand-600 hover:text-brand-700">
                      ashwanidixit@aol.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Phone</dt>
                  <dd className="mt-1">
                    <a href="tel:+919810403506" className="text-brand-600 hover:text-brand-700">
                      +91 98104 03506
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Address</dt>
                  <dd className="mt-1 text-ink/80">AG08, Gulmohar Green, Ghaziabad, Uttar Pradesh, India</dd>
                </div>
              </dl>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={0.1}>
            <ContactForm />
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
