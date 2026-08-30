"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, HardHat, ShieldCheck, Truck } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Input, Spinner, useToast } from "@/components/ui";

const WORKSPACE_DOMAIN = process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN || "nakjminfra.com";

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
  { icon: Building2, label: "Client & Project Management" },
  { icon: Truck, label: "Vendor & Procurement" },
  { icon: HardHat, label: "Site Progress Tracking" },
];

export default function LoginPage() {
  const router = useRouter();
  const { loading, user, profile, configured, signIn, signInWithGoogle, resetPassword } = useAuth();
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
      setError('Enter your email above first, then click "Forgot password?".');
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
      {/* Left — brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-50 via-brand-50 to-white px-16 py-14 lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-navy-200/30 blur-3xl" />

        <div className="relative">
          <Image src="/logo.png" alt="NAKJM Infrastructure" width={220} height={70} priority className="h-14 w-auto" />

          <h1 className="mt-14 text-5xl font-bold leading-[1.1] text-ink-900">
            Running EPC projects
            <br />
            <span className="text-brand-600">end to end</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-500">
            Clients, projects, BOQs, quotations, purchase orders, proforma
            invoices, vendor payments and site progress — all in one place.
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

        <div className="relative flex items-center gap-2.5 text-sm text-ink-400">
          NAKJM Infrastructure Private Limited
        </div>
      </div>

      {/* Right — sign in */}
      <div className="flex flex-col justify-center px-6 py-14 sm:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-start gap-3 rounded-xl bg-brand-50 px-5 py-4 text-sm text-brand-800 ring-1 ring-inset ring-brand-100">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              NAKJM staff sign in with their <strong>@{WORKSPACE_DOMAIN}</strong> Google
              Workspace account, or with the email and password an administrator set up for them.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-2 text-base text-ink-500">Sign in to access the NAKJM CRM</p>

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
                  <span className="ml-auto text-xs font-normal text-ink-400">@{WORKSPACE_DOMAIN}</span>
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
            Access restricted to authorized NAKJM team members only.
            <br />
            Accounts are provisioned by an administrator — contact your admin for access.
          </p>

          <p className="mt-8 text-center text-xs text-ink-300">© {new Date().getFullYear()} NAKJM Infra</p>
        </div>
      </div>
    </main>
  );
}
