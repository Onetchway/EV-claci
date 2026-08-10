'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken } from './api';

/** Client-side guard: redirects to /login if no session token is present. */
export function useAuthGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  return ready;
}
