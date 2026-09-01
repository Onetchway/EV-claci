"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ImagePlus, Plus, Ticket as TicketIcon, Trash2, X,
} from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard,
  useAsyncAction, useToast,
} from "@/components/ui";
import {
  TICKET_FAULT_CLASS_LABEL, TICKET_FAULT_CLASSES, TICKET_STATUS_COLOR, TICKET_STATUS_LABEL, TICKET_STATUSES,
  TICKET_TYPE_LABEL, type TicketFaultClass, type TicketStatus,
} from "@/lib/constants";
import {
  assignTicket, createManualTicket, deleteTicket, removeTicketPhoto, setTicketFaultClass, setTicketRepairDetails,
  subscribeTickets, updateTicketStatus, uploadTicketPhoto, verifyAndCloseTicket,
} from "@/lib/db/tickets";
import { subscribeUsers } from "@/lib/db/users";
import { canManageTickets, hasRole } from "@/lib/permissions";
import type { AppUser, Ticket, TicketPart } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function isOverdue(t: Ticket): boolean {
  const due = (t.slaDueAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  return !!due && due < Date.now() && t.status !== "RESOLVED" && t.status !== "CLOSED";
}

export default function TicketsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageTickets(viewer);
  const canDelete = hasRole(viewer, "SUPER_ADMIN");
  const { run, busy } = useAsyncAction();
  const { push } = useToast();

  const [rows, setRows] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");

  const [newOpen, setNewOpen] = useState(false);
  const [newChargerId, setNewChargerId] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const detailTicket = useMemo(() => rows.find((t) => t.id === detailId) ?? null, [rows, detailId]);
  const [uploading, setUploading] = useState(false);
  const [partName, setPartName] = useState("");
  const [partCost, setPartCost] = useState("");
  const [repairCostDraft, setRepairCostDraft] = useState("");

  useEffect(() => {
    setRepairCostDraft(detailTicket?.repairCostInr != null ? String(detailTicket.repairCostInr) : "");
  }, [detailTicket?.id, detailTicket?.repairCostInr]);

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

  async function handlePhotoSelected(file: File | undefined) {
    if (!file || !actor || !detailTicket) return;
    setUploading(true);
    try {
      await uploadTicketPhoto(detailTicket.id, file, actor);
      push("Photo uploaded.", "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(url: string) {
    if (!actor || !detailTicket) return;
    await run(() => removeTicketPhoto(detailTicket.id, url, actor));
  }

  async function handleAddPart() {
    if (!actor || !detailTicket || !partName.trim()) return;
    const parts: TicketPart[] = [
      ...(detailTicket.parts ?? []),
      { name: partName.trim(), costInr: Number(partCost) || 0 },
    ];
    await run(() => setTicketRepairDetails(detailTicket.id, { parts }, actor));
    setPartName("");
    setPartCost("");
  }

  async function handleRemovePart(index: number) {
    if (!actor || !detailTicket) return;
    const parts = (detailTicket.parts ?? []).filter((_, i) => i !== index);
    await run(() => setTicketRepairDetails(detailTicket.id, { parts }, actor));
  }

  async function handleSaveRepairCost() {
    if (!actor || !detailTicket) return;
    await run(
      () => setTicketRepairDetails(detailTicket.id, { repairCostInr: Number(repairCostDraft) || 0 }, actor),
      "Repair cost saved.",
    );
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
                {(canManage || canDelete) && <th className="th text-right">Actions</th>}
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
                    {t.slaEscalatedAt && (
                      <Badge className="ml-1.5 bg-rose-100 text-rose-800 ring-rose-200">Escalated</Badge>
                    )}
                  </td>
                  <td className="td text-ink-600">{t.assignedTo?.name ?? "Unassigned"}</td>
                  {(canManage || canDelete) && (
                    <td className="td text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" onClick={() => setDetailId(t.id)}>Details</Button>
                        {canManage && (
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
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!window.confirm("Delete this ticket? This can't be undone.")) return;
                              void run(() => deleteTicket(t.id), "Ticket deleted.");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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

      <Modal
        open={!!detailTicket}
        onClose={() => setDetailId(null)}
        title={detailTicket ? `Ticket — ${detailTicket.chargePointId}` : "Ticket"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDetailId(null)}>Close</Button>
            {canManage && detailTicket && detailTicket.status !== "CLOSED" && (
              <Button
                variant="primary"
                loading={busy}
                onClick={() => void run(async () => {
                  await verifyAndCloseTicket(detailTicket.id, actor!);
                  setDetailId(null);
                }, "Ticket verified and closed.")}
              >
                <CheckCircle2 className="h-4 w-4" /> Verify &amp; close
              </Button>
            )}
          </>
        )}
      >
        {detailTicket && (
          <div className="space-y-5">
            <p className="text-sm text-ink-600">{detailTicket.description}</p>

            <Field label="Fault class">
              <Select
                value={detailTicket.faultClass ?? ""}
                onChange={(e) => void run(() => setTicketFaultClass(
                  detailTicket.id,
                  (e.target.value || null) as TicketFaultClass | null,
                  actor!,
                ))}
                options={TICKET_FAULT_CLASSES.map((c) => ({ value: c, label: TICKET_FAULT_CLASS_LABEL[c] }))}
                placeholder="Unclassified"
                disabled={!canManage}
              />
            </Field>

            <Field label="Photos">
              <div className="space-y-2">
                {detailTicket.photoUrls && detailTicket.photoUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {detailTicket.photoUrls.map((url) => (
                      <div key={url} className="group relative overflow-hidden rounded-lg border border-ink-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Ticket evidence" className="h-24 w-full object-cover" />
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => void handleRemovePhoto(url)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canManage && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand-700">
                    <ImagePlus className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Add photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        void handlePhotoSelected(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </Field>

            <Field label="Parts used">
              <div className="space-y-2">
                {(detailTicket.parts ?? []).map((p, i) => (
                  <div key={`${p.name}-${i}`} className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-1.5 text-sm">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-600">₹{p.costInr.toLocaleString("en-IN")}</span>
                      {canManage && (
                        <button type="button" onClick={() => void handleRemovePart(i)} className="text-ink-400 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {canManage && (
                  <div className="flex items-end gap-2">
                    <Field label="Part name" className="flex-1">
                      <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="e.g. AC contactor" />
                    </Field>
                    <Field label="Cost (₹)" className="w-28">
                      <Input type="number" value={partCost} onChange={(e) => setPartCost(e.target.value)} placeholder="0" />
                    </Field>
                    <Button size="sm" onClick={() => void handleAddPart()} disabled={!partName.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Field>

            {canManage && (
              <Field label="Repair cost (₹, total)">
                <div className="flex items-center gap-2">
                  <Input type="number" value={repairCostDraft} onChange={(e) => setRepairCostDraft(e.target.value)} placeholder="0" />
                  <Button size="sm" onClick={() => void handleSaveRepairCost()}>Save</Button>
                </div>
              </Field>
            )}

            {detailTicket.verifiedAt && (
              <p className="text-xs text-ink-500">
                Verified by {detailTicket.verifiedBy?.name ?? "—"} on {formatDateTime(detailTicket.verifiedAt)}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
