"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";

import { PortalBrand } from "@/components/portal-brand";
import { usePortalAuth } from "@/lib/portal-auth";

const RECAPTCHA_CONTAINER_ID = "portal-recaptcha-container";

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

  if (!configured) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-ink-500">This portal isn&apos;t configured yet. Please try again later.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card ring-1 ring-inset ring-ink-100">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <PortalBrand />
          </div>
          <p className="mt-2 text-sm text-ink-500">Franchise partner portal</p>
        </div>

        {stage === "phone" ? (
          <div className="space-y-4">
            <div>
              <label className="label">Mobile number</label>
              <div className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-500">
                <Phone className="h-4 w-4 text-ink-400" />
                <span className="text-sm text-ink-500">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-ink-500">The number registered with your franchise.</p>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              disabled={busy || phone.length !== 10}
              onClick={() => void handleSendOtp()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send OTP
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Enter the 6-digit code</label>
              <div className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-500">
                <ShieldCheck className="h-4 w-4 text-ink-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full border-0 bg-transparent p-0 text-sm tracking-widest outline-none"
                  autoFocus
                />
              </div>
              <p className="mt-1 text-xs text-ink-500">Sent by SMS to +91 {phone}.</p>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              disabled={busy || code.length !== 6}
              onClick={() => void handleConfirmOtp()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
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
      </div>
      {/* Anchor for the invisible reCAPTCHA Firebase Phone Auth requires. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </main>
  );
}
