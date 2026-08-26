"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, EmptyState, Input, PageHeader, Spinner, StatCard,
} from "@/components/ui";
import { subscribeSitePartners } from "@/lib/db/site-partners";
import { canManageSitePartners, canSeeAllLeads } from "@/lib/permissions";
import { SOURCE_LABEL } from "@/lib/constants";
import type { SitePartner } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Site Partners — a person or company (e.g. a DISCOM offering several
 * locations at once) who might host a charging station. Separate from the
 * Leads pipeline: a partner offering 5-20 locations is one record here, not
 * that many separate leads.
 */
export default function SiteEnquiriesPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<SitePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(
    () => subscribeSitePartners(
      { ownerId: canSeeAllLeads(viewer) ? undefined : viewer.uid },
      (r) => { setRows(r); setLoading(false); },
      () => setLoading(false),
    ),
    [viewer.uid],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((p) => [p.contactName, p.company, p.code, p.city, p.phone, ...p.locations.map((l) => l.locationName)]
      .filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, search]);

  const stats = useMemo(() => {
    const totalLocations = rows.reduce((a, p) => a + p.locations.length, 0);
    const available = rows.reduce((a, p) => a + p.locations.filter((l) => l.status === "AVAILABLE").length, 0);
    const mapped = rows.reduce((a, p) => a + p.locations.filter((l) => l.status === "MAPPED").length, 0);
    return { totalLocations, available, mapped };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Site Enquiries"
        description="People and companies offering a location for a charging station — a partner can offer several locations at once."
        actions={
          canManageSitePartners(viewer) && (
            <Link href="/site-enquiries/new">
              <Button variant="primary"><Plus className="h-4 w-4" /> New site partner</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Site partners" value={rows.length} />
        <StatCard label="Locations offered" value={stats.totalLocations} />
        <StatCard label="Available" value={stats.available} tone="positive" />
        <StatCard label="Mapped to a lead" value={stats.mapped} />
      </div>

      <div className="card mb-4 p-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partner, company, location…" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No site partners yet"
          description="When a property owner or company shares one or more locations, capture them here."
          action={canManageSitePartners(viewer) ? <Link href="/site-enquiries/new"><Button variant="primary"><Plus className="h-4 w-4" /> New site partner</Button></Link> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/site-enquiries/${p.id}`} className="card card-pad block transition hover:border-brand-400 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.contactName}{p.company ? ` — ${p.company}` : ""}</p>
                  <p className="truncate text-xs text-ink-500">{p.code} · {p.phone}</p>
                </div>
                <Badge className={p.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                  {p.status}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Badge className="bg-sky-100 text-sky-800 ring-sky-200">
                  <MapPin className="h-3 w-3" /> {p.locations.length} location{p.locations.length === 1 ? "" : "s"}
                </Badge>
                {p.locations.filter((l) => l.status === "AVAILABLE").length > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">
                    {p.locations.filter((l) => l.status === "AVAILABLE").length} available
                  </Badge>
                )}
              </div>

              {p.locations.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-xs text-ink-600">
                  {p.locations.slice(0, 3).map((l) => (
                    <li key={l.id} className="truncate">&middot; {l.locationName || "Unnamed location"}</li>
                  ))}
                  {p.locations.length > 3 && <li className="text-ink-400">+{p.locations.length - 3} more</li>}
                </ul>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Avatar name={p.ownerName} size={18} />
                  <span className="truncate">{p.ownerName}</span>
                </span>
                <span className="shrink-0">{SOURCE_LABEL[p.source]} · {formatDate(p.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
