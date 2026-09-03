"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Modal, PageHeader, Spinner, useAsyncAction,
} from "@/components/ui";
import { deleteAsset, restoreAsset, subscribeAssets } from "@/lib/db/assets";
import { deleteLead, restoreLead, subscribeLeads } from "@/lib/db/leads";
import { deletePartner, restorePartner, subscribePartners } from "@/lib/db/partners";
import { deleteProject, restoreProject, subscribeProjects } from "@/lib/db/projects";
import { deleteVendor, restoreVendor, subscribeVendors } from "@/lib/db/vendors";
import { canPermanentlyDelete, canTrash } from "@/lib/permissions";
import type { Actor, Asset, Lead, Partner, Project, TS, Vendor } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type Trashable = { id: string; deletedAt?: TS | null; deletedBy?: Actor | null };

type Kind = "lead" | "project" | "vendor" | "partner" | "asset";

interface SectionConfig<T extends Trashable> {
  kind: Kind;
  label: string;
  pluralLabel: string;
  rows: T[];
  primary: (row: T) => string;
  secondary: (row: T) => string;
  restore: (row: T, actor: Actor) => Promise<void>;
}

/** One kind's trashed rows — a select-all table with bulk/row restore and (super-admin only) permanent delete. */
function TrashSection<T extends Trashable>({
  config, busy, run, actor, canForever, onRequestPermaDelete,
}: {
  config: SectionConfig<T>;
  busy: boolean;
  run: (fn: () => Promise<void>, successMsg: string) => Promise<void>;
  actor: Actor | null;
  canForever: boolean;
  onRequestPermaDelete: (kind: Kind, rows: T[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { rows } = config;
  if (rows.length === 0) return null;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (rows.length > 0 && rows.every((r) => selected.has(r.id))) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-700">{config.pluralLabel}</h3>
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-4 py-2.5 text-sm text-white">
          <span>{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-ink-300 hover:text-white">
              Clear
            </button>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  const targets = rows.filter((r) => selected.has(r.id));
                  for (const row of targets) await config.restore(row, actor!);
                  setSelected(new Set());
                }, `${config.pluralLabel} restored.`)
              }
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restore selected
            </Button>
            {canForever && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onRequestPermaDelete(config.kind, rows.filter((r) => selected.has(r.id)))}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete forever
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="card overflow-x-auto scroll-thin">
        <table className="w-full">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              <th className="th w-8">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                  onChange={toggleAll}
                  aria-label={`Select all trashed ${config.pluralLabel.toLowerCase()}`}
                />
              </th>
              <th className="th">{config.label}</th>
              <th className="th">Deleted by</th>
              <th className="th">Deleted on</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-ink-50">
                <td className="td w-8">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${config.primary(row)}`}
                  />
                </td>
                <td className="td">
                  <span className="font-medium text-ink-900">{config.primary(row)}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">{config.secondary(row)}</span>
                </td>
                <td className="td text-ink-600">{row.deletedBy?.name ?? "—"}</td>
                <td className="td text-ink-500">{formatDateTime(row.deletedAt)}</td>
                <td className="td">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy}
                      onClick={() => void run(() => config.restore(row, actor!), `${config.label} restored.`)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                    {canForever && (
                      <Button size="sm" variant="danger" onClick={() => onRequestPermaDelete(config.kind, [row])}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TrashPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [permaTarget, setPermaTarget] = useState<{ kind: Kind; rows: Trashable[] } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => {
    if (!canTrash(viewer)) { setLoading(false); return; }
    const pending = new Set(["leads", "projects", "vendors", "partners", "assets"]);
    const maybeDone = (key: string) => { pending.delete(key); if (pending.size === 0) setLoading(false); };

    const unsubLeads = subscribeLeads(
      { max: 3000, includeTrashed: true },
      (rows) => { setLeads(rows); maybeDone("leads"); },
      () => maybeDone("leads"),
    );
    const unsubProjects = subscribeProjects(
      { max: 500, includeTrashed: true },
      (rows) => { setProjects(rows); maybeDone("projects"); },
      () => maybeDone("projects"),
    );
    const unsubVendors = subscribeVendors(
      (rows) => { setVendors(rows); maybeDone("vendors"); },
      () => maybeDone("vendors"),
      { includeTrashed: true },
    );
    const unsubPartners = subscribePartners(
      (rows) => { setPartners(rows); maybeDone("partners"); },
      () => maybeDone("partners"),
      { includeTrashed: true },
    );
    const unsubAssets = subscribeAssets(
      (rows) => { setAssets(rows); maybeDone("assets"); },
      () => maybeDone("assets"),
      { includeTrashed: true },
    );
    return () => { unsubLeads(); unsubProjects(); unsubVendors(); unsubPartners(); unsubAssets(); };
  }, [viewer]);

  const totalCount = leads.length + projects.length + vendors.length + partners.length + assets.length;
  const canForever = canPermanentlyDelete(viewer);

  if (!canTrash(viewer)) {
    return (
      <EmptyState
        title="Admins only"
        description="Trash is available to admins and super admins."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  const sections: SectionConfig<Trashable & { id: string }>[] = [
    {
      kind: "lead", label: "Lead", pluralLabel: "Leads",
      rows: leads as unknown as (Trashable & { id: string })[],
      primary: (r) => (r as unknown as Lead).client?.name ?? "—",
      secondary: (r) => (r as unknown as Lead).code,
      restore: (r, a) => restoreLead(r as unknown as Lead, a),
    },
    {
      kind: "project", label: "Project", pluralLabel: "Projects",
      rows: projects as unknown as (Trashable & { id: string })[],
      primary: (r) => (r as unknown as Project).name,
      secondary: (r) => (r as unknown as Project).code,
      restore: (r, a) => restoreProject(r as unknown as Project, a),
    },
    {
      kind: "vendor", label: "Vendor", pluralLabel: "Vendors",
      rows: vendors as unknown as (Trashable & { id: string })[],
      primary: (r) => (r as unknown as Vendor).name,
      secondary: (r) => (r as unknown as Vendor).code,
      restore: (r, a) => restoreVendor(r as unknown as Vendor, a),
    },
    {
      kind: "partner", label: "Partner", pluralLabel: "Partners",
      rows: partners as unknown as (Trashable & { id: string })[],
      primary: (r) => (r as unknown as Partner).name,
      secondary: (r) => (r as unknown as Partner).code,
      restore: (r, a) => restorePartner(r as unknown as Partner, a),
    },
    {
      kind: "asset", label: "Asset", pluralLabel: "Assets",
      rows: assets as unknown as (Trashable & { id: string })[],
      primary: (r) => (r as unknown as Asset).name,
      secondary: (r) => (r as unknown as Asset).assetTag,
      restore: (r, a) => restoreAsset(r as unknown as Asset, a),
    },
  ];

  const permaLabel = useMemo(() => {
    if (!permaTarget) return "";
    const cfg = sections.find((s) => s.kind === permaTarget.kind);
    return cfg?.label.toLowerCase() ?? "item";
  }, [permaTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  async function permanentlyDelete(kind: Kind, rows: Trashable[]) {
    if (kind === "lead") { for (const r of rows) await deleteLead(r as unknown as Lead); }
    else if (kind === "project") { for (const r of rows) await deleteProject(r as unknown as Project); }
    else if (kind === "vendor") { for (const r of rows) await deleteVendor(r as unknown as Vendor); }
    else if (kind === "partner") { for (const r of rows) await deletePartner(r as unknown as Partner); }
    else { for (const r of rows) await deleteAsset(r as unknown as Asset); }
  }

  return (
    <>
      <PageHeader
        title="Trash"
        description="Deleted leads, projects, vendors, partners and assets stay here, fully recoverable, until permanently deleted."
      />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : totalCount === 0 ? (
        <EmptyState icon={<Trash2 className="h-8 w-8" />} title="Trash is empty" description="Deleted records will show up here." />
      ) : (
        <div className="space-y-6">
          {sections.map((cfg) => (
            <TrashSection
              key={cfg.kind}
              config={cfg}
              busy={busy}
              run={run}
              actor={actor}
              canForever={canForever}
              onRequestPermaDelete={(kind, rows) => setPermaTarget({ kind, rows })}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!permaTarget}
        onClose={() => setPermaTarget(null)}
        title={`Permanently delete ${permaTarget?.rows.length ?? 0} ${permaLabel}${(permaTarget?.rows.length ?? 0) === 1 ? "" : "s"}`}
        description="This cannot be undone — the record and anything linked to it (documents, payments) are gone for good."
        footer={
          <>
            <Button onClick={() => setPermaTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!permaTarget) return;
                  await permanentlyDelete(permaTarget.kind, permaTarget.rows);
                  setPermaTarget(null);
                }, "Permanently deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete forever
            </Button>
          </>
        }
      >
        {permaTarget && (
          <div className="text-sm text-ink-700">
            <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Cannot be undone</Badge>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {permaTarget.rows.map((row) => {
                const cfg = sections.find((s) => s.kind === permaTarget.kind)!;
                return <li key={row.id}>{cfg.primary(row as Trashable & { id: string })}</li>;
              })}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
