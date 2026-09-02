'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Search } from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { opsApi } from '@/lib/api';

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data, unread: u } = await opsApi.notifications();
      setItems(data);
      setUnread(u);
    } catch {
      // Notifications are a convenience surface -- a fetch failure here
      // shouldn't interrupt the console, so it's silently skipped.
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const markAllRead = async () => {
    await opsApi.markAllNotificationsRead();
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative" onClick={() => setOpen((v) => !v)} title="Notifications">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 rounded-xl border border-ink-100 bg-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-100">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 && <button className="text-xs text-brand-600 hover:underline" onClick={markAllRead}>Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-400">Nothing yet.</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className={`px-4 py-3 text-sm border-b border-ink-50 last:border-0 ${n.is_read ? '' : 'bg-brand-50/40'}`}>
                  <p className="font-medium text-ink-800">{n.title}</p>
                  {n.message && <p className="text-ink-500 text-xs mt-0.5">{n.message}</p>}
                  <p className="text-ink-400 text-[11px] mt-1">{new Date(n.created_at).toLocaleString()}{n.tenant_name ? ` · ${n.tenant_name}` : ''}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
        <NotificationsBell />
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
