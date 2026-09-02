"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Input, Spinner, useToast } from "@/components/ui";

const FRIENDLY: Record<string, string> = {
  "auth/user-disabled": "This account has been disabled. Contact your administrator.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network error — check your connection and retry.",
};

function readableError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return FRIENDLY[code] ?? (e as Error)?.message ?? "Sign-in failed.";
}

interface Branding {
  name: string;
  logoUrl: string | null;
}

export default function LoginPage() {
  const { signIn, resetPassword, user, profile, loading, configured } = useAuth();
  const router = useRouter();
  const { push } = useToast();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const [branding, setBranding] = useState<Branding>({ name: "CRM", logoUrl: null });

  useEffect(() => {
    if (!loading && user && profile?.active) router.replace("/dashboard");
  }, [loading, user, profile, router]);

  useEffect(() => {
    fetch("/api/organizations/branding")
      .then((r) => r.json())
      .then((data: Branding) => setBranding(data))
      .catch(() => {});
  }, []);

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
    <main className="relative grid min-h-screen w-full place-items-center overflow-hidden bg-ink-50 px-6 py-14">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-[65%] rounded-full bg-brand-200/50 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 left-1/2 h-96 w-96 -translate-x-[35%] rounded-full bg-navy-200/40 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.name} className="h-14 max-w-[220px] object-contain drop-shadow-sm" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/30">
              <Building2 className="h-7 w-7" />
            </span>
          )}
          <p className="text-lg font-semibold tracking-tight text-ink-900">{branding.name}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-xl shadow-ink-900/5">
          <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 via-brand-400 to-navy-500" />
          <div className="p-8">
            <h1 className="text-2xl font-bold text-ink-900">Sign in</h1>
            <p className="mt-1 text-sm text-ink-500">Enter the email and password your administrator set up for you.</p>

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
          </div>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Access restricted to authorized users. Accounts are provisioned by an administrator.
        </p>
      </div>
    </main>
  );
}
