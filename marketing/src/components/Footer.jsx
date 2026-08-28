import Link from 'next/link';
import { Linkedin, Youtube, Twitter, Instagram } from 'lucide-react';

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

function AppleGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.365 1.43c0 1.14-.462 2.15-1.217 2.95-.828.88-2.13 1.56-3.24 1.47-.12-1.12.462-2.28 1.187-3.02.812-.84 2.19-1.47 3.27-1.4zM20.14 17.3c-.5 1.16-.74 1.68-1.39 2.7-.9 1.44-2.17 3.24-3.75 3.25-1.4.02-1.76-.92-3.66-.91-1.9.01-2.3.93-3.7.92-1.58-.01-2.78-1.63-3.68-3.07C1.06 16.83.28 12.7 1.68 9.94c.98-1.94 2.75-3.17 4.67-3.19 1.5-.02 2.6.99 3.66.99 1.03 0 2.47-1.22 4.17-1.04.71.03 2.7.29 3.98 2.17-.1.07-2.38 1.39-2.35 4.14.03 3.29 2.9 4.39 2.93 4.4-.03.09-.46 1.6-1.54 2.89z" />
    </svg>
  );
}
function PlayGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3.6 2.6a1 1 0 0 0-.6.9v17a1 1 0 0 0 .6.9l9.9-9.4-9.9-9.4z" fill="#00D2FF" />
      <path d="M13.5 12l3.5-3.3-9.9-5.6a1 1 0 0 0-.5-.15L13.5 12z" fill="#00F076" />
      <path d="M13.5 12l-6.9 9.05c.16-.02.33-.07.5-.16l9.9-5.6L13.5 12z" fill="#FF3A44" />
      <path d="M17 8.7l-3.5 3.3 3.5 3.3 4.4-2.5a1 1 0 0 0 0-1.6L17 8.7z" fill="#FFCE00" />
    </svg>
  );
}
const APP_LINKS = [
  { href: '#', Glyph: AppleGlyph, top: 'Download on the', bottom: 'App Store' },
  { href: '#', Glyph: PlayGlyph, top: 'Get it on', bottom: 'Google Play' },
];

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
          <div className="flex gap-3">
            {APP_LINKS.map(({ href, Glyph, top, bottom }) => (
              <a
                key={bottom}
                href={href}
                aria-label={`${top} ${bottom}`}
                className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 transition-colors hover:border-lime"
              >
                <Glyph className="h-5 w-5 text-white" />
                <span className="leading-tight">
                  <span className="block text-[9px] text-white/55">{top}</span>
                  <span className="block text-xs font-semibold text-white">{bottom}</span>
                </span>
              </a>
            ))}
          </div>

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
          <span>Noida &amp; Lucknow, Uttar Pradesh, India</span>
        </div>
      </div>
    </footer>
  );
}
