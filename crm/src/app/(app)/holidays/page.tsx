"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Input, PageHeader, Spinner, useAsyncAction,
} from "@/components/ui";
import { createHoliday, deleteHoliday, subscribeHolidays } from "@/lib/db/holidays";
import { canManageHrmsSetup } from "@/lib/permissions";
import type { Holiday } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function HolidaysPage() {
  const viewer = useViewer();
  const actor = useActor();
  const canEdit = canManageHrmsSetup(viewer);
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeHolidays((r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);

  async function add() {
    if (!date || !name.trim()) throw new Error("Give the holiday a date and a name.");
    await createHoliday({ date, name: name.trim() }, actor);
    setDate("");
    setName("");
  }

  const upcoming = rows.filter((h) => h.date >= new Date().toISOString().slice(0, 10));
  const past = rows.filter((h) => h.date < new Date().toISOString().slice(0, 10));

  return (
    <>
      <PageHeader title="Holidays" description="The company holiday calendar — factored into attendance and roster planning." />

      {canEdit && (
        <Card title="Add a holiday" className="mb-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
            <Button variant="primary" loading={busy} onClick={() => void run(add, "Holiday added.")}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No holidays added yet" description="An admin can add the year's holiday list here." />
      ) : (
        <div className="space-y-4">
          <Card title="Upcoming">
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-500">No upcoming holidays.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {upcoming.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span><span className="font-medium text-ink-900">{h.name}</span> <span className="text-ink-500">· {formatDate(h.date)}</span></span>
                    {canEdit && (
                      <button type="button" onClick={() => void deleteHoliday(h.id)} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {past.length > 0 && (
            <Card title="Past">
              <ul className="divide-y divide-ink-100">
                {past.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm text-ink-500">
                    <span>{h.name} · {formatDate(h.date)}</span>
                    {canEdit && (
                      <button type="button" onClick={() => void deleteHoliday(h.id)} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
