import Link from "next/link";
import Image from "next/image";
import { site, footerNav } from "@/lib/site";

const socials = [
  {
    href: site.social.linkedin,
    label: "LinkedIn",
    path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.71h.05c.53-.95 1.83-1.96 3.77-1.96 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.66c0-1.35-.03-3.09-1.96-3.09-1.96 0-2.26 1.46-2.26 2.99V21h-4V9Z",
  },
  {
    href: site.social.instagram,
    label: "Instagram",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.98c-3.15 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.17.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.17a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.24-.06-1.59-.07-4.74-.07Zm0 3.37a4.49 4.49 0 1 1 0 8.98 4.49 4.49 0 0 1 0-8.98Zm0 7.4a2.91 2.91 0 1 0 0-5.82 2.91 2.91 0 0 0 0 5.82Zm5.72-7.6a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z",
  },
  {
    href: site.social.youtube,
    label: "YouTube",
    path: "M23.5 6.9a3 3 0 0 0-2.12-2.13C19.5 4.25 12 4.25 12 4.25s-7.5 0-9.38.52A3 3 0 0 0 .5 6.9C0 8.79 0 12 0 12s0 3.21.5 5.1a3 3 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.13C24 15.21 24 12 24 12s0-3.21-.5-5.1ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z",
  },
];

export function Footer() {
  return (
    <footer className="grain relative bg-navy-950 text-white/55">
      <div className="shell py-20 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.6fr_repeat(3,1fr)] lg:gap-10">
          <div>
            <Image
              src="/images/logo-light.png"
              alt={site.name}
              width={196}
              height={61}
              className="w-[180px]"
            />
            <p className="mt-7 max-w-[34ch] text-sm leading-relaxed">
              {site.legalName} — next-generation mega-builders. Turnkey civil,
              electrical and EV charging infrastructure, executed entirely
              in-house since {site.founded}.
            </p>

            <ul className="mt-9 flex gap-3">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${site.name} on ${s.label}`}
                    className="group relative grid h-11 w-11 place-items-center overflow-hidden border border-white/15 text-white/60 transition-all duration-300 ease-swift hover:-translate-y-1 hover:border-crimson hover:text-white"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 translate-y-full bg-crimson transition-transform duration-400 ease-swift group-hover:translate-y-0"
                    />
                    <svg viewBox="0 0 24 24" className="relative z-10 h-[18px] w-[18px]" aria-hidden>
                      <path fill="currentColor" d={s.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {footerNav.map((col) => (
            <div key={col.title}>
              <h2 className="text-eyebrow uppercase text-white">{col.title}</h2>
              <ul className="mt-6 space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center text-sm text-white/55 transition-colors duration-300 hover:text-white"
                    >
                      <span className="mr-0 h-px w-0 bg-crimson transition-all duration-300 ease-swift group-hover:mr-2 group-hover:w-4" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-10 border-t border-white/10 pt-12 md:grid-cols-3">
          <div>
            <h2 className="text-eyebrow uppercase text-white/40">Head office</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              CoWynd Managed Office, First Floor,
              <br />
              Plot 103, Dwarka Sector 19,
              <br />
              New Delhi — 110075
            </p>
          </div>
          <div>
            <h2 className="text-eyebrow uppercase text-white/40">Speak to us</h2>
            <p className="mt-4 space-y-1 text-sm text-white/70">
              <a href={`tel:${site.phoneHref}`} className="block transition-colors hover:text-white">
                {site.phone}
              </a>
              <a href={`mailto:${site.email}`} className="block transition-colors hover:text-white">
                {site.email}
              </a>
            </p>
          </div>
          <div>
            <h2 className="text-eyebrow uppercase text-white/40">Start a project</h2>
            <Link
              href="/contact"
              className="link-sweep mt-4 text-crimson-400 transition-colors hover:text-white"
            >
              Request a site survey
            </Link>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-white/35 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
          </p>
          <p className="tracking-[0.18em] uppercase">{site.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
