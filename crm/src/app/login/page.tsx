"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, ShieldCheck, Users2, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Spinner, useToast } from "@/components/ui";

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

export default function LoginPage() {
  const { signInWithGoogle, user, profile, loading, configured } = useAuth();
  const router = useRouter();
  const { push } = useToast();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-100 p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-2">
        {/* Left — brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-50 via-brand-50 to-white p-10 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl"
          />

          <div className="relative">
            <p className="text-2xl font-bold tracking-tight text-ink-900">
              livanto <span className="text-brand-600">green.</span>
            </p>

            <h1 className="mt-10 text-4xl font-bold leading-tight text-ink-900">
              Powering the future
              <br />
              of <span className="text-brand-600">EV infrastructure</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
              Livanto Green CRM helps you manage leads, track projects, onboard
              franchise partners and drive seamless handovers — all in one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-medium text-ink-700 shadow-sm ring-1 ring-inset ring-brand-100"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-ink-400">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
              <Zap className="h-4 w-4" />
            </span>
            Livanto Green Infra Private Limited
          </div>
        </div>

        {/* Right — sign in */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="mb-6 flex items-start gap-2.5 rounded-lg bg-brand-50 px-4 py-3 text-xs text-brand-800 ring-1 ring-inset ring-brand-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Sign-in is restricted to <strong>@livantogreen.com</strong> Google
              Workspace accounts. Personal Google accounts cannot access this CRM.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-500">Sign in to access your Livanto Green CRM</p>

          <div className="mt-8">
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
                  className="flex w-full items-center justify-center gap-3 border border-ink-200 bg-white py-3 text-sm font-medium text-ink-800 hover:bg-ink-50"
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

                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-ink-400">
            Access restricted to authorized Livanto Green team members only.
            <br />
            Accounts are provisioned by an administrator — contact your admin for access.
          </p>

          <p className="mt-6 text-center text-[11px] text-ink-300">
            © {new Date().getFullYear()} Livanto Green
          </p>
        </div>
      </div>
    </main>
  );
}
