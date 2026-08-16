"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Car, IndianRupee, Undo2, Zap } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import { subscribeSessionsForWalletOwner, type ChargeSession } from "@/lib/db/chargers";
import {
  getCorporateAccount, setEmspUserMonthlyCap, setEmspUserRfidToken, subscribeEmspUser, subscribeWalletTransactions,
} from "@/lib/db/emsp-users";
import { subscribeDriverForEmspUser, subscribeVehiclesForDriver } from "@/lib/db/fleets";
import { refundTopup } from "@/lib/razorpay-client";
import { subscribeRfidTokens } from "@/lib/db/rfid";
import { EMSP_USER_TYPE_LABEL } from "@/lib/constants";
import { canManageEmspUsers, canManageSettlements } from "@/lib/permissions";
import type { CorporateAccount, Driver, EmspUser, RfidToken, Vehicle, WalletTransaction } from "@/lib/types";
import { formatDateTime, formatINR } from "@/lib/utils";

export default function EmspUserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useViewer();
  const canManage = canManageEmspUsers(viewer);
  const canRefund = canManageSettlements(viewer);
  const { run, busy } = useAsyncAction();
  const { push } = useToast();
  const [refundingId, setRefundingId] = useState<string | null>(null);

  async function issueRefund(t: WalletTransaction) {
    if (!window.confirm(`Refund ${formatINR(t.amountInr)} to Razorpay and claw it back from the wallet?`)) return;
    setRefundingId(t.id);
    try {
      await refundTopup(t.id);
      push("Refund issued.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setRefundingId(null);
    }
  }

  const [user, setUser] = useState<EmspUser | null | undefined>(undefined);
  const [account, setAccount] = useState<CorporateAccount | null>(null);
  const [rfidTokens, setRfidTokens] = useState<RfidToken[]>([]);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);

  useEffect(() => subscribeEmspUser(id, setUser), [id]);
  useEffect(() => subscribeRfidTokens(setRfidTokens), []);
  useEffect(() => subscribeDriverForEmspUser(id, setDriver), [id]);

  useEffect(() => {
    if (!user) { setAccount(null); return; }
    if (user.corporateAccountId) void getCorporateAccount(user.corporateAccountId).then(setAccount);
    else setAccount(null);
  }, [user]);

  const walletOwnerType = user?.corporateAccountId ? "CORPORATE_ACCOUNT" : "EMSP_USER";
  const walletOwnerId = user?.corporateAccountId ?? id;

  useEffect(() => {
    if (!user) return;
    return subscribeWalletTransactions(walletOwnerType, walletOwnerId, setTxns);
  }, [user, walletOwnerType, walletOwnerId]);

  useEffect(() => {
    if (!user) return;
    return subscribeSessionsForWalletOwner(walletOwnerType, walletOwnerId, setSessions);
  }, [user, walletOwnerType, walletOwnerId]);

  useEffect(() => {
    if (!driver) { setVehicles([]); return; }
    return subscribeVehiclesForDriver(driver.id, setVehicles);
  }, [driver]);

  const linkedToken = useMemo(() => rfidTokens.find((t) => t.id === user?.rfidTokenId) ?? null, [rfidTokens, user]);
  const walletBalance = account ? (account.walletBalanceInr ?? 0) : (user?.walletBalanceInr ?? 0);

  const spentThisMonth = useMemo(() => {
    if (!user) return 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    return txns
      .filter((t) => t.type === "DEBIT" && t.emspUserId === user.id)
      .filter((t) => {
        const ms = (t.createdAt as { toMillis?: () => number } | null)?.toMillis?.();
        return ms != null && ms >= monthStart.getTime();
      })
      .reduce((a, t) => a + t.amountInr, 0);
  }, [txns, user]);

  if (user === undefined) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }
  if (user === null) {
    return <EmptyState title="User not found" description="This EMSP user may have been removed." />;
  }

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${EMSP_USER_TYPE_LABEL[user.type]}${account ? ` · billed to ${account.name}` : ""} · ${user.phone}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Profile">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Phone</dt><dd>{user.phone}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Email</dt><dd>{user.email || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Type</dt><dd>{EMSP_USER_TYPE_LABEL[user.type]}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Status</dt>
              <dd><Badge className={user.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>{user.active ? "Active" : "Inactive"}</Badge></dd>
            </div>
            {driver && (
              <div className="flex justify-between"><dt className="text-ink-500">Fleet driver</dt><dd>Yes{driver.licenseNumber ? ` · Lic. ${driver.licenseNumber}` : ""}</dd></div>
            )}
          </dl>

          <div className="mt-4 border-t border-ink-100 pt-4">
            <Field label="Linked RFID tag">
              {canManage ? (
                <Select
                  value={user.rfidTokenId ?? ""}
                  onChange={(e) => void run(() => setEmspUserRfidToken(id, e.target.value || null))}
                  options={rfidTokens.map((t) => ({ value: t.id, label: `${t.label} (${t.idToken})` }))}
                  placeholder="No tag linked"
                  disabled={busy}
                />
              ) : (
                <p className="text-sm text-ink-600">{linkedToken ? `${linkedToken.label} (${linkedToken.idToken})` : "No tag linked"}</p>
              )}
            </Field>
            <p className="mt-1 text-xs text-ink-500">
              Sessions started with this tag are automatically debited from this {account ? "corporate account's" : "user's"} wallet at session end.
            </p>
          </div>

          {account && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <Field label="Monthly benefit cap (₹)">
                {canManage ? (
                  <Input
                    type="number"
                    min={0}
                    defaultValue={user.monthlyCapInr ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      void run(() => setEmspUserMonthlyCap(id, v ? Number(v) : null));
                    }}
                    placeholder="No cap"
                  />
                ) : (
                  <p className="text-sm text-ink-600">{user.monthlyCapInr ? formatINR(user.monthlyCapInr) : "No cap"}</p>
                )}
              </Field>
              {user.monthlyCapInr ? (
                <p className="mt-1 text-xs text-ink-500">
                  Spent this month: {formatINR(spentThisMonth)} of {formatINR(user.monthlyCapInr)}
                  {spentThisMonth >= user.monthlyCapInr && " — this tag will be declined (NoCredit) at the charger until next month."}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-500">Blocks this employee's tag at the charger (not just a warning) once their own spend this calendar month reaches the cap.</p>
              )}
            </div>
          )}
        </Card>

        <Card title="Wallet" actions={<IndianRupee className="h-4 w-4 text-ink-400" />}>
          <p className="text-2xl font-semibold tabular-nums">{formatINR(walletBalance)}</p>
          <p className="text-xs text-ink-500">{account ? "Shared corporate balance — top up from User Management." : "Top up from User Management."}</p>
          <div className="mt-3 max-h-64 overflow-y-auto scroll-thin border-t border-ink-100 pt-3">
            {txns.length === 0 ? (
              <p className="text-sm text-ink-500">No transactions yet.</p>
            ) : (
              <div className="grid gap-2">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className={t.type === "TOPUP" ? "text-emerald-700" : t.type === "REFUND" ? "text-amber-700" : "text-ink-700"}>
                        {t.type === "TOPUP" ? "Top-up" : t.type === "REFUND" ? "Refund" : (t.note ?? "Session charge")}
                        {t.refunded && <span className="ml-1.5 text-xs font-normal text-ink-400">(refunded)</span>}
                      </p>
                      <p className="text-xs text-ink-500">{formatDateTime(t.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`tabular-nums font-medium ${t.type === "TOPUP" ? "text-emerald-700" : t.type === "REFUND" ? "text-amber-700" : "text-rose-600"}`}>
                        {t.type === "DEBIT" ? "-" : "+"}{formatINR(t.amountInr)}
                      </span>
                      {canRefund && t.type === "TOPUP" && t.razorpayPaymentId && !t.refunded && (
                        <Button size="sm" loading={refundingId === t.id} onClick={() => void issueRefund(t)} title="Refund">
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title="Vehicles" actions={<Car className="h-4 w-4 text-ink-400" />}>
          {!driver ? (
            <p className="text-sm text-ink-500">Not linked to a fleet driver record.</p>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-ink-500">No vehicle assigned.</p>
          ) : (
            <div className="grid gap-2">
              {vehicles.map((v) => (
                <div key={v.id} className="text-sm">
                  <p className="font-medium">{v.regNumber}</p>
                  <p className="text-ink-500">{v.carLabel}{v.batteryKwh ? ` · ${v.batteryKwh} kWh` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Charging sessions" subtitle={`${sessions.length} wallet-billed session${sessions.length === 1 ? "" : "s"}`} className="mt-4">
        {sessions.length === 0 ? (
          <EmptyState icon={<Zap className="h-8 w-8" />} title="No sessions billed to this wallet yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Charger</th><th className="th">Started</th><th className="th">Status</th><th className="th text-right">Cost</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{s.chargePointId}</td>
                    <td className="td text-ink-600">{formatDateTime(s.startedAt)}</td>
                    <td className="td">
                      <Badge className={s.status === "ACTIVE" ? "bg-sky-100 text-sky-800 ring-sky-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>{s.status}</Badge>
                    </td>
                    <td className="td text-right tabular-nums">{s.totalCostInr != null ? formatINR(s.totalCostInr) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
