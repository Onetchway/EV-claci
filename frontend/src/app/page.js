import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Home() {
  // See middleware.js — in path-based tenant mode this header carries the
  // tenant slug that was stripped from the URL, so the redirect target
  // keeps it (redirect() targets are absolute and don't get re-rewritten).
  const slug = headers().get('x-tenant-slug');
  redirect(slug ? `/${slug}/dashboard` : '/dashboard');
}
