"use client";

import { CircleDot, FileEdit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, Card, EmptyState } from "@/components/ui";
import {
  subscribeChangeLog, type ChangeAction, type ChangeEntityType, type ChangeLogEntry,
} from "@/lib/db/change-log";
import { formatDateTime, formatRelative } from "@/lib/utils";

/**
 * Read-only audit trail for one document (Quotation, Proforma Invoice or
 * Purchase Order), backed by the shared changeLog collection — the same
 * mechanism the /logs page uses for chargers/tariffs/zones/etc, filtered
 * down to just this document's entries.
 */

const ICONS: Record<ChangeAction, typeof CircleDot> = {
  CREATE: Plus,
  UPDATE: FileEdit,
  DELETE: Trash2,
  ACTIVATE: CircleDot,
  DEACTIVATE: CircleDot,
};

const TONE: Record<ChangeAction, string> = {
  CREATE: "bg-brand-100 text-brand-700",
  UPDATE: "bg-sky-100 text-sky-700",
  DELETE: "bg-rose-100 text-rose-700",
  ACTIVATE: "bg-emerald-100 text-emerald-700",
  DEACTIVATE: "bg-ink-100 text-ink-600",
};

const ACTION_LABEL: Record<ChangeAction, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  ACTIVATE: "Activated",
  DEACTIVATE: "Deactivated",
};

export function EntityActivityLog({ entityType, entityId }: { entityType: ChangeEntityType; entityId: string }) {
  const [rows, setRows] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(
    () => subscribeChangeLog({ entityId, max: 200 }, (r) => { setRows(r); setLoading(false); }, () => setLoading(false)),
    [entityType, entityId],
  );

  return (
    <Card title="Activity" subtitle="Every change is attributed and timestamped.">
      {loading ? (
        <p className="py-6 text-center text-sm text-ink-500">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" />
      ) : (
        <ol className="relative space-y-4 border-l border-ink-200 pl-5">
          {rows.map((r) => {
            const Icon = ICONS[r.action];
            return (
              <li key={r.id} className="relative">
                <span
                  className={`absolute -left-[30px] inline-flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${TONE[r.action]}`}
                >
                  <Icon className="h-3 w-3" />
                </span>

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-ink-900">{ACTION_LABEL[r.action]}</p>
                  <time className="shrink-0 text-xs text-ink-400" title={formatDateTime(r.at)}>
                    {formatRelative(r.at)}
                  </time>
                </div>

                {r.changes && r.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 rounded-lg bg-ink-50 px-3 py-2">
                    {r.changes.map((c, i) => (
                      <li key={`${c.field}-${i}`} className="text-xs text-ink-600">
                        <span className="font-medium text-ink-700">{c.field}:</span>{" "}
                        <span className="text-rose-600 line-through decoration-rose-300">{String(c.from ?? "—")}</span>{" "}
                        <span className="text-ink-400">&rarr;</span>{" "}
                        <span className="text-emerald-700">{String(c.to ?? "—")}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                  <Avatar name={r.actor?.name} size={16} />
                  {r.actor?.name}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
