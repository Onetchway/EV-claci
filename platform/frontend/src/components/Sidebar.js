'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  Activity, Blocks, Building2, LayoutGrid, LayoutDashboard, ListChecks, Receipt, ScrollText, ShieldCheck, Tag, Wallet,
} from 'lucide-react';

// Grouped per Alpha's own nav spec (Overview / Customers / Product /
// Revenue / Configuration / Platform / Alpha Admin) -- only groups with
// at least one real, working page are shown; the rest fill in as later
// phases build their pages, rather than linking to something that
// doesn't exist yet.
const GROUPS = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Customers',
    items: [{ href: '/tenants', label: 'Organizations', icon: Building2 }],
  },
  {
    label: 'Product',
    items: [
      { href: '/billing', label: 'Plans', icon: LayoutGrid },
      { href: '/modules', label: 'Modules', icon: Blocks },
      { href: '/add-ons', label: 'Add-ons', icon: Wallet },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/coupons', label: 'Coupons', icon: Tag },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/jobs', label: 'Jobs', icon: ListChecks },
      { href: '/system-health', label: 'System Health', icon: Activity },
    ],
  },
  {
    label: 'Alpha Admin',
    items: [{ href: '/admins', label: 'Administrators', icon: ShieldCheck }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-white border-r border-ink-100 flex flex-col"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-ink-100">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          A
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">Alpha</div>
          <div className="truncate text-[11px] text-ink-400">Super-admin console</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
