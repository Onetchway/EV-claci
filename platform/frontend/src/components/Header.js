'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Search } from 'lucide-react';

import { useAuth } from '@/lib/auth';

export default function Header() {
  const { admin, logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    // Organizations is the only searchable list today (see tenants/page.js's
    // own search box) -- route there with the query prefilled. Widens as
    // more list pages (Users, Invoices, ...) exist to search across.
    router.push(`/tenants?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="h-16 shrink-0 bg-white border-b border-ink-100 flex items-center justify-between px-6 gap-4">
      <form onSubmit={onSearch} className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-9 bg-ink-50 border-transparent focus:bg-white"
          placeholder="Search Alpha..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-ink-800 leading-tight">{admin?.name}</p>
          <p className="text-xs text-ink-400 leading-tight capitalize">{admin?.role?.replace('_', ' ')}</p>
        </div>
        <button className="btn-ghost" onClick={logout} title="Log out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
