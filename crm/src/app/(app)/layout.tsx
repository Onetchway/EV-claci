"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, FileClock, KanbanSquare, LayoutDashboard, LogOut, MapPin,
  Menu, Package, ShieldCheck, Users, Users2, X, Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, Button, Spinner } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/leads", label: "Leads", icon: Users2 },
  { href: "/sites", label: "Site Enquiries", icon: MapPin },
  { href: "/catalog", label: "Charger Catalogue", icon: Package },
  { href: "/agents", label: "Agent Performance", icon: BarChart3, adminOnly: true },
  { href: "/users", label: "Team & Roles", icon: Users, adminOnly: true },
  { href: "/logs", label: "Audit Log", icon: FileClock, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, profile, role, signOut, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && configured && !user) router.replace("/login");
  }, [loading, user, configured, router]);

  useEffect(() => setNavOpen(false), [pathname]);

  if (!configured) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <p className="font-semibold">Firebase is not configured</p>
          <p className="mt-1">
            Copy <code>.env.example</code> to <code>.env.local</code>, add your Firebase web keys,
            and restart. See <code>crm/README.md</code> for the full setup.
          </p>
        </div>
      </main>
    );
  }

  if (loading || (user && !profile)) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        <Spinner className="h-7 w-7" />
      </main>
    );
  }

  if (!user) return null;

  if (profile && !profile.active) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-card">
          <ShieldCheck className="mx-auto h-8 w-8 text-rose-500" />
          <h1 className="mt-3 text-base font-semibold text-ink-900">Account deactivated</h1>
          <p className="mt-1 text-sm text-ink-500">
            Your access has been switched off. Please contact your administrator.
          </p>
          <Button className="mt-4" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </main>
    );
  }

  const items = NAV.filter((n) => !n.adminOnly || (role && isAdmin(role)));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Zap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Livanto Green</p>
          <p className="truncate text-[11px] text-ink-400">Franchise CRM</p>
        </div>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-brand-600 font-medium text-white"
                    : "text-ink-300 hover:bg-ink-800 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={profile?.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profile?.name}</p>
            <p className="truncate text-[11px] text-ink-400">
              {role ? ROLE_LABEL[role] : ""}
            </p>
          </div>
          <button
            onClick={() => void signOut().then(() => router.replace("/login"))}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-60 shrink-0 bg-ink-900 lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-64 bg-ink-900">
            <button
              onClick={() => setNavOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-1.5 text-ink-400 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-ink-900">Livanto Green CRM</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
