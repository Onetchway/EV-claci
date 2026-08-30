"use client";

import { useEffect, useState } from "react";

import { Card, Spinner } from "@/components/ui";
import type { ActivityEntityType } from "@/lib/constants";
import { subscribeEntityActivity } from "@/lib/db/activity";
import type { Activity } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

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
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-ink-800">{r.message}</p>
                <span className="shrink-0 text-xs text-ink-400">{formatRelative(r.at)}</span>
              </div>
              <p className="text-xs text-ink-500">{r.actor.name}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
