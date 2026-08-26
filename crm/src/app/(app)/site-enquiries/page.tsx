"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, EmptyState, Input, PageHeader, Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { importLegacySiteLeads, subscribeSitePartners } from "@/lib/db/site-partners";
import { canManageSitePartners, canSeeAllLeads } from "@/lib/permissions";
import {
  LOCATION_TYPES, LOCATION_TYPE_LABEL, SITE_COMPENSATION_TYPE_LABEL, SITE_COMPENSATION_TYPES,
  SOURCE_LABEL, type LocationType, type SiteCompensationType,
} from "@/lib/constants";
import type { SiteLocation, SitePartner } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type LocationStatusFilter = "" | "AVAILABLE" | "MAPPED" | "REJECTED";

/**
 * Site Partners — a person or company (e.g. a DISCOM offering several
 * locations at once) who might host a charging station. Separate from the
 * Leads pipeline: a partner offering 5-20 locations is one record here, not
 * that many separate leads.
 */
export default function SiteEnquiriesPage() {
  const viewer = useViewer();
  const { actor } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const [rows, setRows] = useState<SitePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LocationStatusFilter>("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [compensationType, setCompensationType] = useState<"" | SiteCompensationType>("");
  const [locationType, setLocationType] = useState<"" | LocationType>("");

  async function importLegacy() {
    if (!actor) return;
    const { migrated } = await importLegacySiteLeads(actor);
    push(migrated > 0 ? `Imported ${migrated} legacy site lead${migrated === 1 ? "" : "s"}.` : "No legacy site leads left to import.", "success");
  }

  useEffect(
    () => subscribeSitePartners(
      { ownerId: canSeeAllLeads(viewer) ? undefined : viewer.uid },
      (r) => { setRows(r); setLoading(false); },
      () => setLoading(false),
    ),
    [viewer.uid],
  );

  const cityOptions = useMemo(
    () => [...new Set(rows.map((p) => p.city?.trim()).filter((v): v is string => Boolean(v)))].sort(),
    [rows],
  );
  const stateOptions = useMemo(
    () => [...new Set(rows.map((p) => p.state?.trim()).filter((v): v is string => Boolean(v)))].sort(),
    [rows],
  );

  const locationFiltersActive = Boolean(statusFilter || compensationType || locationType);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((p) => !city || (p.city ?? "").toLowerCase() === city.toLowerCase())
      .filter((p) => !state || (p.state ?? "").toLowerCase() === state.toLowerCase())
      .filter((p) => !needle || [p.contactName, p.company, p.code, p.city, p.phone, ...p.locations.map((l) => l.locationName)]
        .filter(Boolean).join(" ").toLowerCase().includes(needle))
      .map((p) => {
        const matchingLocations = p.locations.filter((l) =>
          (!statusFilter || l.status === statusFilter)
          && (!compensationType || l.compensationType === compensationType)
          && (!locationType || (l.locationTypes ?? []).includes(locationType)));
        return { partner: p, matchingLocations };
      })
      .filter(({ matchingLocations }) => !locationFiltersActive || matchingLocations.length > 0);
  }, [rows, search, city, state, statusFilter, compensationType, locationType, locationFiltersActive]);

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
          <div className="flex items-center gap-2">
            {canSeeAllLeads(viewer) && (
              <Button loading={busy} onClick={() => void run(importLegacy)}>Import legacy site leads</Button>
            )}
            {canManageSitePartners(viewer) && (
              <Link href="/site-enquiries/new">
                <Button variant="primary"><Plus className="h-4 w-4" /> New site partner</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Site partners" value={rows.length} />
        <StatCard label="Locations offered" value={stats.totalLocations} />
        <StatCard label="Available" value={stats.available} tone="positive" />
        <StatCard label="Mapped to a lead" value={stats.mapped} />
      </div>

      <div className="card mb-4 space-y-3 p-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partner, company, location…" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LocationStatusFilter)}
            placeholder="Any status"
            options={[
              { value: "AVAILABLE", label: "Available" },
              { value: "MAPPED", label: "Mapped to a lead" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
          <Select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Any city"
            options={cityOptions.map((c) => ({ value: c, label: c }))}
          />
          <Select
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="Any state"
            options={stateOptions.map((s) => ({ value: s, label: s }))}
          />
          <Select
            value={compensationType}
            onChange={(e) => setCompensationType(e.target.value as "" | SiteCompensationType)}
            placeholder="Rental or revenue share"
            options={SITE_COMPENSATION_TYPES.map((t) => ({ value: t, label: SITE_COMPENSATION_TYPE_LABEL[t] }))}
          />
          <Select
            value={locationType}
            onChange={(e) => setLocationType(e.target.value as "" | LocationType)}
            placeholder="Any location type"
            options={LOCATION_TYPES.map((t) => ({ value: t, label: LOCATION_TYPE_LABEL[t] }))}
          />
        </div>
        {(statusFilter || city || state || compensationType || locationType) && (
          <button
            type="button"
            onClick={() => { setStatusFilter(""); setCity(""); setState(""); setCompensationType(""); setLocationType(""); }}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No site partners match these filters"
          description="Try widening the filters, or add a new site partner."
          action={canManageSitePartners(viewer) ? <Link href="/site-enquiries/new"><Button variant="primary"><Plus className="h-4 w-4" /> New site partner</Button></Link> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ partner: p, matchingLocations }) => {
            const shownLocations = locationFiltersActive ? matchingLocations : p.locations;
            return (
              <Link key={p.id} href={`/site-enquiries/${p.id}`} className="card card-pad block transition hover:border-brand-400 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{p.contactName}{p.company ? ` — ${p.company}` : ""}</p>
                    <p className="truncate text-xs text-ink-500">
                      {p.code} · {p.phone}
                      {(p.city || p.state) && <> · {[p.city, p.state].filter(Boolean).join(", ")}</>}
                    </p>
                  </div>
                  <Badge className={p.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                    {p.status}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <Badge className="bg-sky-100 text-sky-800 ring-sky-200">
                    <MapPin className="h-3 w-3" />
                    {locationFiltersActive ? `${matchingLocations.length} matching` : `${p.locations.length} location${p.locations.length === 1 ? "" : "s"}`}
                  </Badge>
                  {p.locations.filter((l) => l.status === "AVAILABLE").length > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">
                      {p.locations.filter((l) => l.status === "AVAILABLE").length} available
                    </Badge>
                  )}
                </div>

                {shownLocations.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-ink-600">
                    {shownLocations.slice(0, 3).map((l: SiteLocation) => (
                      <li key={l.id} className="truncate">
                        &middot; {l.locationName || "Unnamed location"}
                        {l.compensationType && <span className="text-ink-400"> — {SITE_COMPENSATION_TYPE_LABEL[l.compensationType]}</span>}
                        {(l.locationTypes ?? []).length > 0 && (
                          <span className="text-ink-400"> · {l.locationTypes!.map((t) => LOCATION_TYPE_LABEL[t]).join(", ")}</span>
                        )}
                      </li>
                    ))}
                    {shownLocations.length > 3 && <li className="text-ink-400">+{shownLocations.length - 3} more</li>}
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
            );
          })}
        </div>
      )}
    </>
  );
}
