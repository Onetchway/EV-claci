"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Avatar, Card, Spinner } from "@/components/ui";
import type { ActivityAction, ActivityEntityType } from "@/lib/constants";
import { subscribeEntityActivity } from "@/lib/db/activity";
import type { Activity } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

const ACTION_META: Record<ActivityAction, { label: string; icon: typeof Plus; iconBg: string; iconColor: string }> = {
  CREATE: { label: "Created", icon: Plus, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  UPDATE: { label: "Updated", icon: Pencil, iconBg: "bg-brand-100", iconColor: "text-brand-600" },
  STATUS_CHANGE: { label: "Updated", icon: Pencil, iconBg: "bg-brand-100", iconColor: "text-brand-600" },
  DELETE: { label: "Deleted", icon: Trash2, iconBg: "bg-rose-100", iconColor: "text-rose-600" },
};

/** Matches "status: DRAFT → SENT" (any casing/spacing around the arrow) so it can render as a from/to chip instead of plain text. */
const STATUS_DIFF_PATTERN = /^status:\s*(.+?)\s*(?:→|->)\s*(.+)$/i;

function StatusDiffChip({ from, to }: { from: string; to: string }) {
  return (
    <p className="text-sm">
      <span className="text-ink-500">status: </span>
      <span className="text-rose-500 line-through">{from}</span>
      <span className="mx-1 text-ink-400">&rarr;</span>
      <span className="font-medium text-emerald-600">{to}</span>
    </p>
  );
}

/** Every change is attributed and timestamped — the same activity feed the Audit Log draws from, scoped to one record. */
export function EntityActivityLog({ entityType, entityId }: { entityType: ActivityEntityType; entityId: string }) {
  const [rows, setRows] = useState<Activity[] | null>(null);

  useEffect(() => subscribeEntityActivity(entityType, entityId, setRows, () => setRows([])), [entityType, entityId]);

  return (
    <Card title="Activity" subtitle="Every change is attributed and timestamped.">
      {!rows ? (
        <div className="flex justify-center py-6 text-ink-400"><Spinner className="h-5 w-5" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-400">No activity yet.</p>
      ) : (
        <ul>
          {rows.map((r, i) => {
            const meta = ACTION_META[r.action];
            const Icon = meta.icon;
            const diff = STATUS_DIFF_PATTERN.exec(r.message);
            return (
              <li key={r.id} className="relative flex gap-2.5 pb-3.5 last:pb-0">
                {i < rows.length - 1 && <span className="absolute left-[9px] top-5 h-[calc(100%-0.75rem)] w-px bg-ink-200" />}
                <span className={`relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${meta.iconBg}`}>
                  <Icon className={`h-2.5 w-2.5 ${meta.iconColor}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink-900">{meta.label}</p>
                    <span className="shrink-0 text-xs text-ink-400">{formatRelative(r.at)}</span>
                  </div>
                  {diff ? (
                    <div className="mt-1"><StatusDiffChip from={diff[1]!} to={diff[2]!} /></div>
                  ) : (
                    <p className="mt-0.5 text-sm text-ink-600">{r.message}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Avatar name={r.actor.name} size={14} />
                    <span className="text-xs text-ink-500">{r.actor.name}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
