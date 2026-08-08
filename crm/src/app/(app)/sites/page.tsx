"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, MapPin, Plus, Zap } from "lucide-react";

import {
  LeadFilterBar, emptyFilters, type FilterState,
} from "@/components/lead-filters";
import {
  Avatar, Badge, Button, EmptyState, PageHeader, Spinner, StatCard,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import {
  LOCATION_TYPE_LABEL, OWNERSHIP_LABEL, POWER_LOAD_LABEL, SOURCE_LABEL,
  STAGE_META, STATUS_COLOR, STATUS_LABEL,
} from "@/lib/constants";
import { applyClientFilters } from "@/lib/db/leads";
import { formatDate } from "@/lib/utils";

/**
 * Site enquiries are the "someone wants to share a location" flow — a hotel
 * owner offering his forecourt, not an investor buying a franchise. They need
 * a different read-out: power, ownership, and whether the map pin resolved.
 */
export default function SitesPage() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [expanded, setExpanded] = useState(false);

  const { leads, loading } = useLeads(
    useMemo(
      () => ({ type: "SITE" as const, status: filters.status, ownerId: filters.ownerId || undefined, max: 400 }),
      [filters.status, filters.ownerId],
    ),
  );

  const rows = useMemo(
    () =>
      applyClientFilters(leads, {
        stages: filters.stages,
        sources: filters.sources,
        city: filters.city || undefined,
        search: filters.search || undefined,
        from: filters.from ? new Date(filters.from) : null,
        to: filters.to ? new Date(filters.to) : null,
        overdueOnly: filters.overdueOnly,
      }),
    [leads, filters],
  );

  const stats = useMemo(() => {
    const threePhase = rows.filter((l) => l.site?.powerLoad === "THREE_PHASE" || l.site?.powerLoad === "HT_LINE").length;
    const owned = rows.filter((l) => l.site?.ownership === "OWNED").length;
    const commercial = rows.filter((l) => l.site?.commercialModelInterested).length;
    return { threePhase, owned, commercial };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Site enquiries"
        description="Property owners offering a location for a charging station."
        actions={
          <Link href="/leads/new">
            <Button variant="primary"><Plus className="h-4 w-4" /> New enquiry</Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Site enquiries" value={rows.length} />
        <StatCard label="3-phase or better" value={stats.threePhase} sub="Ready for a DC charger" />
        <StatCard label="Owner-occupied" value={stats.owned} sub="No landlord negotiation needed" />
        <StatCard label="Open to revenue share" value={stats.commercial} />
      </div>

      <LeadFilterBar
        value={filters}
        onChange={setFilters}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((x) => !x)}
      />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No site enquiries yet"
          description="When a property owner shares a location, capture it here with the map link, power load and remarks."
          action={<Link href="/leads/new"><Button variant="primary"><Plus className="h-4 w-4" /> New enquiry</Button></Link>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((l) => (
            <article key={l.id} className="card card-pad">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/leads/${l.id}`} className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-700">
                    {l.client?.name}
                  </Link>
                  <p className="truncate text-xs text-ink-500">{l.code} · {l.client?.phone}</p>
                </div>
                <Badge className={STAGE_META[l.stage].color}>{STAGE_META[l.stage].short}</Badge>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                <p className="flex items-start gap-1.5 text-ink-800">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span className="min-w-0">
                    <span className="font-medium">{l.site?.locationName || "—"}</span>
                    <span className="block text-xs text-ink-500">{l.client?.city}{l.client?.state ? `, ${l.client.state}` : ""}</span>
                  </span>
                </p>

                {l.site?.mapsLink && (
                  <a
                    href={l.site.mapsLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(l.site?.locationTypes ?? []).map((t) => (
                  <Badge key={t}>{LOCATION_TYPE_LABEL[t]}</Badge>
                ))}
                {l.site?.ownership && (
                  <Badge className="bg-sky-100 text-sky-800 ring-sky-200">{OWNERSHIP_LABEL[l.site.ownership]}</Badge>
                )}
                {l.site?.powerLoad && (
                  <Badge className="bg-violet-100 text-violet-800 ring-violet-200">
                    <Zap className="h-3 w-3" /> {POWER_LOAD_LABEL[l.site.powerLoad]}
                  </Badge>
                )}
                {l.site?.commercialModelInterested && (
                  <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">Revenue share OK</Badge>
                )}
                {l.status !== "ACTIVE" && (
                  <Badge className={STATUS_COLOR[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                )}
              </div>

              {l.site?.remarks && (
                <p className="mt-3 line-clamp-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  {l.site.remarks}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Avatar name={l.ownerName} size={18} />
                  <span className="truncate">{l.ownerName}</span>
                </span>
                <span className="shrink-0">{SOURCE_LABEL[l.source]} · {formatDate(l.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
