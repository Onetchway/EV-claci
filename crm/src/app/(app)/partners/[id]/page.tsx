"use client";

import { collection, getDocs, limit as fsLimit, query, where } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, IndianRupee } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner,
  StatCard, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  COMMISSION_STATUS_COLOR, COMMISSION_STATUS_LABEL, PARTNER_CATEGORIES,
  PARTNER_CATEGORY_LABEL, PARTNER_STATUSES, PARTNER_TIER_COLOR,
  PARTNER_TIER_LABEL, PARTNER_TIER_RATE, type PartnerCategory,
} from "@/lib/constants";
import { getDb } from "@/lib/firebase/client";
import {
  setCommissionStatus, subscribePartner, subscribePartnerCommissions, updatePartner,
} from "@/lib/db/partners";
import { LEADS } from "@/lib/db/leads";
import { canManageCommissions, canManagePartners } from "@/lib/permissions";
import type { Lead, Partner, PartnerCommission } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Partner>>({});
  const { busy, run } = useAsyncAction();

  useEffect(
    () => subscribePartner(params.id, (p) => { setPartner(p); setLoading(false); }, () => setLoading(false)),
    [params.id],
  );
  useEffect(() => subscribePartnerCommissions(params.id, setCommissions), [params.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snap = await getDocs(
        query(collection(getDb(), LEADS), where("partnerId", "==", params.id), fsLimit(200)),
      );
      if (!cancelled) {
        setLeads(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) }))
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
        );
      }
    })();
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }

  if (!partner) {
    return (
      <EmptyState
        title="Partner not found"
        action={<Link href="/partners"><Button>Back to partners</Button></Link>}
      />
    );
  }

  const pendingAmount = partner.totalCommissionEarned - partner.totalCommissionPaid;
  const editable = canManagePartners(viewer);

  function startEdit() {
    setForm({ name: partner!.name, company: partner!.company, phone: partner!.phone, email: partner!.email, category: partner!.category, status: partner!.status, notes: partner!.notes });
    setEditing(true);
  }

  return (
    <>
      <PageHeader
        title={partner.name}
        description={`${partner.code} · ${PARTNER_CATEGORY_LABEL[partner.category]} · ${partner.phone}`}
        actions={
          editable && !editing ? <Button onClick={startEdit}>Edit</Button> : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={PARTNER_TIER_COLOR[partner.tier]}>
          {PARTNER_TIER_LABEL[partner.tier]} · {PARTNER_TIER_RATE[partner.tier]}% commission
        </Badge>
        <Badge>{partner.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stations (12mo)" value={partner.stationsTrailing12mo} />
        <StatCard label="Leads referred" value={leads.length} />
        <StatCard label="Commission earned" value={formatCompactINR(partner.totalCommissionEarned)} />
        <StatCard label="Pending payout" value={formatCompactINR(pendingAmount)} tone={pendingAmount ? "warn" : "default"} />
      </div>

      {editing ? (
        <Card title="Edit partner">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Company / firm">
              <Input value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </Field>
            <Field label="Phone" required>
              <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Category">
              <Select
                value={form.category as PartnerCategory}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PartnerCategory }))}
                options={PARTNER_CATEGORIES.map((c) => ({ value: c, label: PARTNER_CATEGORY_LABEL[c] }))}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status ?? "ACTIVE"}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Partner["status"] }))}
                options={PARTNER_STATUSES.map((s) => ({ value: s, label: s === "ACTIVE" ? "Active" : "Inactive" }))}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await updatePartner(partner.id, form, actor!);
                  setEditing(false);
                }, "Partner updated.")
              }
            >
              Save
            </Button>
          </div>
        </Card>
      ) : (
        partner.notes && (
          <Card title="Notes"><p className="text-sm text-ink-700">{partner.notes}</p></Card>
        )
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Leads referred">
          {leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No leads attributed to this partner yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {leads.map((l) => (
                <li key={l.id} className="py-2.5">
                  <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 hover:text-brand-700">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">{l.client?.name}</span>
                      <span className="block text-xs text-ink-500">{l.code} · {formatDate(l.createdAt)}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium">{formatCompactINR(l.value ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Commission ledger" subtitle="Accrues automatically once a referred station is fully paid.">
          {commissions.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No commission accrued yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {commissions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/leads/${c.leadId}`} className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700">
                      {c.leadCode} — {c.leadName}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {formatINR(c.stationValue)} @ {c.ratePct}% ({PARTNER_TIER_LABEL[c.tier]}) · {formatDate(c.accruedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{formatINR(c.amount)}</span>
                    <Badge className={COMMISSION_STATUS_COLOR[c.status]}>{COMMISSION_STATUS_LABEL[c.status]}</Badge>
                    {canManageCommissions(viewer) && c.status !== "PAID" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void run(
                            () => setCommissionStatus(c, c.status === "PENDING" ? "APPROVED" : "PAID"),
                            c.status === "PENDING" ? "Approved." : "Marked paid.",
                          )
                        }
                      >
                        {c.status === "PENDING" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <IndianRupee className="h-3.5 w-3.5" />}
                        {c.status === "PENDING" ? "Approve" : "Mark paid"}
                      </Button>
                    )}
                    {c.status === "PENDING" && !canManageCommissions(viewer) && (
                      <Clock className="h-3.5 w-3.5 text-ink-400" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
