import Link from 'next/link';

const COLUMNS = [
  {
    heading: 'Company',
    links: [
      { href: '/solutions', label: 'Solutions' },
      { href: '/products', label: 'Products' },
      { href: '/technology', label: 'Technology' },
      { href: '/franchise', label: 'Franchise' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    heading: 'Get in touch',
    links: [
      { href: '/contact', label: 'Contact' },
      { href: '/franchise', label: 'Become a partner' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mode-dark">
      <div className="container-lv py-20">
        <p className="font-display text-display-md max-w-3xl text-white">
          Powering the way forward.
        </p>

        <div className="mt-16 grid grid-cols-2 gap-10 border-t border-line-dark pt-12 md:grid-cols-4">
          <div>
            <span className="font-display text-lg font-bold">
              Livanto <span className="text-lime">Green</span>
            </span>
            <p className="mt-3 max-w-[24ch] text-sm text-white/55">
              Powering mobility. Driving sustainability.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-lime/80">
              #BeyondCharging
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-sm font-semibold text-white/90">{col.heading}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-white/55 transition-colors hover:text-lime">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line-dark pt-8 text-xs text-white/40 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Livanto Green Private Limited</span>
          <span>Noida &amp; Lucknow, Uttar Pradesh, India</span>
        </div>
      </div>
    </footer>
  );
}
