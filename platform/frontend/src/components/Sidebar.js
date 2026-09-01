'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { href: '/tenants', label: 'Tenants' },
  { href: '/billing', label: 'Billing Plans' },
  { href: '/invoices', label: 'Invoices' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="font-semibold text-gray-900">Livanto Platform</div>
        <div className="text-xs text-gray-500">Super-admin console</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              'block px-3 py-2 rounded-lg text-sm font-medium',
              pathname.startsWith(l.href) ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
