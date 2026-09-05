"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Search } from "lucide-react";

import { Badge, Button, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { SITE_VISIT_STATUS_META, SITE_VISIT_STATUSES, type SiteVisitStatus } from "@/lib/constants";
import { subscribeSiteVisits } from "@/lib/db/site-visits";
import type { SiteVisit } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function SiteVisitsPage() {
  const [rows, setRows] = useState<SiteVisit[] | null>(null);
  const [status, setStatus] = useState<SiteVisitStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => subscribeSiteVisits(setRows), []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (needle && !`${r.visitNo} ${r.projectName} ${r.siteName ?? ""} ${r.pocName ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, search]);

  return (
    <div>
      <PageHeader
        title="Site Visit"
        description="Schedule an engineer to survey/inspect a client's project site, and record their observations afterward."
        actions={
          <>
            <ExportButton
              filename="site-visits"
              sheetName="Site Visits"
              rows={filtered.map((r) => ({
                No: r.visitNo, Project: r.projectName, Site: r.siteName ?? "", POC: r.pocName ?? "", Contact: r.pocContact ?? "",
                Charger: r.chargerType ?? "", Status: SITE_VISIT_STATUS_META[r.status].label,
                Scheduled: formatDate(r.scheduledDate), Engineers: r.assignedEngineers.map((e) => e.name).join(", "),
              }))}
            />
            <Link href="/site-visits/new"><Button><Plus className="h-4 w-4" /> New Site Visit</Button></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Search site visits…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          value={status}
          className="w-56"
          options={[{ value: "ALL", label: "All statuses" }, ...SITE_VISIT_STATUSES.map((s) => ({ value: s, label: SITE_VISIT_STATUS_META[s].label }))]}
          onChange={(e) => setStatus(e.target.value as SiteVisitStatus | "ALL")}
        />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<MapPin className="h-8 w-8" />} title="No site visits yet" description="Schedule an engineer to visit a client's site and log observations afterward." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Site</th>
                <th className="th">POC</th>
                <th className="th">Engineers</th>
                <th className="th">Status</th>
                <th className="th">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/site-visits/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.visitNo}</Link></td>
                  <td className="td">{r.projectName}</td>
                  <td className="td text-ink-600">{r.siteName || "—"}</td>
                  <td className="td text-ink-600">{r.pocName || "—"}</td>
                  <td className="td text-ink-600">{r.assignedEngineers.length ? r.assignedEngineers.map((e) => e.name).join(", ") : "—"}</td>
                  <td className="td"><Badge className={SITE_VISIT_STATUS_META[r.status].className}>{SITE_VISIT_STATUS_META[r.status].label}</Badge></td>
                  <td className="td">{formatDate(r.scheduledDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
