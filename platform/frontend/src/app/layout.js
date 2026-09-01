import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Livanto Platform — Super Admin',
  description: 'Manage tenants, feature access, and billing across every client CRM instance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
