"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Ticket as TicketIcon } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard,
  useAsyncAction,
} from "@/components/ui";
import {
  TICKET_STATUS_COLOR, TICKET_STATUS_LABEL, TICKET_STATUSES, TICKET_TYPE_LABEL, type TicketStatus,
} from "@/lib/constants";
import { assignTicket, createManualTicket, subscribeTickets, updateTicketStatus } from "@/lib/db/tickets";
import { subscribeUsers } from "@/lib/db/users";
import { canManageTickets } from "@/lib/permissions";
import type { AppUser, Ticket } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function isOverdue(t: Ticket): boolean {
  const due = (t.slaDueAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  return !!due && due < Date.now() && t.status !== "RESOLVED" && t.status !== "CLOSED";
}

export default function TicketsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageTickets(viewer);
  const { run, busy } = useAsyncAction();

  const [rows, setRows] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");

  const [newOpen, setNewOpen] = useState(false);
  const [newChargerId, setNewChargerId] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(
    () => subscribeTickets({}, (r) => { setRows(r); setLoading(false); }, () => setLoading(false)),
    [],
  );
  useEffect(() => subscribeUsers(setUsers), []);

  const filtered = useMemo(
    () => (statusFilter ? rows.filter((t) => t.status === statusFilter) : rows),
    [rows, statusFilter],
  );

  const stats = useMemo(() => {
    const open = rows.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
    const overdue = open.filter(isOverdue);
    return { total: rows.length, open: open.length, overdue: overdue.length };
  }, [rows]);

  async function submitManual() {
    if (!actor || !newChargerId.trim() || !newDescription.trim()) return;
    await run(async () => {
      await createManualTicket(newChargerId.trim(), newDescription.trim(), actor);
      setNewChargerId("");
      setNewDescription("");
      setNewOpen(false);
    }, "Ticket created.");
  }

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Fault and offline tickets — opened automatically by the OCPP server, or manually here."
        actions={(
          <>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "")}
              options={TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s] }))}
              placeholder="All statuses"
            />
            {canManage && (
              <Button variant="primary" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New ticket</Button>
            )}
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total tickets" value={stats.total} />
        <StatCard label="Open" value={stats.open} tone={stats.open ? "warn" : "default"} />
        <StatCard label="SLA overdue" value={stats.overdue} tone={stats.overdue ? "negative" : "default"} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<TicketIcon className="h-8 w-8" />} title="No tickets" description="Nothing open right now." />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Charger</th>
                <th className="th">Type</th>
                <th className="th">Description</th>
                <th className="th">Status</th>
                <th className="th">SLA due</th>
                <th className="th">Assigned to</th>
                {canManage && <th className="th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((t) => (
                <tr key={t.id} className={isOverdue(t) ? "bg-rose-50/50" : "hover:bg-ink-50"}>
                  <td className="td font-medium">{t.chargePointId}</td>
                  <td className="td text-ink-600">{TICKET_TYPE_LABEL[t.type]}</td>
                  <td className="td max-w-xs truncate text-ink-600" title={t.description}>{t.description}</td>
                  <td className="td">
                    {canManage ? (
                      <Select
                        value={t.status}
                        onChange={(e) => void run(() => updateTicketStatus(t.id, e.target.value as TicketStatus, actor!))}
                        options={TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s] }))}
                      />
                    ) : (
                      <Badge className={TICKET_STATUS_COLOR[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
                    )}
                  </td>
                  <td className={`td ${isOverdue(t) ? "font-medium text-rose-700" : "text-ink-600"}`}>
                    {t.slaDueAt ? formatDateTime(t.slaDueAt) : "—"}
                  </td>
                  <td className="td text-ink-600">{t.assignedTo?.name ?? "Unassigned"}</td>
                  {canManage && (
                    <td className="td text-right">
                      <Select
                        value={t.assignedTo?.uid ?? ""}
                        onChange={(e) => {
                          const u = users.find((x) => x.uid === e.target.value);
                          void run(() => assignTicket(
                            t.id,
                            u ? { uid: u.uid, name: u.name, role: u.role } : null,
                            actor!,
                          ));
                        }}
                        options={users.map((u) => ({ value: u.uid, label: u.name }))}
                        placeholder="Assign…"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New manual ticket"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!newChargerId.trim() || !newDescription.trim()}
              onClick={() => void submitManual()}
            >
              Create
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Charger ID" required>
            <Input value={newChargerId} onChange={(e) => setNewChargerId(e.target.value)} placeholder="e.g. lobby-dc-01-a1b2c" />
          </Field>
          <Field label="Description" required>
            <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="What's wrong?" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
