import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { services } from "@/lib/data/services";
import { projects } from "@/lib/data/projects";

// Static export pre-renders these at build time rather than serving them
// from a route handler.
export const dynamic = "force-static";

const staticRoutes = [
  { path: "/", priority: 1.0, freq: "weekly" as const },
  { path: "/about/", priority: 0.8, freq: "monthly" as const },
  { path: "/services/", priority: 0.9, freq: "monthly" as const },
  { path: "/sectors/", priority: 0.8, freq: "monthly" as const },
  { path: "/projects/", priority: 0.9, freq: "weekly" as const },
  { path: "/capabilities/", priority: 0.8, freq: "monthly" as const },
  { path: "/sustainability/", priority: 0.7, freq: "yearly" as const },
  { path: "/careers/", priority: 0.7, freq: "weekly" as const },
  { path: "/news/", priority: 0.7, freq: "weekly" as const },
  { path: "/contact/", priority: 0.9, freq: "yearly" as const },
  { path: "/privacy/", priority: 0.3, freq: "yearly" as const },
  { path: "/terms/", priority: 0.3, freq: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    ...staticRoutes.map((r) => ({
      url: new URL(r.path, site.url).toString(),
      lastModified: now,
      changeFrequency: r.freq,
      priority: r.priority,
    })),
    ...services.map((s) => ({
      url: new URL(`/services/${s.slug}/`, site.url).toString(),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...projects.map((p) => ({
      url: new URL(`/projects/${p.slug}/`, site.url).toString(),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
