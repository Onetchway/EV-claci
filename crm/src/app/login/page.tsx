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
    <main className="grid min-h-screen w-full place-items-center bg-ink-50 px-6 py-14">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.name} className="h-12 max-w-[220px] object-contain" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
              <Building2 className="h-6 w-6" />
            </span>
          )}
          <p className="text-lg font-semibold text-ink-900">{branding.name}</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
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

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Access restricted to authorized users. Accounts are provisioned by an administrator.
        </p>
      </div>
    </main>
  );
}
