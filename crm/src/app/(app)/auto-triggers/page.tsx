"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Button, Card, Checkbox, EmptyState, Field, Input, PageHeader, Spinner, useAsyncAction,
} from "@/components/ui";
import {
  DEFAULT_AUTO_TRIGGER_SETTINGS, subscribeAutoTriggerSettings, updateAutoTriggerSettings,
  type AutoTriggerSettings,
} from "@/lib/db/auto-triggers";
import { isAdmin } from "@/lib/permissions";

export default function AutoTriggersPage() {
  const viewer = useViewer();
  const canManage = isAdmin(viewer.role);
  const { run, busy } = useAsyncAction();

  const [settings, setSettings] = useState<AutoTriggerSettings | null>(null);
  const [form, setForm] = useState<AutoTriggerSettings>(DEFAULT_AUTO_TRIGGER_SETTINGS);

  useEffect(() => subscribeAutoTriggerSettings((s) => { setSettings(s); setForm(s); }), []);

  if (!canManage) {
    return <EmptyState title="Admins only" description="Auto Triggers are restricted to admins." />;
  }

  async function save() {
    await run(() => updateAutoTriggerSettings(form), "Auto triggers updated.");
  }

  const dirty = settings && JSON.stringify(settings) !== JSON.stringify(form);

  return (
    <>
      <PageHeader
        title="Auto Triggers"
        description="Parameters for the automations the OCPP server runs on its own — fault SLA, non-disruptive auto-recovery before a fault ticket opens, and low-wallet-balance alerts. Changes apply within a minute (cached server-side)."
        actions={<Button variant="primary" loading={busy} disabled={!dirty} onClick={() => void save()}>Save changes</Button>}
      />

      {settings === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Fault tickets" subtitle="A per-site SLA (Zones & Load Balancing) always overrides this default.">
            <div className="grid gap-4">
              <Field label="Default SLA (hours)" hint="Hours before an open fault ticket is flagged as SLA-breached.">
                <Input
                  type="number" min={1}
                  value={form.faultSlaHoursDefault}
                  onChange={(e) => setForm((f) => ({ ...f, faultSlaHoursDefault: Number(e.target.value) || 1 }))}
                />
              </Field>
              <Field label="Offline sweep (minutes)" hint="Missed-heartbeat window before an ONLINE charger is swept to OFFLINE and ticketed. Takes effect on next server restart.">
                <Input
                  type="number" min={1}
                  value={form.offlineSweepMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, offlineSweepMinutes: Number(e.target.value) || 1 }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="Auto-recovery" subtitle="A non-disruptive Reset(OnIdle) attempted before a FAULT ticket opens — never interrupts an active session.">
            <div className="grid gap-4">
              <Checkbox
                checked={form.autoRecoveryEnabled}
                onChange={(v) => setForm((f) => ({ ...f, autoRecoveryEnabled: v }))}
                label="Attempt auto-recovery before opening a FAULT ticket"
              />
              <Field label="Cooldown between attempts (minutes)" hint="Never hammer a genuinely broken charger with repeated resets.">
                <Input
                  type="number" min={1}
                  disabled={!form.autoRecoveryEnabled}
                  value={form.autoRecoveryCooldownMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, autoRecoveryCooldownMinutes: Number(e.target.value) || 1 }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="Low wallet balance alerts" subtitle="Fires once per crossing (was above, now at/below) — not re-sent every session a postpaid account stays negative.">
            <div className="grid gap-4">
              <Checkbox
                checked={form.lowBalanceAlertEnabled}
                onChange={(v) => setForm((f) => ({ ...f, lowBalanceAlertEnabled: v }))}
                label="Email a driver/corporate account when their balance crosses the threshold"
              />
              <Field label="Threshold (₹)">
                <Input
                  type="number" min={0}
                  disabled={!form.lowBalanceAlertEnabled}
                  value={form.lowBalanceThresholdInr}
                  onChange={(e) => setForm((f) => ({ ...f, lowBalanceThresholdInr: Number(e.target.value) || 0 }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="About" className="flex items-start gap-3">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <p className="text-sm text-ink-600">
              These are the automations that already run today, made adjustable instead of fixed in code.
              A generic if-this-then-that rule builder (arbitrary triggers/conditions/actions) is a larger
              feature not built yet — this page covers the automations that exist.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
