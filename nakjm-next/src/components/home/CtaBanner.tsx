import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-navy-950">
      <Image
        src="/images/hub-electriva.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,10,28,0.96)_0%,rgba(0,10,28,0.86)_45%,rgba(0,10,28,0.45)_100%)]" />

      <div className="shell relative py-section">
        <span className="eyebrow eyebrow-light">Start a project</span>
        <h2 className="mt-8 max-w-[15ch] text-headline text-white">
          Building the <span className="text-crimson-400">new energy era.</span>
        </h2>
        <p className="mt-8 max-w-[52ch] text-lede text-white/60">
          Send us the site, the sanctioned load and the timeline. We come back
          with a feasibility view and a single-contract delivery plan.
        </p>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="group inline-flex items-center gap-3 bg-crimson px-9 py-5 text-eyebrow uppercase text-white transition-colors duration-300 hover:bg-crimson-700"
          >
            Commission a project
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
          <a
            href={`tel:${site.phoneHref}`}
            className="inline-flex items-center gap-3 border border-white/30 px-9 py-5 text-eyebrow uppercase text-white transition-colors duration-300 hover:border-white hover:bg-white hover:text-navy"
          >
            {site.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
