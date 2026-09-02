import { Inter } from 'next/font/google';

import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: 'Alpha Platform — Super Admin',
  description: 'Manage tenants, feature access, and billing across every client CRM instance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
