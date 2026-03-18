'use client';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </SessionProvider>
  );
}
