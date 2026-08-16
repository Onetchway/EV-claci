"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageSquareWarning, Plus, Search, Tag, UserCheck } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  COMPLAINT_CATEGORIES, COMPLAINT_CATEGORY_LABEL, COMPLAINT_PRIORITIES, COMPLAINT_PRIORITY_LABEL,
  COMPLAINT_STATUSES, COMPLAINT_STATUS_COLOR, COMPLAINT_STATUS_LABEL,
  type ComplaintCategory, type ComplaintPriority, type ComplaintStatus,
} from "@/lib/constants";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import {
  assignComplaint, createComplaint, findRegisteredUser, resolveComplaint, setComplaintStatus,
  subscribeComplaints, tagComplaint, type ComplaintDraft,
} from "@/lib/db/complaints";
import { subscribeUsers } from "@/lib/db/users";
import { subscribeZones } from "@/lib/db/zones";
import { canManageComplaints } from "@/lib/permissions";
import type { AppUser, Complaint, EmspUser, Zone } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const blankDraft: ComplaintDraft = {
  category: "OTHER", priority: "MEDIUM", subject: "", description: "",
  customerName: "", customerPhone: "", customerEmail: "", relatedChargerId: null, city: "",
};

export default function ComplaintsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageComplaints(viewer);
  const { run, busy } = useAsyncAction();

  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "">("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ComplaintDraft>(blankDraft);
  const [matchedUser, setMatchedUser] = useState<EmspUser | null | undefined>(undefined);
  const [checkingUser, setCheckingUser] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [tagUid, setTagUid] = useState("");

  useEffect(() => subscribeComplaints({ status: statusFilter || undefined }, setComplaints), [statusFilter]);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeZones(setZones), []);
  useEffect(() => subscribeUsers(setStaff), []);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const chargerById = useMemo(() => new Map(registry.map((r) => [r.chargerId, r])), [registry]);

  const counts = useMemo(() => {
    const rows = complaints ?? [];
    return {
      open: rows.filter((c) => c.status === "OPEN").length,
      inProgress: rows.filter((c) => c.status === "IN_PROGRESS").length,
      resolved: rows.filter((c) => c.status === "RESOLVED").length,
    };
  }, [complaints]);

  function openNew() {
    setDraft(blankDraft);
    setMatchedUser(undefined);
    setOpen(true);
  }

  function onChargerSelected(chargerId: string) {
    const reg = registry.find((r) => r.chargerId === chargerId);
    const zone = reg?.zoneId ? zoneById.get(reg.zoneId) : undefined;
    setDraft((d) => ({ ...d, relatedChargerId: chargerId || null, city: zone?.city ?? d.city }));
  }

  async function checkRegisteredUser() {
    if (!draft.customerPhone?.trim() && !draft.customerEmail?.trim()) return;
    setCheckingUser(true);
    try {
      const match = await findRegisteredUser({ phone: draft.customerPhone, email: draft.customerEmail });
      setMatchedUser(match);
    } finally {
      setCheckingUser(false);
    }
  }

  async function submit() {
    if (!actor || !draft.subject.trim() || !draft.description.trim()) return;
    await run(async () => {
      await createComplaint({ ...draft, emspUserId: matchedUser?.id ?? null }, actor);
      setOpen(false);
    }, "Complaint logged.");
  }

  async function submitResolution() {
    if (!resolvingId || !resolutionNotes.trim()) return;
    await run(async () => {
      await resolveComplaint(resolvingId, resolutionNotes.trim());
      setResolvingId(null);
      setResolutionNotes("");
    }, "Complaint resolved.");
  }

  async function submitTag(c: Complaint) {
    if (!tagUid || !actor) return;
    const person = staff.find((u) => u.uid === tagUid);
    if (!person?.email) return;
    await run(async () => {
      await tagComplaint(c.id, c.subject, { uid: person.uid, name: person.name, email: person.email }, actor);
      setTaggingId(null);
      setTagUid("");
    }, `${person.name} tagged.`);
  }

  return (
    <>
      <PageHeader
        title="Complaints"
        description="Customer/driver-initiated complaints — billing, app issues, service quality. Separate from charger fault tickets."
        actions={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> Log complaint</Button>}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-ink-500">Open</p><p className="text-xl font-semibold tabular-nums text-rose-600">{counts.open}</p></Card>
        <Card><p className="text-xs text-ink-500">In progress</p><p className="text-xl font-semibold tabular-nums text-amber-600">{counts.inProgress}</p></Card>
        <Card><p className="text-xs text-ink-500">Resolved</p><p className="text-xl font-semibold tabular-nums text-emerald-600">{counts.resolved}</p></Card>
      </div>

      <Card className="mb-4">
        <Field label="Status">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ComplaintStatus | "")}
            options={[{ value: "", label: "All statuses" }, ...COMPLAINT_STATUSES.map((s) => ({ value: s, label: COMPLAINT_STATUS_LABEL[s] }))]}
          />
        </Field>
      </Card>

      {complaints === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : complaints.length === 0 ? (
        <EmptyState icon={<MessageSquareWarning className="h-8 w-8" />} title="No complaints" />
      ) : (
        <div className="grid gap-3">
          {complaints.map((c) => {
            const charger = c.relatedChargerId ? chargerById.get(c.relatedChargerId) : undefined;
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={COMPLAINT_STATUS_COLOR[c.status]}>{COMPLAINT_STATUS_LABEL[c.status]}</Badge>
                      <Badge className="bg-ink-100 text-ink-600 ring-ink-200">{COMPLAINT_CATEGORY_LABEL[c.category]}</Badge>
                      <Badge className={c.priority === "HIGH" ? "bg-rose-100 text-rose-800 ring-rose-200" : c.priority === "MEDIUM" ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                        {COMPLAINT_PRIORITY_LABEL[c.priority]}
                      </Badge>
                      {c.city && <Badge className="bg-ink-100 text-ink-600 ring-ink-200">{c.city}</Badge>}
                    </div>
                    <p className="mt-1 font-medium">{c.subject}</p>
                    <p className="mt-1 text-sm text-ink-600">{c.description}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      {(c.customerName || c.customerPhone || c.customerEmail) && (
                        <span>{c.customerName}{c.customerPhone ? ` · ${c.customerPhone}` : ""}{c.customerEmail ? ` · ${c.customerEmail}` : ""}</span>
                      )}
                      {charger && <span>Charger: {charger.label}</span>}
                      {c.emspUserId && (
                        <Link href={`/emsp-users/${c.emspUserId}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                          <UserCheck className="h-3 w-3" /> Registered user
                        </Link>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-ink-400">
                      Logged {formatDateTime(c.createdAt)}
                      {c.assignedTo ? ` · Assigned to ${c.assignedTo.name}` : ""}
                      {c.taggedTo?.length ? ` · Tagged: ${c.taggedTo.map((t) => t.name).join(", ")}` : ""}
                    </p>
                    {c.status === "RESOLVED" && c.resolutionNotes && (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
                        Resolution: {c.resolutionNotes}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {c.status !== "RESOLVED" && c.status !== "CLOSED" && (
                        <>
                          {c.status === "OPEN" && (
                            <Button size="sm" onClick={() => void run(() => setComplaintStatus(c.id, "IN_PROGRESS"))}>Start</Button>
                          )}
                          {!c.assignedTo && actor && (
                            <Button size="sm" onClick={() => void run(() => assignComplaint(c.id, actor))}>Assign to me</Button>
                          )}
                          <Button size="sm" onClick={() => { setResolvingId(c.id); setResolutionNotes(""); }}>Resolve</Button>
                          <Button size="sm" onClick={() => void run(() => setComplaintStatus(c.id, "CLOSED"))}>Close</Button>
                        </>
                      )}
                      <Button size="sm" onClick={() => { setTaggingId(c.id); setTagUid(""); }}>
                        <Tag className="h-3.5 w-3.5" /> Tag
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log complaint"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!draft.subject.trim() || !draft.description.trim()} onClick={() => void submit()}>
              Log
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ComplaintCategory }))}
              options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: COMPLAINT_CATEGORY_LABEL[c] }))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as ComplaintPriority }))}
              options={COMPLAINT_PRIORITIES.map((p) => ({ value: p, label: COMPLAINT_PRIORITY_LABEL[p] }))}
            />
          </Field>
          <Field label="Subject" required className="sm:col-span-2">
            <Input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
          </Field>
          <Field label="Description" required className="sm:col-span-2">
            <Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} />
          </Field>
          <Field label="Related charger" hint="Auto-fills city from the charger's site.">
            <Select
              value={draft.relatedChargerId ?? ""}
              onChange={(e) => onChargerSelected(e.target.value)}
              options={[{ value: "", label: "None" }, ...registry.map((r) => ({ value: r.chargerId, label: r.label }))]}
            />
          </Field>
          <Field label="City">
            <Input value={draft.city ?? ""} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
          </Field>
          <Field label="Customer name">
            <Input value={draft.customerName} onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))} />
          </Field>
          <Field label="Customer phone">
            <Input value={draft.customerPhone} onChange={(e) => { setDraft((d) => ({ ...d, customerPhone: e.target.value })); setMatchedUser(undefined); }} />
          </Field>
          <Field label="Customer email" className="sm:col-span-2">
            <Input value={draft.customerEmail} onChange={(e) => { setDraft((d) => ({ ...d, customerEmail: e.target.value })); setMatchedUser(undefined); }} />
          </Field>
          <div className="sm:col-span-2">
            <Button size="sm" loading={checkingUser} disabled={!draft.customerPhone?.trim() && !draft.customerEmail?.trim()} onClick={() => void checkRegisteredUser()}>
              <Search className="h-3.5 w-3.5" /> Check registered user
            </Button>
            {matchedUser !== undefined && (
              matchedUser ? (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
                  Matched: <strong>{matchedUser.name}</strong> — this complaint will link to their driver profile.
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-500">No registered user found for that phone/email.</p>
              )
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!resolvingId}
        onClose={() => setResolvingId(null)}
        title="Resolve complaint"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!resolutionNotes.trim()} onClick={() => void submitResolution()}>
              Mark resolved
            </Button>
          </>
        )}
      >
        <Field label="Resolution notes" required>
          <Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} />
        </Field>
      </Modal>

      <Modal
        open={!!taggingId}
        onClose={() => setTaggingId(null)}
        title="Tag a teammate"
        description="They'll get an email + in-app notification linking back to Complaints."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTaggingId(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!tagUid}
              onClick={() => { const c = complaints?.find((x) => x.id === taggingId); if (c) void submitTag(c); }}
            >
              Tag
            </Button>
          </>
        )}
      >
        <Field label="Teammate">
          <Select
            value={tagUid}
            onChange={(e) => setTagUid(e.target.value)}
            options={[{ value: "", label: "Select…" }, ...staff.filter((u) => u.active).map((u) => ({ value: u.uid, label: u.name }))]}
          />
        </Field>
      </Modal>
    </>
  );
}
