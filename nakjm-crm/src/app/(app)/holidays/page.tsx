"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Button, EmptyState, Field, Input, Modal, PageHeader, useAsyncAction } from "@/components/ui";
import { createHoliday, deleteHoliday, subscribeHolidays } from "@/lib/db/holidays";
import { canManageHrms } from "@/lib/permissions";
import type { Holiday } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function HolidaysPage() {
  const actor = useActor();
  const viewer = useViewer();
  const canEdit = canManageHrms(viewer);
  const { busy, run } = useAsyncAction();

  const [rows, setRows] = useState<Holiday[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", name: "" });

  useEffect(() => subscribeHolidays(setRows), []);

  async function onCreate() {
    if (!form.date || !form.name.trim()) return;
    await run(async () => {
      await createHoliday(form, actor);
      setShowForm(false);
      setForm({ date: "", name: "" });
    }, "Holiday added.");
  }

  const upcoming = (rows ?? []).filter((h) => h.date >= new Date().toISOString().slice(0, 10));

  return (
    <div>
      <PageHeader
        title="Holidays"
        description="The company holiday calendar — every employee's attendance shows HOLIDAY on these dates."
        actions={canEdit && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Holiday</Button>}
      />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No holidays added yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Occasion</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className={`border-t border-ink-100 ${upcoming.includes(h) ? "" : "opacity-50"}`}>
                  <td className="td font-medium">{formatDate(h.date)}</td>
                  <td className="td">{h.name}</td>
                  <td className="td text-right">
                    {canEdit && (
                      <button onClick={() => void run(() => deleteHoliday(h.id), "Holiday removed.")} disabled={busy}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Holiday"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Add</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Occasion" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
