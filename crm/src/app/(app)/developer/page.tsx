"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, Trash2, Webhook } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import { createApiKey, deleteApiKey, setApiKeyActive, subscribeApiKeys } from "@/lib/db/api-keys";
import { createWebhook, deleteWebhook, setWebhookActive, subscribeWebhooks } from "@/lib/db/webhooks";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/constants";
import { isAdmin } from "@/lib/permissions";
import type { ApiKey, WebhookSubscription } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function DeveloperPage() {
  const { actor, role } = useAuth();
  const canManage = !!role && isAdmin(role);
  const { run, busy } = useAsyncAction();
  const { push } = useToast();

  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [hooks, setHooks] = useState<WebhookSubscription[] | null>(null);
  const [reveal, setReveal] = useState<{ label: string; value: string } | null>(null);

  const [keyOpen, setKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState("");

  const [hookOpen, setHookOpen] = useState(false);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<WebhookEvent[]>([]);

  useEffect(() => subscribeApiKeys(setKeys), []);
  useEffect(() => subscribeWebhooks(setHooks), []);

  async function submitKey() {
    if (!actor || !keyName.trim()) return;
    setKeyOpen(false);
    try {
      const raw = await createApiKey(keyName.trim(), actor);
      setKeyName("");
      setReveal({ label: "API key", value: raw });
    } catch (e) {
      push((e as Error).message, "error");
    }
  }

  async function submitHook() {
    if (!actor || !hookUrl.trim() || hookEvents.length === 0) return;
    setHookOpen(false);
    try {
      const secret = await createWebhook(hookUrl.trim(), hookEvents, actor);
      setHookUrl(""); setHookEvents([]);
      setReveal({ label: "Webhook signing secret", value: secret });
    } catch (e) {
      push((e as Error).message, "error");
    }
  }

  if (!canManage) {
    return <EmptyState title="Admins only" description="Developer API keys and webhooks are restricted to admins." />;
  }

  return (
    <>
      <PageHeader
        title="Developer"
        description="Read-only API keys for external integrations, and webhooks for session/ticket events. Nothing here can write to the CRM — /api/v1 only exposes GET endpoints."
      />

      <Card
        title="API keys"
        subtitle="GET /api/v1/{chargers,sessions,tariffs,invoices,tickets} — Authorization: Bearer <key> — rate limited to 60 req/min per key"
        actions={<Button size="sm" onClick={() => setKeyOpen(true)}><Plus className="h-4 w-4" /> New key</Button>}
        className="mb-4"
      >
        {keys === null ? (
          <div className="flex justify-center py-8 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : keys.length === 0 ? (
          <EmptyState icon={<KeyRound className="h-8 w-8" />} title="No API keys yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Name</th><th className="th">Key</th><th className="th">Last used</th><th className="th">Status</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{k.name}</td>
                    <td className="td font-mono text-xs text-ink-600">{k.prefix}…</td>
                    <td className="td text-ink-600">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Never"}</td>
                    <td className="td">
                      <Badge className={k.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {k.active ? "Active" : "Revoked"}
                      </Badge>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => void run(() => setApiKeyActive(k.id, !k.active))}>
                          {k.active ? "Revoke" : "Reactivate"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`Delete key "${k.name}"?`)) return;
                            void run(() => deleteApiKey(k.id), "Key deleted.");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Webhooks"
        subtitle="Signed POST, HMAC-SHA256 in x-livanto-signature — retried up to 3 times with backoff on delivery failure"
        actions={<Button size="sm" onClick={() => setHookOpen(true)}><Plus className="h-4 w-4" /> New webhook</Button>}
      >
        {hooks === null ? (
          <div className="flex justify-center py-8 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : hooks.length === 0 ? (
          <EmptyState icon={<Webhook className="h-8 w-8" />} title="No webhooks yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">URL</th><th className="th">Events</th><th className="th">Status</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {hooks.map((h) => (
                  <tr key={h.id} className="hover:bg-ink-50">
                    <td className="td max-w-xs truncate font-mono text-xs" title={h.url}>{h.url}</td>
                    <td className="td text-ink-600">{h.events.join(", ")}</td>
                    <td className="td">
                      <Badge className={h.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {h.active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => void run(() => setWebhookActive(h.id, !h.active))}>
                          {h.active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!window.confirm("Delete this webhook?")) return;
                            void run(() => deleteWebhook(h.id), "Webhook deleted.");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        title="New API key"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setKeyOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!keyName.trim()} onClick={() => void submitKey()}>Create</Button>
          </>
        )}
      >
        <Field label="Name" required><Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Partner dashboard" /></Field>
      </Modal>

      <Modal
        open={hookOpen}
        onClose={() => setHookOpen(false)}
        title="New webhook"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setHookOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!hookUrl.trim() || hookEvents.length === 0} onClick={() => void submitHook()}>Create</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Endpoint URL" required><Input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Events" required>
            <div className="grid gap-1.5">
              {WEBHOOK_EVENTS.map((ev) => (
                <Checkbox
                  key={ev}
                  label={ev}
                  checked={hookEvents.includes(ev)}
                  onChange={(checked) => setHookEvents((prev) => (checked ? [...prev, ev] : prev.filter((e) => e !== ev)))}
                />
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!reveal}
        onClose={() => setReveal(null)}
        title={reveal?.label ?? ""}
        description="Shown only once — copy it now. It can't be retrieved again after closing this dialog."
        footer={<Button variant="primary" onClick={() => setReveal(null)}>Done</Button>}
      >
        {reveal && (
          <div className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2.5">
            <code className="flex-1 select-all break-all font-mono text-sm">{reveal.value}</code>
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(reveal.value);
                push("Copied.", "success");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
