"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Phone, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { PortalBrand } from "@/components/portal-brand";
import { usePortalAuth } from "@/lib/portal-auth";
import { cn } from "@/lib/utils";

const RECAPTCHA_CONTAINER_ID = "portal-recaptcha-container";

const HIGHLIGHTS = [
  { icon: Zap, text: "Live status on your chargers, site and project stage" },
  { icon: ShieldCheck, text: "Payments, receipts and agreements, always on hand" },
  { icon: Sparkles, text: "One tap, no password — just your registered number" },
];

export default function PortalLoginPage() {
  const router = useRouter();
  const { loading, user, configured, sendOtp, confirmOtp } = usePortalAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/portal");
  }, [loading, user, router]);

  async function handleSendOtp() {
    setError(null);
    setBusy(true);
    try {
      await sendOtp(phone, RECAPTCHA_CONTAINER_ID);
      setStage("otp");
    } catch (e) {
      setError((e as Error).message || "Could not send the code. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmOtp() {
    setError(null);
    setBusy(true);
    try {
      await confirmOtp(code);
      router.replace("/portal");
    } catch (e) {
      setError((e as Error).message || "That code didn't match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const shellClass =
    "relative flex min-h-screen items-center justify-center overflow-hidden " +
    "bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 p-6";

  const backdrop = (
    <>
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
    </>
  );

  if (!configured) {
    return (
      <main className={shellClass}>
        {backdrop}
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl ring-1 ring-inset ring-black/5">
          <PortalBrand className="mx-auto h-8 max-w-[160px] object-contain" />
          <p className="mt-4 text-sm text-ink-500">This portal isn&apos;t configured yet. Please try again later.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={shellClass}>
      {backdrop}

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-inset ring-black/5 lg:grid-cols-2">
        {/* Brand / highlights panel — hidden on small screens to keep the form front and center. */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-navy-900 via-navy-900 to-brand-800 p-10 text-white lg:flex">
          <div>
            <PortalBrand className="h-8 max-w-[150px] object-contain brightness-0 invert" />
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/60">Franchise partner portal</p>
          </div>

          <div>
            <h1 className="text-2xl font-bold leading-snug">
              Everything about your franchise, in one place.
            </h1>
            <ul className="mt-6 space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Icon className="h-3.5 w-3.5 text-emerald-300" />
                  </span>
                  <span className="text-sm text-white/85">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/50">&copy; {new Date().getFullYear()} Livanto Green Infra Private Limited</p>
        </div>

        {/* Login form */}
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <PortalBrand className="h-8 max-w-[150px] object-contain" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Franchise partner portal</p>
          <h2 className="mt-1 text-xl font-bold text-ink-900">
            {stage === "phone" ? "Sign in to your franchise" : "Verify your number"}
          </h2>
          <p className="mt-1.5 text-sm text-ink-500">
            {stage === "phone"
              ? "We'll text a one-time code to the number registered with your franchise."
              : `Enter the 6-digit code we sent by SMS to +91 ${phone}.`}
          </p>

          {stage === "phone" ? (
            <div className="mt-6 space-y-4">
              <div>
                <label className="label">Mobile number</label>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 px-3.5 py-3 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20">
                  <Phone className="h-4 w-4 shrink-0 text-ink-400" />
                  <span className="text-sm font-medium text-ink-500">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                    autoFocus
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-400">The number registered with your franchise.</p>
              </div>
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</p>
              )}
              <button
                disabled={busy || phone.length !== 10}
                onClick={() => void handleSendOtp()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send OTP
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="label">Enter the 6-digit code</label>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 px-3.5 py-3 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-ink-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full border-0 bg-transparent p-0 text-sm tracking-[0.3em] outline-none"
                    autoFocus
                  />
                </div>
              </div>
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</p>
              )}
              <button
                disabled={busy || code.length !== 6}
                onClick={() => void handleConfirmOtp()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify &amp; continue
              </button>
              <button
                disabled={busy}
                onClick={() => { setStage("phone"); setCode(""); setError(null); }}
                className="w-full text-center text-xs font-medium text-ink-500 hover:text-ink-800"
              >
                Use a different number
              </button>
            </div>
          )}

          <p className={cn("mt-8 text-center text-xs text-ink-400", stage === "otp" && "lg:mt-6")}>
            Do not share your OTP with anyone, including Livanto staff.
          </p>
        </div>
      </div>

      {/* Anchor for the invisible reCAPTCHA Firebase Phone Auth requires. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </main>
  );
}
