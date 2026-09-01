"use client";

import { useRouter } from "next/navigation";
import {
  useEffect, useRef, useState,
  type ChangeEvent, type ClipboardEvent, type KeyboardEvent,
} from "react";
import { BatteryCharging, Loader2, Lock, Phone, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { PortalBrand } from "@/components/portal-brand";
import { useSettings } from "@/hooks/use-settings";
import { usePortalAuth } from "@/lib/portal-auth";
import { cn } from "@/lib/utils";

const RECAPTCHA_CONTAINER_ID = "portal-recaptcha-container";
const OTP_LENGTH = 6;

const HIGHLIGHTS = [
  { icon: Zap, title: "Live visibility", text: "Track live status of your chargers, site and project — in real time." },
  { icon: ShieldCheck, title: "Easy management", text: "Payments, receipts and agreements, all in one place." },
  { icon: Sparkles, title: "Secure & simple", text: "One-tap login with OTP — no password to remember." },
];

const STAT_CHIPS = [
  { icon: BatteryCharging, label: "Chargers live, tracked in real time" },
  { icon: Lock, label: "Bank-grade OTP security" },
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
      setCode("");
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

  const backdrop = (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "radial-gradient(circle, rgb(16 163 74 / 0.14) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute right-1/3 top-1/4 h-40 w-40 rounded-full bg-teal-200/40 blur-2xl" />
    </>
  );

  if (!configured) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-6">
        {backdrop}
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-inset ring-ink-100">
          <PortalBrand className="mx-auto h-8 max-w-[160px] object-contain" />
          <p className="mt-4 text-sm text-ink-500">This portal isn&apos;t configured yet. Please try again later.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {backdrop}

      <header className="relative border-b border-ink-100 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <PortalBrand className="h-7 max-w-[150px] object-contain" />
          {helpHref && (
            <a href={helpHref} className="flex items-center gap-2 text-sm text-ink-600 transition hover:text-brand-700">
              <Phone className="h-3.5 w-3.5 text-brand-600" />
              Need help? <span className="font-semibold">{helpLabel}</span>
            </a>
          )}
        </div>
      </header>

      <div className="relative flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-25px_rgba(16,94,53,0.35)] ring-1 ring-inset ring-ink-100 lg:grid-cols-2">
          {/* Brand / highlights panel — hidden on small screens to keep the form front and center. */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-950 via-brand-900 to-emerald-800 p-10 text-white lg:flex">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 animate-[pulse_5s_ease-in-out_infinite] rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-10 top-1/3 h-40 w-40 animate-[pulse_6s_ease-in-out_infinite] rounded-full bg-emerald-300/10 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-white/10">
                  <Zap className="h-3.5 w-3.5" /> Franchise partner portal
                </span>
              </div>
              <h1 className="mt-5 text-2xl font-bold leading-snug">
                Everything about your franchise, <span className="text-emerald-300">in one place.</span>
              </h1>
            </div>

            {/* Hero: a pulsing "charging" badge — the portal's visual centerpiece. */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-emerald-400/15 [animation:ping_3s_ease-in-out_infinite]" />
                <span className="absolute inset-4 rounded-full bg-emerald-400/10 [animation:ping_3s_ease-in-out_infinite] [animation-delay:0.6s]" />
                <span className="absolute inset-9 rounded-full border border-white/15" />
                <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-brand-500 shadow-lg shadow-emerald-950/50">
                  <Zap className="h-8 w-8 text-white" />
                </span>
              </div>

              <div className="absolute -right-2 -top-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live
              </div>
            </div>

            <ul className="relative space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-inset ring-white/10">
                    <Icon className="h-4 w-4 text-emerald-300" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/70">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="relative mt-6 flex flex-wrap gap-2">
              {STAT_CHIPS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70"
                >
                  <Icon className="h-3 w-3 text-emerald-300" /> {label}
                </span>
              ))}
            </div>

            <p className="relative mt-6 text-xs text-white/40">&copy; {new Date().getFullYear()} Livanto Green Infra Private Limited</p>
          </div>

          {/* Login form */}
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <PortalBrand className="h-8 max-w-[150px] object-contain" />
            </div>

            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-600 shadow-md shadow-brand-900/20">
                {stage === "phone" ? <Phone className="h-5 w-5 text-white" /> : <ShieldCheck className="h-5 w-5 text-white" />}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-5 rounded-full transition-colors", stage === "phone" ? "bg-brand-600" : "bg-brand-200")} />
                <span className={cn("h-1.5 w-5 rounded-full transition-colors", stage === "otp" ? "bg-brand-600" : "bg-ink-100")} />
              </div>
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-brand-600">Franchise partner portal</p>
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
                  <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 px-3.5 py-3 transition focus-within:border-brand-400 focus-within:bg-white focus-within:shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20">
                    <span aria-hidden className="text-base leading-none">🇮🇳</span>
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-900/10 transition hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send OTP
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="label">Enter the 6-digit code</label>
                  <OtpBoxes value={code} onChange={setCode} length={OTP_LENGTH} />
                </div>
                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">{error}</p>
                )}
                <button
                  disabled={busy || code.length !== OTP_LENGTH}
                  onClick={() => void handleConfirmOtp()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-900/10 transition hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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

            <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
              <Lock className="h-3 w-3" /> Do not share your OTP with anyone, including Livanto staff.
            </p>
          </div>
        </div>
      </div>

      {/* Anchor for the invisible reCAPTCHA Firebase Phone Auth requires. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </main>
  );
}

/** Six individually-boxed digit inputs — auto-advances on entry, steps back on backspace, and accepts a pasted code in one go. */
function OtpBoxes({
  value, onChange, length,
}: {
  value: string;
  onChange: (v: string) => void;
  length: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[i] = digit;
    onChange(chars.join("").slice(0, length));
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    requestAnimationFrame(() => refs.current[Math.min(pasted.length, length - 1)]?.focus());
  }

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1} of the verification code`}
          className="h-12 w-full rounded-xl border border-ink-200 bg-ink-50/50 text-center text-lg font-semibold text-ink-900 outline-none transition focus:border-brand-400 focus:bg-white focus:shadow-sm focus:ring-2 focus:ring-brand-500/20"
        />
      ))}
    </div>
  );
}
