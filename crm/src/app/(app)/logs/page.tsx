"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, FileClock } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/constants";
import { subscribeAuditLog } from "@/lib/db/activity";
import {
  CHANGE_ENTITY_TYPES, subscribeChangeLog, type ChangeEntityType, type ChangeLogEntry,
} from "@/lib/db/change-log";
import { isAdmin } from "@/lib/permissions";
import type { Activity } from "@/lib/types";
import { downloadCsv, formatDateTime, toDate } from "@/lib/utils";

const ENTITY_TYPE_LABEL: Record<ChangeEntityType, string> = {
  CHARGER: "Charger", TARIFF: "Tariff", ZONE: "Station/Zone", WORKFLOW_RULE: "Workflow",
  USER: "User", SETTINGS: "Settings", WEBHOOK: "Webhook", API_KEY: "API key", RFID_TOKEN: "RFID token",
  QUOTATION: "Quotation", PROFORMA_INVOICE: "Proforma invoice", PURCHASE_ORDER: "Purchase order", TENDER: "Tender", BOQ: "BOQ",
};

const ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-brand-100 text-brand-800 ring-brand-200",
  UPDATE: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  DELETE: "bg-rose-100 text-rose-800 ring-rose-200",
  ACTIVATE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  DEACTIVATE: "bg-ink-100 text-ink-600 ring-ink-200",
};

function CmsChangeLog() {
  const [rows, setRows] = useState<ChangeLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<ChangeEntityType | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setRows(null);
    setError(null);
    return subscribeChangeLog(
      { entityType: entityType || undefined, max: 500 },
      (r) => { setRows(r); setError(null); },
      (e) => { setError(e.message); setRows([]); },
    );
  }, [entityType]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!rows) return [];
    if (!needle) return rows;
    return rows.filter((r) => [r.entityLabel, r.actor?.name, r.action, ...(r.changes ?? []).map((c) => c.field)]
      .filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, search]);

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="label">Search</p>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, field, actor…" />
          </div>
          <div>
            <p className="label">Entity type</p>
            <Select
              placeholder="Everything"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as ChangeEntityType | "")}
              options={CHANGE_ENTITY_TYPES.map((t) => ({ value: t, label: ENTITY_TYPE_LABEL[t] }))}
            />
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
          <p className="mt-1 text-xs">
            A permission-denied error here usually means the Firestore rules for the `changeLog` collection
            haven't been deployed yet — run <code>firebase deploy --only firestore:rules</code>.
          </p>
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        error ? null : (
          <EmptyState icon={<FileClock className="h-8 w-8" />} title="No CMS changes match these filters" description="Edit a charger, tariff, station, or workflow rule and it should appear here." />
        )
      ) : (
        <Card title={`${filtered.length} entries`} subtitle="Charger, tariff, station, and workflow edits — newest first">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">When</th>
                  <th className="th">Who</th>
                  <th className="th">Action</th>
                  <th className="th">Entity</th>
                  <th className="th">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-ink-50">
                    <td className="td whitespace-nowrap text-xs text-ink-500">{formatDateTime(c.at)}</td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={c.actor?.name} size={22} />
                        <span>
                          <span className="block text-sm">{c.actor?.name}</span>
                          <span className="block text-[11px] uppercase tracking-wide text-ink-400">{c.actor?.role?.replace("_", " ")}</span>
                        </span>
                      </span>
                    </td>
                    <td className="td"><Badge className={ACTION_STYLE[c.action] ?? "bg-ink-100 text-ink-700 ring-ink-200"}>{c.action.toLowerCase()}</Badge></td>
                    <td className="td">
                      <span className="text-sm text-ink-800">{c.entityLabel}</span>
                      <span className="block text-xs text-ink-500">{ENTITY_TYPE_LABEL[c.entityType]}</span>
                    </td>
                    <td className="td whitespace-normal">
                      {c.changes && c.changes.length > 0 ? (
                        <ul className="space-y-0.5">
                          {c.changes.map((f, i) => (
                            <li key={`${f.field}-${i}`} className="text-xs text-ink-500">
                              <span className="font-medium">{f.field}:</span>{" "}
                              <span className="text-rose-600">{String(f.from ?? "—")}</span> →{" "}
                              <span className="text-emerald-700">{String(f.to ?? "—")}</span>
                            </li>
                          ))}
                        </ul>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

const TYPE_STYLE: Partial<Record<ActivityType, string>> = {
  CREATED: "bg-brand-100 text-brand-800 ring-brand-200",
  STAGE_CHANGED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  STATUS_CHANGED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  ASSIGNED: "bg-sky-100 text-sky-800 ring-sky-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
  PAYMENT_ADDED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  PAYMENT_DELETED: "bg-rose-100 text-rose-800 ring-rose-200",
  DOCUMENT_UPLOADED: "bg-violet-100 text-violet-800 ring-violet-200",
  DOCUMENT_DELETED: "bg-rose-100 text-rose-800 ring-rose-200",
};

const label = (t: ActivityType) => t.replace(/_/g, " ").toLowerCase();

export default function AuditLogPage() {
  const { role } = useAuth();
  const { users } = useAgents();
  const [view, setView] = useState<"SALES" | "CMS">("SALES");

  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actorUid, setActorUid] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!role || !isAdmin(role)) return;
    setLoading(true);
    return subscribeAuditLog(
      { actorUid: actorUid || undefined, type: type || undefined, max: 500 },
      (r) => { setRows(r); setError(null); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, [role, actorUid, type]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return rows.filter((a) => {
      const at = toDate(a.at)?.getTime();
      if (fromTs && (!at || at < fromTs)) return false;
      if (toTs && (!at || at > toTs)) return false;
      if (!needle) return true;
      const hay = [a.message, a.leadCode, a.leadName, a.actor?.name, ...(a.changes ?? []).map((c) => `${c.label} ${c.from} ${c.to}`)]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, search, from, to]);

  if (role && !isAdmin(role)) {
    return (
      <EmptyState
        title="Admins only"
        description="The audit log is restricted to admins and super admins."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  function exportCsv() {
    downloadCsv(`livanto-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Timestamp", "Actor", "Role", "Type", "Lead code", "Client", "Message", "Field changes"],
      ...filtered.map((a) => [
        formatDateTime(a.at), a.actor?.name ?? "", a.actor?.role ?? "", a.type,
        a.leadCode ?? "", a.leadName ?? "", a.message,
        (a.changes ?? []).map((c) => `${c.label}: ${c.from} → ${c.to}`).join("; "),
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change in the CRM, with who made it and exactly what moved."
        actions={view === "SALES" ? (
          <Button onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4" /> Export
          </Button>
        ) : undefined}
      />

      <div className="mb-4 flex rounded-lg bg-ink-100 p-0.5 text-sm w-fit">
        <button type="button" onClick={() => setView("SALES")} className={`rounded-md px-3 py-1.5 ${view === "SALES" ? "bg-white shadow-sm font-medium" : "text-ink-500"}`}>
          Sales activity
        </button>
        <button type="button" onClick={() => setView("CMS")} className={`rounded-md px-3 py-1.5 ${view === "CMS" ? "bg-white shadow-sm font-medium" : "text-ink-500"}`}>
          CMS changes
        </button>
      </div>

      {view === "CMS" ? <CmsChangeLog /> : (
      <>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="label">Search</p>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lead code, client, field…" />
          </div>
          <div>
            <p className="label">Actor</p>
            <Select
              placeholder="Everyone"
              value={actorUid}
              onChange={(e) => setActorUid(e.target.value)}
              options={users.map((u) => ({ value: u.uid, label: u.name }))}
            />
          </div>
          <div>
            <p className="label">Action</p>
            <Select
              placeholder="All actions"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType | "")}
              options={ACTIVITY_TYPES.map((t) => ({ value: t, label: label(t) }))}
            />
          </div>
          <div>
            <p className="label">From</p>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <p className="label">To</p>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
          <p className="mt-1 text-xs">
            A missing-index error here usually means the Firestore composite indexes have not been
            deployed yet — run <code>firebase deploy --only firestore:indexes</code>.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileClock className="h-8 w-8" />} title="No log entries match these filters" />
      ) : (
        <Card title={`${filtered.length} entries`} subtitle="Newest first">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">When</th>
                  <th className="th">Who</th>
                  <th className="th">Action</th>
                  <th className="th">Lead</th>
                  <th className="th">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="align-top hover:bg-ink-50">
                    <td className="td whitespace-nowrap text-xs text-ink-500">{formatDateTime(a.at)}</td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={a.actor?.name} size={22} />
                        <span>
                          <span className="block text-sm">{a.actor?.name}</span>
                          <span className="block text-[11px] uppercase tracking-wide text-ink-400">
                            {a.actor?.role?.replace("_", " ")}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="td">
                      <Badge className={TYPE_STYLE[a.type] ?? "bg-ink-100 text-ink-700 ring-ink-200"}>
                        {label(a.type)}
                      </Badge>
                    </td>
                    <td className="td">
                      {a.leadId ? (
                        <Link href={`/leads/${a.leadId}`} className="text-brand-700 hover:underline">
                          {a.leadCode ?? "Open"}
                          {a.leadName && <span className="block text-xs text-ink-500">{a.leadName}</span>}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="td whitespace-normal">
                      <p className="text-sm text-ink-800">{a.message}</p>
                      {a.changes && a.changes.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {a.changes.map((c, i) => (
                            <li key={`${c.field}-${i}`} className="text-xs text-ink-500">
                              <span className="font-medium">{c.label}:</span>{" "}
                              <span className="text-rose-600">{c.from}</span> →{" "}
                              <span className="text-emerald-700">{c.to}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </>
      )}
    </>
  );
}
