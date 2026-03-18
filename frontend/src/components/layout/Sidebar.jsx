'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard, MapPin, Zap, Battery, Users2, TrendingUp,
  FileText, Settings, LogOut, ChevronRight, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Stations',     href: '/stations',     icon: MapPin },
  { label: 'Chargers',     href: '/chargers',     icon: Zap },
  { label: 'Battery Swap', href: '/bss',          icon: Battery },
  { label: 'Franchises',   href: '/franchise',    icon: Building2 },
  { label: 'Sessions',     href: '/sessions',     icon: FileText },
  { label: 'Revenue',      href: '/revenue',      icon: TrendingUp },
  { label: 'Settlements',  href: '/settlements',  icon: FileText },
  { label: 'Users',        href: '/users',        icon: Users2, role: 'ADMIN' },
];

export default function Sidebar() {
  const path    = usePathname();
  const { data: session } = useSession();
  const role    = session?.user?.role;

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-gray-900 text-white flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
        <div className="p-2 rounded-lg bg-brand-500">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-none">Electriva</p>
          <p className="text-xs text-gray-400">CSMS Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV.filter(item => !item.role || item.role === role).map(({ label, href, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800')}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-700 p-4">
        {session?.user && (
          <div className="flex items-center gap-3 mb-3">
            {session.user.image
              ? <img src={session.user.image} className="w-8 h-8 rounded-full" alt="" />
              : <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold">{session.user.name?.[0]}</div>
            }
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-gray-400 truncate">{role}</p>
            </div>
          </div>
        )}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
