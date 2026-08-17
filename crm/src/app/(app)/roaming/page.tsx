"use client";

import { useEffect, useState } from "react";
import { Globe, Play, Plus, Square } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useToast,
} from "@/components/ui";
import {
  pullRoamingLocations, registerRoamingPartner, startRoamingSession, stopRoamingSession,
  subscribeRoamingPartners, subscribeRoamingSessions, type RoamingPartnerRow, type RoamingSessionRow,
} from "@/lib/db/ocpi-roaming";
import { subscribeRfidTokens } from "@/lib/db/rfid";
import { canManageOcpi } from "@/lib/permissions";
import type { RfidToken } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  REGISTERED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REVOKED: "bg-ink-100 text-ink-500 ring-ink-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  COMPLETED: "bg-ink-100 text-ink-600 ring-ink-200",
};

interface PartnerLocation {
  id: string;
  name?: string;
  address?: string;
  evses?: Array<{ uid: string; evse_id?: string; status?: string }>;
}

export default function RoamingPage() {
  const viewer = useViewer();
  const canManage = canManageOcpi(viewer);
  const { push } = useToast();

  const [partners, setPartners] = useState<RoamingPartnerRow[] | null>(null);
  const [sessions, setSessions] = useState<RoamingSessionRow[] | null>(null);
  const [tokens, setTokens] = useState<RfidToken[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [versionsUrl, setVersionsUrl] = useState("");
  const [theirTokenA, setTheirTokenA] = useState("");
  const [busy, setBusy] = useState(false);

  const [startFor, setStartFor] = useState<RoamingPartnerRow | null>(null);
  const [locations, setLocations] = useState<PartnerLocation[] | null>(null);
  const [locationId, setLocationId] = useState("");
  const [evseUid, setEvseUid] = useState("");
  const [idToken, setIdToken] = useState("");

  useEffect(() => subscribeRoamingPartners(setPartners), []);
  useEffect(() => subscribeRoamingSessions(setSessions), []);
  useEffect(() => subscribeRfidTokens(setTokens), []);

  if (!canManage) {
    return <EmptyState title="Restricted" description="CPO roaming is limited to Super Admin and Admin roles." />;
  }

  async function submitAdd() {
    if (!businessName.trim() || !versionsUrl.trim() || !theirTokenA.trim()) return;
    setBusy(true);
    try {
      await registerRoamingPartner({ businessName: businessName.trim(), versionsUrl: versionsUrl.trim(), theirTokenA: theirTokenA.trim() });
      push("Registered with partner.", "success");
      setAddOpen(false);
      setBusinessName(""); setVersionsUrl(""); setTheirTokenA("");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function openStart(partner: RoamingPartnerRow) {
    setStartFor(partner);
    setLocations(null);
    setLocationId(""); setEvseUid(""); setIdToken("");
    try {
      const raw = await pullRoamingLocations(partner.id);
      setLocations(raw as PartnerLocation[]);
    } catch (e) {
      push((e as Error).message, "error");
      setLocations([]);
    }
  }

  async function submitStart() {
    if (!startFor || !locationId || !idToken) return;
    setBusy(true);
    try {
      const res = await startRoamingSession(startFor.id, { locationId, evseUid: evseUid || undefined, idToken });
      push(`Sent — partner responded ${res.syncResult}.`, res.syncResult === "ACCEPTED" ? "success" : "error");
      setStartFor(null);
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop(session: RoamingSessionRow) {
    if (!window.confirm(`Send STOP_SESSION for ${session.id} to ${session.partnerName}?`)) return;
    try {
      const res = await stopRoamingSession(session.partnerId, session.id);
      push(`Sent — partner responded ${res.syncResult}.`, res.syncResult === "ACCEPTED" ? "success" : "error");
    } catch (e) {
      push((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader
        title="CPO Roaming (Outbound)"
        description="This app as an eMSP client of another CPO — register with a partner network, browse their chargers, and start/stop sessions on their hardware using our own RFID tokens. The mirror of OCPI Roaming, which handles partners consuming our network."
        actions={<Button variant="primary" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add partner network</Button>}
      />

      <Card title="Roaming partners" className="mb-4">
        {partners === null ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : partners.length === 0 ? (
          <EmptyState icon={<Globe className="h-8 w-8" />} title="No outbound roaming partners yet" description="Add a partner CPO's OCPI discovery URL and the one-time token they issued you." />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Partner</th>
                  <th className="th">Status</th>
                  <th className="th">Versions URL</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {partners.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{p.businessName}</td>
                    <td className="td"><Badge className={STATUS_COLOR[p.status]}>{p.status}</Badge></td>
                    <td className="td text-ink-600">{p.versionsUrl}</td>
                    <td className="td text-right">
                      {p.status === "REGISTERED" && (
                        <Button size="sm" onClick={() => void openStart(p)}><Play className="h-3.5 w-3.5" /> Start session</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Roaming sessions" subtitle="Sessions our own users opened on a partner's network — populated once the partner pushes a Session update to our eMSP receiver endpoint.">
        {sessions === null ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={<Globe className="h-8 w-8" />} title="No roaming sessions yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Session</th>
                  <th className="th">Partner</th>
                  <th className="th">Status</th>
                  <th className="th text-right">kWh</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="td font-mono text-xs">{s.id}</td>
                    <td className="td">{s.partnerName}</td>
                    <td className="td"><Badge className={STATUS_COLOR[s.status] ?? STATUS_COLOR.COMPLETED}>{s.status}</Badge></td>
                    <td className="td text-right tabular-nums">{s.kwh?.toFixed(2) ?? "—"}</td>
                    <td className="td text-right">
                      {s.status === "ACTIVE" && (
                        <Button size="sm" onClick={() => void handleStop(s)}><Square className="h-3.5 w-3.5" /> Stop</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a roaming partner network"
        description="Their operator gives you a discovery (versions) URL and a one-time token out of band."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!businessName.trim() || !versionsUrl.trim() || !theirTokenA.trim()} onClick={() => void submitAdd()}>
              Register
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Partner's business name" required><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></Field>
          <Field label="Their OCPI versions URL" required><Input value={versionsUrl} onChange={(e) => setVersionsUrl(e.target.value)} placeholder="https://partner.example.com/ocpi/versions" /></Field>
          <Field label="Their one-time token (token_a)" required><Input value={theirTokenA} onChange={(e) => setTheirTokenA(e.target.value)} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!startFor}
        onClose={() => setStartFor(null)}
        title={`Start a session on ${startFor?.businessName ?? ""}`}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setStartFor(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!locationId || !idToken} onClick={() => void submitStart()}>Send START_SESSION</Button>
          </>
        )}
      >
        {locations === null ? (
          <div className="flex justify-center py-8 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : (
          <div className="grid gap-4">
            <Field label="Partner location" required>
              <Select
                value={locationId}
                onChange={(e) => { setLocationId(e.target.value); setEvseUid(""); }}
                options={locations.map((l) => ({ value: l.id, label: l.name ? `${l.name} — ${l.address ?? ""}` : l.id }))}
                placeholder="Select a location"
              />
            </Field>
            {locationId && (
              <Field label="EVSE (optional)">
                <Select
                  value={evseUid}
                  onChange={(e) => setEvseUid(e.target.value)}
                  options={(locations.find((l) => l.id === locationId)?.evses ?? []).map((e) => ({ value: e.uid, label: `${e.evse_id ?? e.uid} (${e.status ?? "unknown"})` }))}
                  placeholder="Any available EVSE"
                />
              </Field>
            )}
            <Field label="RFID token to authorize as" required>
              <Select
                value={idToken}
                onChange={(e) => setIdToken(e.target.value)}
                options={tokens.map((t) => ({ value: t.idToken, label: `${t.label} (${t.idToken})` }))}
                placeholder="Select a token"
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
