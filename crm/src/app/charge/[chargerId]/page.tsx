"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Zap } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/**
 * App-less charging — reached by scanning a per-charger QR code, no login,
 * no app install. Three steps: pick an amount (Scan already happened),
 * Pay via Razorpay Checkout, and the charger starts automatically
 * (Charge). Every write this page can make goes through
 * api/public/qr-charge/* — none of it needs or gets a Firebase session.
 */

const PRESET_AMOUNTS = [100, 200, 500];

let scriptPromise: Promise<void> | null = null;
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load the payment form — check your connection."));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

interface ChargerInfo {
  label: string;
  location: string;
  chargerPowerType: string;
  connectorType: string | null;
  powerKw: number | null;
  online: boolean;
  available: boolean;
  estimatedRatePerKwh: number | null;
}

interface SessionStatus {
  status: string;
  amountInr: number;
  finalCostInr: number | null;
  sessionStatus: string | null;
  energyDeliveredWh: number;
}

export default function QrChargePage() {
  const { chargerId } = useParams<{ chargerId: string }>();
  const searchParams = useSearchParams();
  const evseId = searchParams.get("evse") ? Number(searchParams.get("evse")) : undefined;

  const [info, setInfo] = useState<ChargerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(200);
  const [customAmount, setCustomAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [banner, setBanner] = useState<{ message: string; imageUrl: string | null; linkUrl: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/public/banners").then((r) => r.json()).then((data) => setBanner(data.banner)).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch(`/api/public/qr-charge/info?chargerId=${encodeURIComponent(chargerId)}`)
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setInfo(data)))
      .catch(() => setError("Could not load this charger. Check the QR code and try again."));
  }, [chargerId]);

  useEffect(() => {
    if (!idToken) return;
    const poll = setInterval(() => {
      fetch(`/api/public/qr-charge/status?idToken=${idToken}`)
        .then((r) => r.json())
        .then((data) => !data.error && setStatus(data))
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(poll);
  }, [idToken]);

  const effectiveAmount = customAmount.trim() ? Number(customAmount) : amount;

  async function payAndCharge() {
    if (!info || !phone.trim() || effectiveAmount < 10) return;
    setBusy(true);
    setError(null);
    try {
      await loadCheckoutScript();
      const orderRes = await fetch("/api/public/qr-charge/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chargerId, amountInr: effectiveAmount }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error ?? "Could not start payment.");

      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Livanto Green",
        description: info.label,
        prefill: { contact: phone.trim() },
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          void (async () => {
            try {
              const startRes = await fetch("/api/public/qr-charge/start", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  chargerId, evseId, phone: phone.trim(), amountInr: effectiveAmount,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              const start = await startRes.json();
              if (!startRes.ok) throw new Error(start.error ?? "Payment succeeded, but the charger could not be started.");
              setIdToken(start.idToken);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function stopCharging() {
    if (!idToken) return;
    setBusy(true);
    try {
      const res = await fetch("/api/public/qr-charge/stop", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white"><Zap className="h-5 w-5" /></div>
          <span className="text-lg font-semibold text-ink-900">Livanto Green</span>
        </div>

        {banner && (
          banner.linkUrl ? (
            <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="mb-4 block overflow-hidden rounded-xl bg-brand-50 ring-1 ring-brand-200">
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner.imageUrl} alt="" className="w-full" />
              )}
              <p className="p-3 text-sm font-medium text-brand-800">{banner.message}</p>
            </a>
          ) : (
            <div className="mb-4 overflow-hidden rounded-xl bg-brand-50 ring-1 ring-brand-200">
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner.imageUrl} alt="" className="w-full" />
              )}
              <p className="p-3 text-sm font-medium text-brand-800">{banner.message}</p>
            </div>
          )
        )}

        {error && !info && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-ink-200">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}

        {!info && !error && (
          <div className="flex justify-center py-16 text-ink-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
        )}

        {info && !idToken && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink-200">
            <p className="text-lg font-semibold text-ink-900">{info.label}</p>
            <p className="text-sm text-ink-500">{info.location}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2 py-1 font-medium ${info.online ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                {info.online ? "Online" : "Offline"}
              </span>
              {info.available && <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">Available</span>}
              <span className="rounded-full bg-ink-100 px-2 py-1 font-medium text-ink-700">{info.chargerPowerType}{info.powerKw ? ` · ${info.powerKw} kW` : ""}</span>
            </div>
            {info.estimatedRatePerKwh != null && (
              <p className="mt-2 text-xs text-ink-500">Estimated rate: ₹{info.estimatedRatePerKwh}/kWh — final cost depends on your exact usage.</p>
            )}

            {!info.online ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This charger is offline right now. Please try again shortly or use a different charger.</p>
            ) : (
              <>
                <p className="mt-5 text-sm font-medium text-ink-900">1. Choose an amount</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => { setAmount(a); setCustomAmount(""); }}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${amount === a && !customAmount ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700"}`}
                    >
                      ₹{a}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Or enter a custom amount"
                  className="input mt-2 w-full"
                />

                <p className="mt-4 text-sm font-medium text-ink-900">2. Your phone number</p>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="For your receipt"
                  className="input mt-2 w-full"
                />

                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

                <button
                  type="button"
                  disabled={busy || !phone.trim() || effectiveAmount < 10}
                  onClick={() => void payAndCharge()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Pay ₹{effectiveAmount || 0} & Charge
                </button>
                <p className="mt-2 text-center text-xs text-ink-400">Prepaid — the session stops automatically once your amount is used up.</p>
              </>
            )}
          </div>
        )}

        {info && idToken && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-ink-200">
            {status?.sessionStatus === "ENDED" ? (
              <>
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <p className="mt-3 text-lg font-semibold text-ink-900">Charging complete</p>
                <p className="mt-1 text-sm text-ink-500">
                  {status.finalCostInr != null ? `Final cost: ₹${status.finalCostInr.toFixed(2)}` : "Finalizing your bill…"}
                </p>
                <p className="mt-1 text-xs text-ink-400">Energy delivered: {(status.energyDeliveredWh / 1000).toFixed(2)} kWh</p>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" />
                <p className="mt-3 text-lg font-semibold text-ink-900">Charging started</p>
                <p className="mt-1 text-sm text-ink-500">
                  {status ? `${(status.energyDeliveredWh / 1000).toFixed(2)} kWh delivered so far` : "Connecting…"}
                </p>
                <p className="mt-1 text-xs text-ink-400">Paid ₹{effectiveAmount} — stops automatically when used up.</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void stopCharging()}
                  className="mt-5 w-full rounded-lg border border-ink-300 px-4 py-3 font-medium text-ink-700 disabled:opacity-50"
                >
                  Stop charging
                </button>
              </>
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
