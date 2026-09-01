"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Handshake, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, StatCard, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import {
  PARTNER_CATEGORIES, PARTNER_CATEGORY_LABEL, PARTNER_TIER_COLOR,
  PARTNER_TIER_LABEL, PARTNER_TIER_RATE, type PartnerCategory,
} from "@/lib/constants";
import { createPartner, subscribePartners } from "@/lib/db/partners";
import { canManagePartners } from "@/lib/permissions";
import type { Actor, Partner } from "@/lib/types";
import { formatCompactINR } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

export default function PartnersPage() {
  const viewer = useViewer();
  const { actor } = useAuth();
  const [rows, setRows] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", category: "CHANNEL_PARTNER" as PartnerCategory, notes: "" });
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  useEffect(() => subscribePartners((r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((p) => p.status === "ACTIVE").length,
    earned: rows.reduce((a, p) => a + (p.totalCommissionEarned ?? 0), 0),
    pending: rows.reduce((a, p) => a + (p.totalCommissionEarned ?? 0) - (p.totalCommissionPaid ?? 0), 0),
  }), [rows]);

  async function create() {
    if (!actor || !form.name.trim() || !form.phone.trim()) {
      throw new Error("Name and phone are required.");
    }
    const { code } = await createPartner(form, actor as Actor);
    push(`Partner ${code} added.`, "success");
    setCreateOpen(false);
    setForm({ name: "", company: "", phone: "", email: "", category: "CHANNEL_PARTNER", notes: "" });
  }

  return (
    <>
      <PageHeader
        title="Channel partners"
        description="Dealers, EPC contractors and referral partners who originate leads — tiers, commission and payouts."
        actions={
          canManagePartners(viewer) && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add partner
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Partners" value={stats.total} icon={<Handshake className="h-4 w-4" />} />
        <StatCard label="Active" value={stats.active} tone="positive" />
        <StatCard label="Commission earned" value={formatCompactINR(stats.earned)} />
        <StatCard label="Commission pending" value={formatCompactINR(stats.pending)} tone={stats.pending ? "warn" : "default"} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-8 w-8" />}
          title="No channel partners yet"
          description="Add dealers, EPC contractors or referral partners who bring you leads, and attribute leads to them from the lead form."
          action={
            canManagePartners(viewer) ? (
              <Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add partner</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/partners/${p.id}`}
              className="card card-pad block transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="truncate text-xs text-ink-500">{p.code} · {PARTNER_CATEGORY_LABEL[p.category]}</p>
                </div>
                <Badge className={PARTNER_TIER_COLOR[p.tier]}>
                  {PARTNER_TIER_LABEL[p.tier]} · {PARTNER_TIER_RATE[p.tier]}%
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-2.5 text-xs">
                <div>
                  <dt className="text-ink-500">Stations (12mo)</dt>
                  <dd className="font-semibold">{p.stationsTrailing12mo}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Earned</dt>
                  <dd className="font-semibold">{formatCompactINR(p.totalCommissionEarned)}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Pending</dt>
                  <dd className="font-semibold">{formatCompactINR(p.totalCommissionEarned - p.totalCommissionPaid)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a channel partner"
        description="They start at the Associate tier (3%) and move up automatically as their referred stations close."
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(create, "Partner added.")}>
              Add partner
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Company / firm">
            <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PartnerCategory }))}
              options={PARTNER_CATEGORIES.map((c) => ({ value: c, label: PARTNER_CATEGORY_LABEL[c] }))}
            />
          </Field>
          <Field label="Phone" required>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
