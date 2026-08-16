"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import { subscribeEmspUsers } from "@/lib/db/emsp-users";
import {
  cancelSubscription, createPlan, deletePlan, setPlanActive, subscribeAllSubscriptions, subscribePlans,
  subscribeUserToPlan, type PlanDraft,
} from "@/lib/db/subscriptions";
import { canManageEmspUsers } from "@/lib/permissions";
import type { EmspUser, SubscriptionPlan, UserSubscription } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function SubscriptionsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageEmspUsers(viewer);
  const { run, busy } = useAsyncAction();
  const { push } = useToast();

  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [subs, setSubs] = useState<UserSubscription[]>([]);
  const [users, setUsers] = useState<EmspUser[]>([]);

  const [planOpen, setPlanOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDiscount, setPDiscount] = useState("");

  const [subOpen, setSubOpen] = useState(false);
  const [subUserId, setSubUserId] = useState("");
  const [subPlanId, setSubPlanId] = useState("");
  const [subBusy, setSubBusy] = useState(false);

  useEffect(() => subscribePlans(setPlans), []);
  useEffect(() => subscribeAllSubscriptions(setSubs), []);
  useEffect(() => subscribeEmspUsers(setUsers), []);

  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const activeSubs = useMemo(() => subs.filter((s) => s.status === "ACTIVE"), [subs]);

  async function submitPlan() {
    if (!actor || !pName.trim() || !Number(pPrice)) return;
    const draft: PlanDraft = { name: pName.trim(), monthlyPriceInr: Number(pPrice), discountPct: Number(pDiscount) || 0 };
    await run(async () => {
      await createPlan(draft, actor);
      setPName(""); setPPrice(""); setPDiscount(""); setPlanOpen(false);
    }, "Plan created.");
  }

  async function submitSubscribe() {
    if (!actor || !subUserId || !subPlanId) return;
    const plan = plans?.find((p) => p.id === subPlanId);
    if (!plan) return;
    setSubBusy(true);
    try {
      await subscribeUserToPlan(subUserId, plan, actor);
      push(`Subscribed — ${formatINR(plan.monthlyPriceInr)} debited from wallet.`, "success");
      setSubOpen(false); setSubUserId(""); setSubPlanId("");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setSubBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Monthly plans an EMSP user can be put on: the first month debits their wallet immediately, and every session while an active subscription is in effect gets the plan's discount applied automatically. Renews itself by re-debiting the wallet every 30 days (allowed to go negative, same as session billing) until cancelled."
        actions={canManage && (
          <>
            <Button onClick={() => setPlanOpen(true)}><Plus className="h-4 w-4" /> New plan</Button>
            <Button variant="primary" onClick={() => setSubOpen(true)} disabled={!plans?.length}>
              <Repeat className="h-4 w-4" /> Subscribe a user
            </Button>
          </>
        )}
      />

      <Card title="Plans" className="mb-4">
        {plans === null ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : plans.length === 0 ? (
          <EmptyState title="No plans yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Name</th><th className="th text-right">Monthly price</th><th className="th text-right">Session discount</th><th className="th">Status</th>{canManage && <th className="th text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{p.name}</td>
                    <td className="td text-right tabular-nums">{formatINR(p.monthlyPriceInr)}</td>
                    <td className="td text-right tabular-nums">{p.discountPct}%</td>
                    <td className="td">
                      <Badge className={p.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {p.active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => void run(() => setPlanActive(p.id, !p.active))}>
                            {p.active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Delete plan "${p.name}"? Existing subscribers keep their discount until cancelled.`)) return;
                              void run(() => deletePlan(p.id), "Plan deleted.");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Active subscriptions" subtitle={`${activeSubs.length} active`}>
        {subs.length === 0 ? (
          <EmptyState icon={<Repeat className="h-8 w-8" />} title="No subscriptions yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">User</th><th className="th">Plan</th><th className="th text-right">Discount</th><th className="th">Renews</th><th className="th">Status</th>{canManage && <th className="th text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {subs.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{userName.get(s.emspUserId) ?? s.emspUserName}</td>
                    <td className="td text-ink-600">{s.planName}</td>
                    <td className="td text-right tabular-nums">{s.discountPct}%</td>
                    <td className="td text-ink-600">{s.status === "ACTIVE" ? formatDate(s.renewsAt) : "—"}</td>
                    <td className="td">
                      <Badge className={s.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {s.status === "ACTIVE" ? "Active" : "Cancelled"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        {s.status === "ACTIVE" && (
                          <Button size="sm" onClick={() => void run(() => cancelSubscription(s.id), "Subscription cancelled.")}>
                            Cancel
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="New plan"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!pName.trim() || !Number(pPrice)} onClick={() => void submitPlan()}>Create</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required><Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Commuter Plus" /></Field>
          <Field label="Monthly price (₹)" required><Input type="number" min={0} value={pPrice} onChange={(e) => setPPrice(e.target.value)} /></Field>
          <Field label="Session discount (%)"><Input type="number" min={0} max={100} value={pDiscount} onChange={(e) => setPDiscount(e.target.value)} placeholder="e.g. 10" /></Field>
        </div>
      </Modal>

      <Modal
        open={subOpen}
        onClose={() => setSubOpen(false)}
        title="Subscribe a user"
        description="Debits the plan's monthly price from the user's wallet immediately."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={subBusy} disabled={!subUserId || !subPlanId} onClick={() => void submitSubscribe()}>Subscribe</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="User" required>
            <Select value={subUserId} onChange={(e) => setSubUserId(e.target.value)} options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Choose a user" />
          </Field>
          <Field label="Plan" required>
            <Select
              value={subPlanId}
              onChange={(e) => setSubPlanId(e.target.value)}
              options={(plans ?? []).filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} — ${formatINR(p.monthlyPriceInr)}/mo, ${p.discountPct}% off` }))}
              placeholder="Choose a plan"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
