"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Field, Input, Spinner, useToast } from "@/components/ui";

const FRIENDLY: Record<string, string> = {
  "auth/invalid-credential": "That email and password combination is not recognised.",
  "auth/invalid-email": "That does not look like a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact your administrator.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network error — check your connection and retry.",
};

function readableError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return FRIENDLY[code] ?? (e as Error)?.message ?? "Sign-in failed.";
}

export default function LoginPage() {
  const { signIn, resetPassword, user, profile, loading, configured } = useAuth();
  const router = useRouter();
  const { push } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && profile?.active) router.replace("/dashboard");
  }, [loading, user, profile, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!email.trim()) {
      setError("Enter your email address first, then choose 'Forgot password'.");
      return;
    }
    try {
      await resetPassword(email);
      push("Password reset link sent. Check your inbox.", "success");
    } catch (err) {
      setError(readableError(err));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 via-ink-900 to-brand-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
            <Zap className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-semibold text-white">Livanto Green CRM</h1>
          <p className="mt-1 text-sm text-ink-300">EV charging franchise — lead to handover</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl">
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
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Work email" required>
                <Input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@livantogreen.com"
                />
              </Field>
              <Field label="Password" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" loading={busy} className="w-full">
                Sign in
              </Button>

              <button
                type="button"
                onClick={onReset}
                className="w-full text-center text-xs font-medium text-ink-500 hover:text-brand-700"
              >
                Forgot password?
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ink-400">
          Accounts are created by an administrator. Contact your admin for access.
        </p>
      </div>
    </main>
  );
}
