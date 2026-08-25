"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BarChart3, Battery, BookOpen, Boxes, Building2, CalendarClock, ChevronDown, FileClock, FileSignature, FileSpreadsheet, FileText,
  Gauge, Globe, HardHat, Handshake, IdCard, IndianRupee, KanbanSquare, Landmark, LayoutDashboard,
  ListTodo, LogOut, Mail, MapPin, Menu, MessageSquareWarning, Package, Percent, Plug, Receipt, Repeat, Scale, Search, Settings, ShieldCheck,
  Terminal, Ticket, Trash2, TrendingUp, Truck, UserCircle, Users, Users2, Workflow, X, Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { Avatar, Button, EmptyState, Spinner } from "@/components/ui";
import { useChargerCatalog } from "@/hooks/use-catalog";
import { useSettings } from "@/hooks/use-settings";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { subscribeRoleAccessPolicy } from "@/lib/db/access-policy";
import { subscribeOrganization } from "@/lib/db/organizations";
import { hasPageAccess } from "@/lib/page-access";
import { isAdmin } from "@/lib/permissions";
import type { Organization } from "@/lib/types";
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

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agents", label: "Team Performance", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: "CMS",
    items: [
      { href: "/cms-dashboard", label: "CMS Dashboard", icon: LayoutDashboard },
      { href: "/chargers", label: "Charger Management", icon: Zap },
      { href: "/rfid", label: "RFID Tokens", icon: IdCard },
      { href: "/register-charger", label: "Register My Charger", icon: Plug },
      { href: "/stations", label: "Station Management", icon: Building2 },
      { href: "/sessions", label: "Sessions", icon: Battery },
      { href: "/tickets", label: "Ticket Management", icon: Ticket },
      { href: "/complaints", label: "Complaints", icon: MessageSquareWarning },
      { href: "/tariffs", label: "Tariffs & Pricing", icon: IndianRupee },
      { href: "/zones", label: "Zones & Load Balancing", icon: MapPin },
      { href: "/earnings", label: "Earnings & Statistics", icon: TrendingUp },
      { href: "/insights", label: "Business Insights", icon: Gauge },
      { href: "/emsp-users", label: "User Management", icon: UserCircle },
      { href: "/payments", label: "Payment Transactions", icon: Receipt },
      { href: "/fleets", label: "Fleet Management", icon: Truck },
      { href: "/depot-charging", label: "Depot / Scheduled Charging", icon: CalendarClock },
      { href: "/invoices", label: "Invoicing", icon: FileText },
      { href: "/settlements", label: "Settlements", icon: IndianRupee },
      { href: "/reconciliation", label: "Razorpay Reconciliation", icon: Scale },
      { href: "/coupons", label: "Coupons", icon: Percent },
      { href: "/campaigns", label: "Campaigns", icon: Mail },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/ocpi", label: "OCPI Roaming", icon: Globe, adminOnly: true },
      { href: "/roaming", label: "CPO Roaming (Outbound)", icon: Globe, adminOnly: true },
      { href: "/organizations", label: "White label CMS", icon: Building2, adminOnly: true },
      { href: "/reports", label: "Reports", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/leads", label: "All Leads", icon: Users2 },
      { href: "/loans", label: "Loan Customers", icon: Landmark },
      { href: "/sites", label: "Site Enquiries", icon: MapPin },
      { href: "/partners", label: "Channel Partners", icon: Handshake },
      { href: "/quotations", label: "Create Quotation", icon: FileSignature },
      { href: "/proforma-invoices", label: "Proforma Invoices", icon: FileSpreadsheet },
      { href: "/catalog", label: "Charger Catalogue", icon: Package },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/projects", label: "Project Management", icon: HardHat },
      { href: "/vendors", label: "Vendor Management", icon: Truck },
      { href: "/purchase-orders", label: "Purchase Orders", icon: FileText },
      { href: "/assets", label: "Asset Register", icon: Boxes },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/users", label: "Team & Roles", icon: Users, adminOnly: true },
      { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
      { href: "/auto-triggers", label: "Auto Triggers", icon: Zap, adminOnly: true },
      { href: "/workflows", label: "Workflows", icon: Workflow, adminOnly: true },
      { href: "/diagnostics", label: "Diagnostic Knowledge Base", icon: BookOpen },
      { href: "/logs", label: "Audit Log", icon: FileClock, adminOnly: true },
      { href: "/developer", label: "Developer (API & Webhooks)", icon: Terminal, adminOnly: true },
      { href: "/trash", label: "Trash", icon: Trash2, adminOnly: true },
    ],
  },
];

/**
 * A recreated text wordmark — the actual logo file has only ever been
 * pasted inline in chat, never uploaded, so there's no image asset to
 * embed. This is styled to match closely: the triangle stands in for the
 * "a" in "livanto" (as it does in the source mark), and the "green."
 * period is a filled dot rather than a literal "." glyph. Once a real
 * logo file exists at Settings → Company → Logo URL (settings.company.logoUrl,
 * e.g. an upload to /public/logo.png), the sidebar prefers that automatically
 * — see the logoUrl check in AppLayout below — so this component stops
 * being used without any further code change.
 */
function LivantoWordmark() {
  return (
    <div className="flex flex-col leading-[1.05]">
      <div className="flex items-end text-[16px] font-extrabold tracking-tight text-navy-900">
        <span>liv</span>
        <svg viewBox="0 0 10 8" className="mx-px mb-[3px] h-[8px] w-[9px] fill-brand-600" aria-hidden>
          <polygon points="5,0 10,8 0,8" />
        </svg>
        <span>nto</span>
      </div>
      <span className="flex items-baseline text-[16px] font-extrabold tracking-tight text-brand-600">
        green
        <span className="ml-[3px] h-[4px] w-[4px] shrink-0 rounded-full bg-brand-600" />
      </span>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, profile, role, roles, signOut, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);
  const [rolePolicy, setRolePolicy] = useState<Record<string, Role[]> | null>(null);
  const { settings } = useSettings();

  useEffect(() => subscribeRoleAccessPolicy(setRolePolicy), []);

  // Keeps the pricing engine's custom-charger registry in sync app-wide, not
  // just while the Catalogue page happens to be mounted.
  useChargerCatalog();

  useEffect(() => {
    if (!profile?.orgId) { setOrg(null); return; }
    return subscribeOrganization(profile.orgId, setOrg);
  }, [profile?.orgId]);

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

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => (!n.adminOnly || (role && isAdmin(role)))
      && hasPageAccess(n.href, roles, { policyOverrides: rolePolicy, userOverrides: profile?.pageAccessOverrides })),
  })).filter((g) => g.items.length > 0);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        {org?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
        ) : settings.company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.company.logoUrl} alt="Livanto Green" className="h-8 max-w-[150px] object-contain object-left" />
        ) : (
          <LivantoWordmark />
        )}
        {org && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy-900">{org.name}</p>
            <p className="truncate text-[11px] text-ink-500">EV Charging CRM</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 scroll-thin">
        <Suspense fallback={<div className="px-3 py-2 text-xs text-ink-500">Loading…</div>}>
          <NavList groups={groups} />
        </Suspense>
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={profile?.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy-900">{profile?.name}</p>
            <p className="truncate text-[11px] text-ink-500">
              {role ? ROLE_LABEL[role] : ""}
            </p>
          </div>
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
    <div className="flex min-h-screen bg-ink-50 print:bg-white">
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur print:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-ink-900 lg:hidden">Livanto Green CRM</span>
          <div className="hidden flex-1 lg:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/tasks"
              className={cn(
                "rounded-lg p-2 hover:bg-ink-100",
                pathname === "/tasks" ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-800",
              )}
              title="Tasks"
            >
              <ListTodo className="h-5 w-5" />
            </Link>
            <Link
              href="/pipeline"
              className={cn(
                "rounded-lg p-2 hover:bg-ink-100",
                pathname === "/pipeline" ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-800",
              )}
              title="Pipeline"
            >
              <KanbanSquare className="h-5 w-5" />
            </Link>
            {user && <NotificationBell uid={user.uid} />}
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {hasPageAccess(pathname, roles, { policyOverrides: rolePolicy, userOverrides: profile?.pageAccessOverrides }) ? children : (
            <EmptyState
              icon={<ShieldCheck className="h-8 w-8 text-rose-500" />}
              title="Restricted"
              description="Your role doesn't have access to this page. Contact your administrator if you believe this is wrong."
            />
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * The sidebar links.
 *
 * Split out because it reads the query string — "Company Stations" is
 * `/projects?ownership=COCO`, so the active state has to compare the query as
 * well as the path, and `useSearchParams` requires a Suspense boundary for
 * Next to prerender the surrounding page.
 */
function NavList({ groups }: { groups: { label: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("livanto-nav-collapsed");
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(label: string) {
    setCollapsed((c) => {
      const next = { ...c, [label]: !c[label] };
      try { localStorage.setItem("livanto-nav-collapsed", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(needle)) }))
        .filter((g) => g.items.length > 0)
    : groups;

  return (
    <>
      <div className="relative mb-3 px-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-lg border border-ink-200 bg-ink-50 py-1.5 pl-8 pr-2 text-sm text-navy-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {filtered.map((group, i) => {
        const isCollapsed = !needle && group.label && collapsed[group.label];
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
                  const [path, queryString] = href.split("?");
                  const active =
                    (pathname === path || pathname.startsWith(`${path}/`)) &&
                    (queryString ?? "") === search;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition",
                          active
                            ? "bg-brand-600 font-medium text-white"
                            : "text-ink-600 hover:bg-ink-100 hover:text-navy-900",
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
