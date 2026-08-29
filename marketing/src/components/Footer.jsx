import Link from 'next/link';
import { Linkedin, Youtube, Twitter, Instagram } from 'lucide-react';
import AppBadges from './AppBadges';

const COLUMNS = [
  {
    heading: 'Solutions',
    links: [
      { href: '/solutions#home', label: 'Public Charging' },
      { href: '/solutions#fleet', label: 'Fleet Charging' },
      { href: '/solutions#commercial', label: 'Destination Charging' },
      { href: '/solutions#highway', label: 'Highway Charging' },
    ],
  },
  {
    heading: 'Products',
    links: [
      { href: '/products', label: 'AC Chargers' },
      { href: '/products', label: 'DC Fast Chargers' },
      { href: '/technology', label: 'Software & CMS' },
    ],
  },
  {
    heading: 'For Business',
    links: [
      { href: '/franchise', label: 'Real Estate' },
      { href: '/franchise', label: 'Fleet Operators' },
      { href: '/technology', label: 'Workplaces' },
      { href: '/products', label: 'OEMs' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/about', label: 'Careers' },
      { href: '/about', label: 'News & Media' },
      { href: '/contact', label: 'Contact Us' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms & Conditions' },
      { href: '/privacy', label: 'Cookie Policy' },
    ],
  },
];

const SOCIALS = [Linkedin, Youtube, Twitter, Instagram];

export default function Footer() {
  return (
    <footer className="mode-dark">
      {/* CTA band */}
      <div className="border-b border-line-dark">
        <div className="container-lv flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-center">
          <div>
            <span className="font-display text-2xl font-bold">
              Livanto <span className="text-lime">Green</span>.
            </span>
            <h3 className="mt-1 font-display text-2xl font-extrabold uppercase text-white">
              Next Charging Network.
            </h3>
            <p className="mt-2 text-sm text-white/55">
              Partner with Livanto Green to power the future of mobility.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/franchise" className="btn btn-primary">
              Become a Partner →
            </Link>
            <Link href="/contact" className="btn btn-outline">
              Talk To Livanto →
            </Link>
          </div>
        </div>
      </div>

      <div className="container-lv py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <span className="font-display text-lg font-bold">
              Livanto <span className="text-lime">Green</span>
            </span>
            <p className="mt-3 max-w-[24ch] text-sm text-white/55">
              Building intelligent EV charging infrastructure with technology, sustainability and care at the core.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white/90">{col.heading}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l, i) => (
                  <li key={col.heading + l.label + i}>
                    <Link href={l.href} className="text-sm text-white/55 transition-colors hover:text-lime">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-line-dark pt-8 lg:flex-row lg:items-center lg:justify-between">
          <AppBadges dark />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:justify-end lg:gap-8">
            <div className="flex gap-3">
              {SOCIALS.map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-lime hover:text-lime"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-lime/80">#BeyondCharging</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Livanto Green Private Limited</span>
          <span>Ghaziabad, Noida &amp; Lucknow, Uttar Pradesh, India</span>
        </div>
      </div>
    </footer>
  );
}
