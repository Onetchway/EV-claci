"use client";

import { useEffect, useState } from "react";
import { Percent, Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import {
  createCoupon, deleteCoupon, setCouponActive, subscribeCoupons, type CouponDraft,
} from "@/lib/db/coupons";
import { canManageSettlements } from "@/lib/permissions";
import type { Coupon, CouponType } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function CouponsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageSettlements(viewer);
  const { run, busy } = useAsyncAction();

  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENT");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => subscribeCoupons(setCoupons), []);

  function openNew() {
    setCode(""); setType("PERCENT"); setValue(""); setMaxUses(""); setExpiresAt("");
    setOpen(true);
  }

  async function submit() {
    if (!actor || !code.trim() || !Number(value)) return;
    const draft: CouponDraft = {
      code: code.trim(),
      type,
      value: Number(value),
      maxUses: maxUses.trim() ? Number(maxUses) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };
    await run(async () => {
      await createCoupon(draft, actor);
      setOpen(false);
    }, "Coupon created.");
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Wallet top-up promo codes. Redeemed and validated server-side when a top-up completes — a % bonus or flat ₹ credited on top of the amount paid."
        actions={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New coupon</Button>}
      />

      {coupons === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-8 w-8" />}
          title="No coupons yet"
          action={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New coupon</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Code</th><th className="th">Bonus</th><th className="th">Uses</th>
                  <th className="th">Expires</th><th className="th">Status</th>
                  {canManage && <th className="th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="td font-mono font-medium">{c.code}</td>
                    <td className="td text-ink-600">{c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)}</td>
                    <td className="td text-ink-600">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                    <td className="td text-ink-600">{c.expiresAt ? formatDate(c.expiresAt) : "No expiry"}</td>
                    <td className="td">
                      <Badge className={c.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {c.active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => void run(() => setCouponActive(c.id, !c.active))}>
                            {c.active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Delete coupon ${c.code}?`)) return;
                              void run(() => deleteCoupon(c.id), "Coupon deleted.");
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
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New coupon"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!code.trim() || !Number(value)} onClick={() => void submit()}>Create</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" />
          </Field>
          <Field label="Type">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as CouponType)}
              options={[{ value: "PERCENT", label: "% bonus on the top-up amount" }, { value: "FLAT", label: "Flat ₹ bonus" }]}
            />
          </Field>
          <Field label={type === "PERCENT" ? "Bonus %" : "Bonus ₹"} required>
            <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Max redemptions" hint="Leave blank for unlimited.">
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </Field>
          <Field label="Expires" hint="Leave blank for no expiry.">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
