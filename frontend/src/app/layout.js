import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Electriva CSMS',
  description: 'EV Charging & Infrastructure Management System',
  icons: { icon: '/favicon.ico' },
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
