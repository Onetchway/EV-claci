'use client';

import { useAuth } from '@/lib/auth';

export default function Header() {
  const { admin, logout } = useAuth();
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-4">
      <span className="text-sm text-gray-600">{admin?.name} · {admin?.role}</span>
      <button className="btn-secondary" onClick={logout}>Log out</button>
    </header>
  );
}
