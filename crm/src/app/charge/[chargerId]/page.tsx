"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, Star, Zap } from "lucide-react";

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

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.livanto.app&pcampaignid=web_share";
const APP_STORE_URL = "https://apps.apple.com/in/app/livanto-green/id6753691310";

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

interface ConnectorInfo {
  id: string;
  status: string;
}

interface ChargerInfo {
  label: string;
  location: string;
  chargerPowerType: string;
  connectorType: string | null;
  powerKw: number | null;
  online: boolean;
  available: boolean;
  connectors: ConnectorInfo[];
  estimatedRatePerKwh: number | null;
  reviewAverage: number | null;
  reviewCount: number;
  companyName: string | null;
  companyLogoUrl: string | null;
}

const CONNECTOR_STATUS_LABEL: Record<string, string> = {
  Available: "Available", Occupied: "Charging", Reserved: "Reserved",
  Unavailable: "Unavailable", Faulted: "Out of order",
};
const CONNECTOR_STATUS_DOT: Record<string, string> = {
  Available: "bg-emerald-500", Occupied: "bg-amber-500", Reserved: "bg-sky-500",
  Unavailable: "bg-ink-400", Faulted: "bg-rose-500",
};
const CONNECTOR_STATUS_TEXT: Record<string, string> = {
  Available: "text-emerald-700", Occupied: "text-amber-700", Reserved: "text-sky-700",
  Unavailable: "text-ink-500", Faulted: "text-rose-700",
};

interface SessionStatus {
  status: string;
  amountInr: number;
  finalCostInr: number | null;
  sessionStatus: string | null;
  energyDeliveredWh: number;
}

/** Google Play's triangle glyph, inline so the badge never depends on an external image load on a possibly-flaky mobile connection. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M4.5 3.5c-.4.3-.6.8-.6 1.4v14.2c0 .6.2 1.1.6 1.4l.1.1L13 12.3v-.1L4.6 3.4l-.1.1Z" opacity=".9" />
      <path d="M15.9 15.2 13 12.3v-.1l2.9-2.9 6.5 3.7c.9.5.9 1.4 0 1.9l-6.5 3.7Z" opacity=".7" />
      <path d="M15.9 8.8 13 11.7 4.6 3.4c.3-.3.9-.4 1.5 0l9.8 5.4Z" />
      <path d="M15.9 15.2 6.1 20.6c-.6.4-1.2.3-1.5 0l8.4-8.3 2.9 2.9Z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.8 2.1 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1 2.7-2 .9-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.6ZM14.5 6.3c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2Z" />
    </svg>
  );
}

function AppStoreBadges() {
  return (
    <div className="mt-6 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-4 text-white shadow-lg">
      <p className="text-sm font-semibold">Get the Livanto Green app</p>
      <p className="mt-0.5 text-xs text-emerald-100">Save your charging history, favourite stations, and pay faster next time.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={PLAY_STORE_URL} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white/20"
        >
          <PlayGlyph /> Google Play
        </a>
        <a
          href={APP_STORE_URL} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white/20"
        >
          <AppleGlyph /> App Store
        </a>
      </div>
    </div>
  );
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
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);

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
        name: info.companyName || "Charge",
        description: info.label,
        theme: { color: "#047857" },
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

  async function submitReview() {
    if (!idToken || reviewRating < 1) return;
    setReviewBusy(true);
    try {
      const res = await fetch("/api/public/qr-charge/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chargerId, sessionId: idToken, rating: reviewRating, comment: reviewComment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit your review.");
      setReviewSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReviewBusy(false);
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-ink-50 to-ink-50 px-4 pb-10 pt-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-900/10">
            <Zap className="h-5 w-5" fill="currentColor" />
          </div>
          <span className="text-xl font-bold tracking-tight text-ink-900">{info?.companyName || "Charge"}</span>
        </div>

        {banner && (
          banner.linkUrl ? (
            <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="mb-4 block overflow-hidden rounded-2xl bg-brand-50 shadow-sm ring-1 ring-brand-200">
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner.imageUrl} alt="" className="w-full" />
              )}
              <p className="p-3 text-sm font-medium text-brand-800">{banner.message}</p>
            </a>
          ) : (
            <div className="mb-4 overflow-hidden rounded-2xl bg-brand-50 shadow-sm ring-1 ring-brand-200">
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner.imageUrl} alt="" className="w-full" />
              )}
              <p className="p-3 text-sm font-medium text-brand-800">{banner.message}</p>
            </div>
          )
        )}

        {error && !info && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-lg shadow-ink-900/5 ring-1 ring-ink-200">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}

        {!info && !error && (
          <div className="flex flex-col items-center gap-3 py-16 text-ink-400">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Loading charger…</p>
          </div>
        )}

        {info && !idToken && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-ink-900/5 ring-1 ring-ink-200">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold leading-tight">{info.label}</p>
                  <p className="text-sm text-emerald-100">{info.location}</p>
                </div>
                {info.reviewAverage != null && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-white/20">
                    <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> {info.reviewAverage}
                    <span className="font-normal text-emerald-100">({info.reviewCount})</span>
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${info.online ? "bg-emerald-400/20 ring-emerald-300/30" : "bg-rose-400/20 ring-rose-300/30"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${info.online ? "bg-emerald-300" : "bg-rose-300"}`} />
                  {info.online ? "Online" : "Offline"}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-inset ring-white/20">
                  {info.chargerPowerType}{info.powerKw ? ` · ${info.powerKw} kW` : ""}
                </span>
              </div>
            </div>

            <div className="p-6">
              {info.connectors.length > 0 && (
                <div className="grid gap-1.5">
                  {(evseId ? info.connectors.filter((c) => String(c.id) === String(evseId)) : info.connectors).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2 text-sm">
                      <span className="font-medium text-ink-700">Connector {c.id}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${CONNECTOR_STATUS_TEXT[c.status] ?? "text-ink-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${CONNECTOR_STATUS_DOT[c.status] ?? "bg-ink-400"}`} />
                        {CONNECTOR_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {info.estimatedRatePerKwh != null && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Estimated rate: ₹{info.estimatedRatePerKwh}/kWh — final cost depends on your exact usage.
                </p>
              )}

              {!info.online ? (
                <p className="mt-5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                  This charger is offline right now. Please try again shortly or use a different charger.
                </p>
              ) : (
                <>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">1. Choose an amount</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => { setAmount(a); setCustomAmount(""); }}
                        className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                          amount === a && !customAmount
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-ink-200 text-ink-700 hover:border-ink-300"
                        }`}
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
                    className="input mt-2 w-full rounded-xl"
                  />

                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-400">2. Your phone number</p>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="For your receipt"
                    className="input mt-2 w-full rounded-xl"
                  />

                  {error && (
                    <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>
                  )}

                  <button
                    type="button"
                    disabled={busy || !phone.trim() || effectiveAmount < 10}
                    onClick={() => void payAndCharge()}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3.5 font-bold text-white shadow-md shadow-emerald-900/20 transition hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:shadow-none"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" fill="currentColor" />}
                    Pay ₹{effectiveAmount || 0} & Charge
                  </button>
                  <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-ink-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Prepaid — stops automatically once your amount is used up.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {info && idToken && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-ink-900/5 ring-1 ring-ink-200">
            <div className="p-6 text-center">
              {status?.sessionStatus === "ENDED" ? (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="mt-4 text-lg font-bold text-ink-900">Charging complete</p>
                  <p className="mt-1 text-sm text-ink-500">
                    {status.finalCostInr != null ? `Final cost: ₹${status.finalCostInr.toFixed(2)}` : "Finalizing your bill…"}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">Energy delivered: {(status.energyDeliveredWh / 1000).toFixed(2)} kWh</p>

                  {reviewSubmitted ? (
                    <p className="mt-5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                      Thanks for your feedback!
                    </p>
                  ) : (
                    <div className="mt-5 rounded-xl bg-ink-50 p-4 text-left ring-1 ring-inset ring-ink-100">
                      <p className="text-sm font-semibold text-ink-900">Rate your charge</p>
                      <div className="mt-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => setReviewRating(n)} aria-label={`${n} star`}>
                            <Star className={`h-7 w-7 transition ${n <= reviewRating ? "fill-amber-500 text-amber-500" : "text-ink-300"}`} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Anything to add? (optional)"
                        rows={2}
                        maxLength={500}
                        className="input mt-3 w-full resize-none rounded-xl"
                      />
                      <button
                        type="button"
                        disabled={reviewBusy || reviewRating < 1}
                        onClick={() => void submitReview()}
                        className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                      >
                        {reviewBusy ? "Submitting…" : "Submit review"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-20" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                      <Zap className="h-7 w-7 text-emerald-600" fill="currentColor" />
                    </div>
                  </div>
                  <p className="mt-4 text-lg font-bold text-ink-900">Charging in progress</p>
                  <p className="mt-1 text-sm text-ink-500">
                    {status ? `${(status.energyDeliveredWh / 1000).toFixed(2)} kWh delivered so far` : "Connecting…"}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">Paid ₹{effectiveAmount} — stops automatically when used up.</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void stopCharging()}
                    className="mt-6 w-full rounded-xl border-2 border-ink-200 px-4 py-3 font-semibold text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Stop charging
                  </button>
                </>
              )}
              {error && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</p>
              )}
            </div>
          </div>
        )}

        {/^livanto/i.test(info?.companyName ?? "") && <AppStoreBadges />}

        <p className="mt-6 text-center text-xs text-ink-400">© {new Date().getFullYear()} {info?.companyName || "Charge"}</p>
      </div>
    </div>
  );
}
