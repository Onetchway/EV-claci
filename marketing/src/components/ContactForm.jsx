'use client';

import { useState } from 'react';

const CATEGORIES = [
  'I need a charger',
  'I need infrastructure',
  "I'm interested in franchise",
  'I need fleet charging',
  'I need software',
  'I want to partner',
  'General enquiry',
];

export default function ContactForm() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    setSent(true);
    e.currentTarget.reset();
    setCategory(CATEGORIES[0]);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-line bg-white p-8 md:p-10">
      <fieldset>
        <legend className="text-sm font-semibold text-ink">What do you need?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                category === c
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-line text-ink/70 hover:border-brand-500/50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="name" className="block text-sm font-medium text-ink/70">
            Full name
          </label>
          <input id="name" name="name" required className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink/70">
            Email
          </label>
          <input id="email" name="email" type="email" required className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="mobile" className="block text-sm font-medium text-ink/70">
            Mobile
          </label>
          <input id="mobile" name="mobile" required className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="city" className="block text-sm font-medium text-ink/70">
            City
          </label>
          <input id="city" name="city" className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="message" className="block text-sm font-medium text-ink/70">
            Anything else you&apos;d like us to know?
          </label>
          <textarea id="message" name="message" rows={4} className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </div>
      </div>

      <button type="submit" className="btn btn-primary mt-8">
        Send enquiry →
      </button>
      {sent && <p className="mt-4 text-sm font-medium text-brand-600">Thanks — we&apos;ll be in touch shortly.</p>}
    </form>
  );
}
