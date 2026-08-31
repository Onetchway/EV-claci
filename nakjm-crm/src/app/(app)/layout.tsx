"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle, Boxes, Briefcase, Building2, CalendarCheck, CalendarDays, ChevronDown, ClipboardList, Cog,
  FileSignature, FileSpreadsheet, FileText, Gavel, History, LayoutDashboard, Layers, LogOut, Mail, Menu, Search,
  ShieldCheck, Trash2, Truck, Users, Users2, X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { GlobalSearchModal } from "@/components/global-search-modal";
import { NotificationsBell } from "@/components/notifications-bell";
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

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * EPC project-management focused nav — Dashboard and Clients up top, then
 * Operations (the project execution pipeline: projects, vendors, PO, PI,
 * quotation/BOQ, assets), HRMS and Settings below.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/tenders", label: "Tenders", icon: Gavel },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/projects", label: "Project Management", icon: Briefcase },
      { href: "/vendors", label: "Vendor Management", icon: Truck },
      { href: "/purchase-orders", label: "Purchase Orders", icon: FileText },
      { href: "/proforma-invoices", label: "Proforma Invoices", icon: FileSpreadsheet },
      { href: "/rfqs", label: "RFQs", icon: Mail },
      { href: "/quotations", label: "Quotations", icon: FileSignature },
      { href: "/boq", label: "BOQ", icon: Layers },
      { href: "/assets", label: "Asset Register", icon: Boxes },
      { href: "/team", label: "Team Assignments", icon: ClipboardList },
      { href: "/issues", label: "Issues", icon: AlertTriangle },
    ],
  },
  {
    label: "HRMS",
    items: [
      { href: "/employees", label: "Employees", icon: Users2 },
      { href: "/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/holidays", label: "Holidays", icon: CalendarDays },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/users", label: "Team & Roles", icon: Users, adminOnly: true },
      { href: "/settings", label: "Settings", icon: Cog, adminOnly: true },
      { href: "/audit-log", label: "Audit Log", icon: History, adminOnly: true },
      { href: "/trash", label: "Trash", icon: Trash2, adminOnly: true },
    ],
  },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <Image src="/logo.png" alt="NAKJM Infrastructure" width={132} height={42} priority className="h-9 w-auto" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, user, profile, role, configured, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!loading && configured && !user) router.replace("/login");
  }, [loading, user, configured, router]);

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!configured) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <p className="font-semibold">Firebase is not configured</p>
          <p className="mt-1">
            Copy <code>.env.example</code> to <code>.env.local</code>, add your Firebase web keys,
            and restart. See <code>nakjm-crm/README.md</code> for the full setup.
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

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => !n.adminOnly || (role && isAdmin(role))),
  })).filter((g) => g.items.length > 0);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="px-4 py-4"><Wordmark /></div>

      <div className="px-3 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-500 hover:bg-ink-100"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Search…</span>
          <kbd className="shrink-0 rounded border border-ink-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-500">⌘K</kbd>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 scroll-thin">
        <NavList groups={groups} pathname={pathname} />
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={profile?.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy-900">{profile?.name}</p>
            <p className="truncate text-[11px] text-ink-500">{role ? ROLE_LABEL[role] : ""}</p>
          </div>
          <NotificationsBell />
          <button
            onClick={() => void signOut().then(() => router.replace("/login"))}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-navy-900"
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
      <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-64 bg-white">
            <button
              onClick={() => setNavOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-1.5 text-ink-500 hover:text-navy-900"
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
          <span className="text-sm font-semibold text-ink-900">NAKJM Infrastructure</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

/** Grouped, collapsible, searchable sidebar nav — mirrors Livanto's NavList. */
function NavList({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nakjm-nav-collapsed");
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(label: string) {
    setCollapsed((c) => {
      const next = { ...c, [label]: !c[label] };
      try { localStorage.setItem("nakjm-nav-collapsed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <>
      {groups.map((group, i) => {
        const isCollapsed = group.label && collapsed[group.label];
        return (
          <div key={group.label || `group-${i}`} className="mb-3">
            {group.label && (
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="flex w-full items-center justify-between px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 hover:text-ink-600"
              >
                {group.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
              </button>
            )}
            {!isCollapsed && (
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition",
                          active ? "bg-brand-600 font-medium text-white" : "text-ink-600 hover:bg-ink-100 hover:text-navy-900",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
