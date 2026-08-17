"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, ShieldCheck, Users2, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Input, Spinner, useToast } from "@/components/ui";

const FRIENDLY: Record<string, string> = {
  "auth/popup-closed-by-user": "Sign-in window closed before completing — try again.",
  "auth/user-disabled": "This account has been disabled. Contact your administrator.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network error — check your connection and retry.",
  "auth/account-exists-with-different-credential":
    "This email already has an account created a different way. Contact your administrator.",
};

function readableError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return FRIENDLY[code] ?? (e as Error)?.message ?? "Sign-in failed.";
}

const FEATURES = [
  { icon: Users2, label: "Lead Management" },
  { icon: Building2, label: "Project Tracking" },
  { icon: Zap, label: "Franchise Handover" },
];

/** A charging-station scene, built from plain shapes — no external art asset available. */
function ChargingStationArt() {
  return (
    <svg viewBox="0 0 640 360" className="w-full max-w-xl" aria-hidden>
      {/* skyline */}
      <g opacity="0.35" fill="#148a3f">
        <rect x="20" y="180" width="46" height="140" rx="3" />
        <rect x="80" y="140" width="40" height="180" rx="3" />
        <rect x="540" y="160" width="42" height="160" rx="3" />
        <rect x="590" y="120" width="40" height="200" rx="3" />
      </g>
      {/* ground */}
      <rect x="0" y="320" width="640" height="4" fill="#0f6e33" opacity="0.25" />
      {/* wind turbine */}
      <g stroke="#148a3f" strokeWidth="3" opacity="0.5" fill="none">
        <line x1="470" y1="320" x2="470" y2="160" />
        <g transform="translate(470,160)">
          <line x1="0" y1="0" x2="34" y2="-14" />
          <line x1="0" y1="0" x2="-30" y2="-20" />
          <line x1="0" y1="0" x2="-6" y2="30" />
        </g>
      </g>
      {/* canopy */}
      <rect x="120" y="70" width="360" height="18" rx="4" fill="#1fae54" />
      <rect x="120" y="88" width="360" height="6" fill="#148a3f" />
      <rect x="150" y="94" width="14" height="150" fill="#d5d9e2" />
      <rect x="436" y="94" width="14" height="150" fill="#d5d9e2" />
      <text x="300" y="83" textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">livanto green.</text>

      {/* charger 1 */}
      <g transform="translate(210,160)">
        <rect width="56" height="130" rx="10" fill="#ffffff" stroke="#b0f1c9" strokeWidth="2" />
        <rect x="10" y="16" width="36" height="26" rx="3" fill="#0d4c31" />
        <circle cx="28" cy="70" r="9" fill="#1fae54" />
        <path d="M25 65 L31 65 L27 75 L33 75 L23 88 L26 76 L21 76 Z" fill="#fff" />
        <path d="M6 130 q22 26 44 0" stroke="#8590a8" strokeWidth="3" fill="none" />
      </g>

      {/* charger 2 */}
      <g transform="translate(370,160)">
        <rect width="56" height="130" rx="10" fill="#ffffff" stroke="#b0f1c9" strokeWidth="2" />
        <rect x="10" y="16" width="36" height="26" rx="3" fill="#0d4c31" />
        <circle cx="28" cy="70" r="9" fill="#1fae54" />
        <path d="M25 65 L31 65 L27 75 L33 75 L23 88 L26 76 L21 76 Z" fill="#fff" />
        <path d="M6 130 q22 26 44 0" stroke="#8590a8" strokeWidth="3" fill="none" />
      </g>

      {/* car */}
      <g transform="translate(255,215)">
        <rect x="0" y="30" width="180" height="50" rx="16" fill="#171a21" />
        <path d="M18 30 Q40 -4 90 -4 Q140 -4 162 30 Z" fill="#171a21" />
        <path d="M28 26 Q46 4 90 4 Q134 4 152 26 Z" fill="#66738d" opacity="0.5" />
        <circle cx="36" cy="82" r="15" fill="#0d0f14" />
        <circle cx="144" cy="82" r="15" fill="#0d0f14" />
        <circle cx="36" cy="82" r="6" fill="#8590a8" />
        <circle cx="144" cy="82" r="6" fill="#8590a8" />
        {/* charging cable to charger 2 */}
        <path d="M170 55 q30 10 55 5" stroke="#1fae54" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { signInWithGoogle, signIn, resetPassword, user, profile, loading, configured } = useAuth();
  const router = useRouter();
  const { push } = useToast();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && user && profile?.active) router.replace("/dashboard");
  }, [loading, user, profile, router]);

  async function onGoogleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (err) {
      const message = readableError(err);
      setError(message);
      push(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onEmailSignIn(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      const message = readableError(err);
      setError(message);
      push(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email above first, then click \"Forgot password?\".");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen w-full bg-white lg:grid-cols-2">
      {/* Left — brand panel, full bleed */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-50 via-brand-50 to-white px-16 py-14 lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl" />

        <div className="relative">
          <p className="text-3xl font-bold tracking-tight text-ink-900">
            livanto <span className="text-brand-600">green.</span>
          </p>

          <h1 className="mt-14 text-5xl font-bold leading-[1.1] text-ink-900">
            Powering the future
            <br />
            of <span className="text-brand-600">EV infrastructure</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-500">
            Livanto Green CRM helps you manage leads, track projects, onboard
            franchise partners and drive seamless handovers — all in one place.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-xl bg-white/80 px-4 py-3 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-inset ring-brand-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center py-6">
          <ChargingStationArt />
        </div>

        <div className="relative flex items-center gap-2.5 text-sm text-ink-400">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Zap className="h-4 w-4" />
          </span>
          Livanto Green Infra Private Limited
        </div>
      </div>

      {/* Right — sign in, full bleed */}
      <div className="flex flex-col justify-center px-6 py-14 sm:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-start gap-3 rounded-xl bg-brand-50 px-5 py-4 text-sm text-brand-800 ring-1 ring-inset ring-brand-100">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Livanto Green staff sign in with their <strong>@livantogreen.com</strong> Google
              Workspace account. Site Owners, Fleet Managers and other external partners sign in
              with the email and password an administrator set up for them.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-2 text-base text-ink-500">Sign in to access your Livanto Green CRM</p>

          <div className="mt-10">
            {!configured ? (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                <p className="font-semibold">Firebase is not configured</p>
                <p className="mt-1">
                  Copy <code className="rounded bg-amber-100 px-1">.env.example</code> to{" "}
                  <code className="rounded bg-amber-100 px-1">.env.local</code> and fill in your
                  Firebase web-app keys, then restart the dev server.
                </p>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-8 text-ink-400">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={() => void onGoogleSignIn()}
                  loading={busy}
                  className="flex w-full items-center justify-center gap-3 border border-ink-200 bg-white py-4 text-base font-medium text-ink-800 hover:bg-ink-50"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1C3.26 21.3 7.3 24 12 24z" />
                    <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.3 0 3.26 2.7 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
                  </svg>
                  Continue with Google
                  <span className="ml-auto text-xs font-normal text-ink-400">@livantogreen.com</span>
                </Button>

                <div className="flex items-center gap-3 text-xs text-ink-400">
                  <span className="h-px flex-1 bg-ink-200" />
                  or sign in with email
                  <span className="h-px flex-1 bg-ink-200" />
                </div>

                <form className="space-y-3" onSubmit={(e) => void onEmailSignIn(e)}>
                  <Input
                    type="email"
                    autoComplete="username"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setResetSent(false); }}
                  />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button type="submit" loading={busy} disabled={!email.trim() || !password} className="w-full py-3">
                    Sign in
                  </Button>
                  <button
                    type="button"
                    onClick={() => void onForgotPassword()}
                    className="text-xs text-ink-500 underline decoration-dotted hover:text-ink-700"
                  >
                    Forgot password?
                  </button>
                  {resetSent && (
                    <p className="text-xs text-emerald-700">Password reset email sent — check your inbox.</p>
                  )}
                </form>

                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="mt-10 text-center text-sm text-ink-400">
            Access restricted to authorized Livanto Green team members only.
            <br />
            Accounts are provisioned by an administrator — contact your admin for access.
          </p>

          <p className="mt-8 text-center text-xs text-ink-300">
            © {new Date().getFullYear()} Livanto Green
          </p>
        </div>
      </div>
    </main>
  );
}
