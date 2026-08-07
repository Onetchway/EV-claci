import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { ProjectGallery } from "@/components/sections/ProjectGallery";
import { CtaBanner } from "@/components/home/CtaBanner";

export const metadata = buildMetadata({
  title: "Projects",
  description:
    "Electriva, VinFast, XPulse and Tesla charging hubs, industrial estates, educational campuses and corporate fit-outs — delivered across India.",
  path: "/projects/",
  image: "/images/hub-tesla.webp",
});

export default function ProjectsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Projects", path: "/projects/" },
        ])}
      />

      <PageHero
        eyebrow="Projects"
        title="Proof of scale,"
        accent="on the ground."
        lede="1,000+ chargers across 300+ sites, ten factory units and a ground-up school campus — all executed by the same in-house teams."
        image="/images/hub-tesla.webp"
        imageAlt="Tesla Supercharger station delivered by NAKJM in Gurgaon"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Projects", href: "/projects/" },
        ]}
      />

      <ProjectGallery />
      <CtaBanner />
    </>
  );
}
