import Link from "next/link";
import Image from "next/image";

const destinations = [
  { href: "/services/", label: "Services", blurb: "Six disciplines, one contract" },
  { href: "/projects/", label: "Projects", blurb: "Delivered at national scale" },
  { href: "/about/", label: "Company", blurb: "Twelve years, one team" },
  { href: "/contact/", label: "Contact", blurb: "Start a project enquiry" },
];

export default function NotFound() {
  return (
    <>
      <section className="relative flex min-h-[80svh] items-end overflow-hidden bg-navy-950 pb-20 pt-44">
        <Image
          src="/images/hub-xpulse.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,10,28,0.96)_0%,rgba(0,10,28,0.82)_45%,rgba(0,10,28,0.4)_100%)]" />

        <div className="shell relative">
          <span className="eyebrow eyebrow-light">Error 404</span>
          <p className="mt-8 text-[clamp(5rem,18vw,14rem)] font-light leading-[0.82] tracking-[-0.05em] text-white/10">
            404
          </p>
          <h1 className="-mt-6 max-w-[16ch] text-headline text-white">
            That page has <span className="text-crimson-400">moved on.</span>
          </h1>
          <p className="mt-8 max-w-[46ch] text-lede text-white/55">
            The page you were looking for is not here. Everything we build is
            still a click away.
          </p>
          <Link
            href="/"
            className="group mt-12 inline-flex items-center gap-3 bg-crimson px-9 py-5 text-eyebrow uppercase text-white transition-colors duration-300 hover:bg-crimson-700"
          >
            Back to home
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      <section className="bg-white py-section">
        <div className="shell">
          <span className="eyebrow">Try one of these</span>
          <div className="mt-12 border-t border-navy/10">
            {destinations.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="group grid grid-cols-[1fr_auto] items-baseline gap-6 border-b border-navy/10 py-8"
              >
                <div>
                  <h2 className="text-title text-navy transition-transform duration-500 ease-editorial group-hover:translate-x-3">
                    {d.label}
                  </h2>
                  <p className="mt-2 text-ink/45">{d.blurb}</p>
                </div>
                <span aria-hidden className="text-eyebrow uppercase text-crimson opacity-0 transition-opacity duration-400 group-hover:opacity-100">
                  Go →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
