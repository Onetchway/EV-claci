'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, Mail, MapPin, HelpCircle, Ticket, Headphones, Download } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';

const OFFICES = [
  {
    title: 'Noida Office',
    lines: ['8th Floor, Infinity Techno Park,', 'C56A/16, Block-C, Sector 62,', 'Noida, Uttar Pradesh 201309'],
  },
  {
    title: 'Lucknow Office',
    lines: ['4th Floor, 413 Millennium Palace,', 'Sushant Golf City,', 'Lucknow, Uttar Pradesh 226030'],
  },
];

const HELP_CARDS = [
  { icon: HelpCircle, title: 'FAQs', body: 'Find answers to common questions.' },
  { icon: Ticket, title: 'Raise a Support Ticket', body: "We're here to help you quickly." },
  { icon: Headphones, title: 'Charger Support', body: 'Get help for your charger or station.' },
  { icon: Download, title: 'Download Resources', body: 'Brochures, manuals & more.' },
];

const SUBJECTS = ['General enquiry', 'Charger support', 'Franchise & partnership', 'Fleet charging', 'Software / CMS', 'Press & media'];

function ContactFormFull() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    setSent(true);
    e.currentTarget.reset();
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-line bg-white p-8">
      <h3 className="font-display text-lg font-bold">Send us a message</h3>
      <p className="mt-1 text-sm text-muted">Fill out the form and our team will get back to you.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium text-ink/70">Full Name *</label>
          <input id="name" name="name" required className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" placeholder="Enter your full name" />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink/70">Email Address *</label>
          <input id="email" name="email" type="email" required className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" placeholder="you@email.com" />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm font-medium text-ink/70">Phone Number *</label>
          <input id="phone" name="phone" required className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" placeholder="Enter mobile number" />
        </div>
        <div>
          <label htmlFor="company" className="text-sm font-medium text-ink/70">Company / Organization</label>
          <input id="company" name="company" className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="subject" className="text-sm font-medium text-ink/70">Subject *</label>
          <select id="subject" name="subject" required defaultValue="" className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-brand-500">
            <option value="" disabled>Select a subject</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="message" className="text-sm font-medium text-ink/70">Message *</label>
          <textarea id="message" name="message" required rows={4} className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" placeholder="Type your message here..." />
        </div>
      </div>

      <label className="mt-5 flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" required className="mt-0.5" />
        I agree to the{' '}
        <Link href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link> and{' '}
        <Link href="/terms" className="text-brand-600 hover:underline">Terms of Use</Link>.
      </label>

      <button type="submit" className="btn btn-primary mt-6 w-full justify-center">
        Send Message →
      </button>
      {sent && <p className="mt-3 text-center text-sm font-medium text-brand-600">Thanks — we&apos;ll be in touch shortly.</p>}
    </form>
  );
}

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white pb-16 pt-32 sm:pt-36">
        <div className="container-lv">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <ScrollReveal as="span" className="eyebrow">
                Get in touch
              </ScrollReveal>
              <ScrollReveal as="h1" delay={0.05} className="mt-4 font-display text-display-lg font-bold leading-[1.05]">
                Let&apos;s build India&apos;s
                <br />
                <span className="text-brand-500">next charging network.</span>
              </ScrollReveal>
              <ScrollReveal delay={0.1} as="p" className="mt-5 max-w-md text-muted">
                Have a question, need support, or want to partner with us?
                We&apos;re here to help you power the future of mobility.
              </ScrollReveal>

              <ScrollReveal delay={0.15} className="mt-8 grid grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-alt text-brand-600">
                    <Phone className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <div className="text-xs text-muted">Call Us</div>
                    <a href="tel:+919810403506" className="text-sm font-bold hover:text-brand-600">+91 98104 03506</a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-alt text-brand-600">
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <div className="text-xs text-muted">Email Us</div>
                    <a href="mailto:business@livantogreen.com" className="text-sm font-bold hover:text-brand-600">business@livantogreen.com</a>
                  </div>
                </div>
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
        </div>
      </section>

      {/* Offices + Form */}
      <section className="bg-surface-alt py-20">
        <div className="container-lv grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <ScrollReveal as="h2" className="font-display text-lg font-bold">
              Our Offices
            </ScrollReveal>
            <div className="mt-6 space-y-5">
              {OFFICES.map((o, i) => (
                <ScrollReveal key={o.title} delay={i * 0.08} className="flex gap-4 rounded-2xl border border-line bg-white p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-brand-600">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-brand-600">{o.title}</div>
                    <p className="mt-1 text-sm text-muted">
                      {o.lines.map((l) => (
                        <span key={l} className="block">{l}</span>
                      ))}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          <ScrollReveal delay={0.1}>
            <ContactFormFull />
          </ScrollReveal>
        </div>
      </section>

      {/* Need help */}
      <section className="bg-white py-20">
        <div className="container-lv">
          <ScrollReveal as="h2" className="font-display text-lg font-bold">
            Need help?
          </ScrollReveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HELP_CARDS.map((c, i) => (
              <ScrollReveal key={c.title} delay={i * 0.06} className="rounded-2xl border border-line bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-alt text-brand-600">
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-bold">{c.title}</h3>
                <p className="mt-1 text-xs text-muted">{c.body}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
