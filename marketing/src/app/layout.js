import { Sora, Inter } from 'next/font/google';
import './globals.css';
import SmoothScrollProvider from '@/components/SmoothScrollProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://livantogreen.com'),
  title: {
    default: 'Livanto Green — Charging the way forward',
    template: '%s · Livanto Green',
  },
  description:
    'Livanto Green builds intelligent EV charging infrastructure — hardware, software, app and network — for homes, workplaces, fleets and highways across India.',
  openGraph: {
    title: 'Livanto Green — Charging the way forward',
    description: 'Intelligent EV charging infrastructure connecting people, places and the future of mobility.',
    type: 'website',
    siteName: 'Livanto Green',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body>
        <SmoothScrollProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
