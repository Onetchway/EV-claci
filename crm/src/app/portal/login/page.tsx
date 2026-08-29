"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Phone, Plug, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { PortalBrand } from "@/components/portal-brand";
import { useSettings } from "@/hooks/use-settings";
import { usePortalAuth } from "@/lib/portal-auth";

const RECAPTCHA_CONTAINER_ID = "portal-recaptcha-container";

const HIGHLIGHTS = [
  { icon: Zap, title: "Live visibility", text: "Track live status of your chargers, site and project — in real time." },
  { icon: ShieldCheck, title: "Easy management", text: "Payments, receipts and agreements, all in one place." },
  { icon: Sparkles, title: "Secure & simple", text: "One-tap login with OTP — no password to remember." },
];

export default function PortalLoginPage() {
  const router = useRouter();
  const { loading, user, configured, sendOtp, confirmOtp } = usePortalAuth();
  const { settings } = useSettings();
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

  const helpHref = settings.company.phone
    ? `tel:${settings.company.phone}`
    : settings.company.email
      ? `mailto:${settings.company.email}`
      : null;
  const helpLabel = settings.company.phone || settings.company.email;

  if (!configured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-inset ring-ink-100">
          <PortalBrand className="mx-auto h-8 max-w-[160px] object-contain" />
          <p className="mt-4 text-sm text-ink-500">This portal isn&apos;t configured yet. Please try again later.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <PortalBrand className="h-7 max-w-[150px] object-contain" />
          {helpHref && (
            <a href={helpHref} className="flex items-center gap-2 text-sm text-ink-600 hover:text-brand-700">
              <Phone className="h-3.5 w-3.5 text-brand-600" />
              Need help? <span className="font-semibold">{helpLabel}</span>
            </a>
          )}
        </div>
      </header>

      <div className="flex items-center justify-center px-6 py-10 sm:py-14">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-inset ring-ink-100 lg:grid-cols-2">
          {/* Brand / highlights panel — hidden on small screens to keep the form front and center. */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-navy-900 to-brand-800 p-10 text-white lg:flex">
            <Plug className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 text-white/5" strokeWidth={1} />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                <Zap className="h-3.5 w-3.5" /> Franchise partner portal
              </span>
              <h1 className="mt-5 text-2xl font-bold leading-snug">
                Everything about your franchise, <span className="text-emerald-300">in one place.</span>
              </h1>
            </div>

            <ul className="relative space-y-5">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Icon className="h-4 w-4 text-emerald-300" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/70">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="relative text-xs text-white/50">&copy; {new Date().getFullYear()} Livanto Green Infra Private Limited</p>
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
                ? "We'll send a one-time code (OTP) to the mobile number registered with your franchise."
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

            <p className="mt-8 text-center text-xs text-ink-400">
              Do not share your OTP with anyone, including Livanto staff.
            </p>
          </div>
        </div>
      </div>

      {/* Anchor for the invisible reCAPTCHA Firebase Phone Auth requires. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </main>
  );
}
