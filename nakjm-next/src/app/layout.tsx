import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { site } from "@/lib/site";
import { organizationSchema, websiteSchema, localBusinessSchema } from "@/lib/schema";
import { JsonLd } from "@/components/ui/JsonLd";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { ScrollProgress } from "@/components/shared/ScrollProgress";
import { WhatsAppFloat } from "@/components/shared/WhatsAppFloat";
import { PageTransition } from "@/components/shared/PageTransition";
import { Analytics, GtmNoScript } from "@/components/shared/Analytics";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "700", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Total EPC Solutions for National Infrastructure`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.legalName }],
  creator: site.legalName,
  publisher: site.legalName,
  formatDetection: { telephone: true, address: true, email: true },
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#001E4B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <head>
        <JsonLd data={[organizationSchema, websiteSchema, localBusinessSchema]} />
      </head>
      <body className="bg-white">
        <GtmNoScript />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-[80] focus:bg-navy focus:px-6 focus:py-4 focus:text-white"
        >
          Skip to main content
        </a>

        <SmoothScroll>
          <ScrollProgress />
          <Header />
          <PageTransition>
            <main id="main" className="pb-14 md:pb-0">
              {children}
            </main>
            <Footer />
          </PageTransition>
          <WhatsAppFloat />
        </SmoothScroll>

        <Analytics />
      </body>
    </html>
  );
}
