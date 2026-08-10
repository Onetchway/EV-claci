import './globals.css';

export const metadata = {
  title: 'NaKJM Infra — Field Ops Dashboard',
  description: 'Admin dashboard for NaKJM Infra EPC field survey & reporting',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
