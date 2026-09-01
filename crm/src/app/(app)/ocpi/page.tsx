"use client";

import { useEffect, useState } from "react";
import { Copy, Globe, Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import { inviteOcpiParty, revokeOcpiParty, subscribeOcpiParties, type OcpiPartyRow } from "@/lib/db/ocpi-parties";
import { canManageOcpi } from "@/lib/permissions";

const STATUS_COLOR: Record<OcpiPartyRow["status"], string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  REGISTERED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REVOKED: "bg-ink-100 text-ink-500 ring-ink-200",
};

export default function OcpiPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageOcpi(viewer);
  const { run } = useAsyncAction();
  const { push } = useToast();

  const [parties, setParties] = useState<OcpiPartyRow[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuedToken, setIssuedToken] = useState<{ tokenA: string; discoveryUrl: string } | null>(null);

  useEffect(() => subscribeOcpiParties(setParties), []);

  async function submitInvite() {
    if (!actor || !businessName.trim()) return;
    setBusy(true);
    try {
      const { tokenA } = await inviteOcpiParty({ businessName: businessName.trim() }, actor);
      setIssuedToken({ tokenA, discoveryUrl: `${window.location.origin}/api/ocpi/versions` });
      setBusinessName("");
    } finally {
      setBusy(false);
    }
  }

  function closeInvite() {
    setInviteOpen(false);
    setIssuedToken(null);
  }

  return (
    <>
      <PageHeader
        title="OCPI Roaming"
        description="CPO-side OCPI 2.2.1 — publishes locations, tariffs, sessions and CDRs to registered roaming partners, and accepts START_SESSION/STOP_SESSION/UNLOCK_CONNECTOR commands from them (RESERVE_NOW isn't supported — reservations aren't a concept the OCPP layer has yet). Still no outbound push/webhooks."
        actions={canManage && <Button variant="primary" onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" /> Invite partner</Button>}
      />

      <Card title="How a partner connects" className="mb-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-600">
          <li>Invite them here — you get a one-time registration token to share with them directly (email, not this page).</li>
          <li>They call <code className="text-xs">GET /api/ocpi/versions</code> then <code className="text-xs">POST /api/ocpi/2.2.1/credentials</code> with that token.</li>
          <li>We store their credentials and hand back our own token — from then on they call the data endpoints (locations/tariffs/sessions/cdrs) with that token.</li>
        </ol>
      </Card>

      {parties === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : parties.length === 0 ? (
        <EmptyState icon={<Globe className="h-8 w-8" />} title="No roaming partners yet" />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Partner</th>
                <th className="th">Status</th>
                <th className="th">Partner URL</th>
                {canManage && <th className="th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {parties.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50">
                  <td className="td font-medium">{p.businessName || "(unnamed until registered)"}</td>
                  <td className="td"><Badge className={STATUS_COLOR[p.status]}>{p.status}</Badge></td>
                  <td className="td text-ink-600">{p.partnerUrl || "—"}</td>
                  {canManage && (
                    <td className="td text-right">
                      {p.status !== "REVOKED" && (
                        <Button size="sm" onClick={() => void run(() => revokeOcpiParty(p.id))}>Revoke</Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={inviteOpen}
        onClose={closeInvite}
        title={issuedToken ? "Registration token issued" : "Invite a roaming partner"}
        footer={issuedToken ? <Button onClick={closeInvite}>Done</Button> : (
          <>
            <Button variant="ghost" onClick={closeInvite}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!businessName.trim()} onClick={() => void submitInvite()}>Generate token</Button>
          </>
        )}
      >
        {issuedToken ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink-600">Share these with the partner directly — this token won't be shown again.</p>
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-xs text-ink-500">Discovery URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs">{issuedToken.discoveryUrl}</code>
                <button type="button" onClick={() => { void navigator.clipboard.writeText(issuedToken.discoveryUrl); push("Copied.", "success"); }}><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-xs text-ink-500">Registration token (token_a)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs">{issuedToken.tokenA}</code>
                <button type="button" onClick={() => { void navigator.clipboard.writeText(issuedToken.tokenA); push("Copied.", "success"); }}><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ) : (
          <Field label="Partner's business name" required>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. PartnerCharge Roaming" />
          </Field>
        )}
      </Modal>
    </>
  );
}
