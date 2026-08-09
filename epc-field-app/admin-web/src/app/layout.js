import './globals.css';

export const metadata = {
  title: 'NaKJM EPC Field App — Admin',
  description: 'Admin dashboard for EPC field survey & reporting',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
