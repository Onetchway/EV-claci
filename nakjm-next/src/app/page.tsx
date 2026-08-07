import { buildMetadata } from "@/lib/seo";
import { faqSchema, homeFaqs } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";

import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Services } from "@/components/home/Services";
import { PinnedProcess } from "@/components/home/PinnedProcess";
import { HorizontalProjects } from "@/components/home/HorizontalProjects";
import { Timeline } from "@/components/home/Timeline";
import { Testimonials } from "@/components/home/Testimonials";
import { CtaBanner } from "@/components/home/CtaBanner";
import { Awards } from "@/components/home/Awards";

export const metadata = buildMetadata({
  title: "NAKJM Infrastructure — Total EPC Solutions for National Infrastructure",
  description:
    "NAKJM Infrastructure Pvt. Ltd. delivers turnkey civil, electrical and EV charging infrastructure across India. 1,000+ chargers, 300+ sites, 100% in-house execution since 2013.",
  path: "/",
  image: "/images/hub-electriva.jpg",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqSchema(homeFaqs)} />
      <Hero />
      <Marquee />
      <Services />
      <PinnedProcess />
      <HorizontalProjects />
      <Timeline />
      <Awards />
      <Testimonials />
      <CtaBanner />
    </>
  );
}
