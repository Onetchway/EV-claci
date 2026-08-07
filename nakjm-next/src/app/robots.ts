import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Static export pre-renders these at build time rather than serving them
// from a route handler.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: new URL("/sitemap.xml", site.url).toString(),
    host: site.url,
  };
}
