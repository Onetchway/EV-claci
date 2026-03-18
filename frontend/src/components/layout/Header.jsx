'use client';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';

const TITLES = {
  '/dashboard':   'Dashboard',
  '/stations':    'Charging Stations',
  '/chargers':    'Charger Management',
  '/bss':         'Battery Swap Stations',
  '/franchise':   'Franchise Management',
  '/sessions':    'Charging Sessions',
  '/revenue':     'Revenue & P&L',
  '/settlements': 'Settlements',
  '/users':       'User Management',
};

export default function Header() {
  const path  = usePathname();
  const title = Object.entries(TITLES).find(([k]) => path === k || path.startsWith(k + '/'))?.[1] || 'Electriva CSMS';

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </header>
  );
}
