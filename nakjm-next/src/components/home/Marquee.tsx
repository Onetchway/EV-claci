import Image from "next/image";
import { clients } from "@/lib/data/company";

/** Infinite logo rail. The list is duplicated so the loop has no seam. */
export function Marquee() {
  return (
    <section className="border-y border-navy/8 bg-white py-14">
      <div className="shell">
        <p className="text-center text-eyebrow uppercase text-ink/35">
          Trusted by the tier-1 mobility ecosystem
        </p>
      </div>

      <div
        className="mt-10 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)]"
        aria-hidden
      >
        <div className="flex w-max animate-marquee gap-16 hover:[animation-play-state:paused]">
          {[...clients, ...clients].map((client, i) => (
            <Image
              key={`${client.name}-${i}`}
              src={client.logo}
              alt=""
              width={180}
              height={40}
              className="h-9 w-auto opacity-45 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0"
            />
          ))}
        </div>
      </div>

      <p className="sr-only">
        Clients include {clients.map((c) => c.name).join(", ")}.
      </p>
    </section>
  );
}
