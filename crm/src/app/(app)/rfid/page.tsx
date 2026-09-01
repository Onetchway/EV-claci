"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { addRfidToken, deleteRfidToken, setRfidTokenScope, setRfidTokenStatus, subscribeRfidTokens } from "@/lib/db/rfid";
import { subscribeZones } from "@/lib/db/zones";
import { canManageRfid } from "@/lib/permissions";
import type { RfidToken, Zone } from "@/lib/types";

/**
 * Previously embedded inside Charger Management — split out to its own
 * section since RFID/ID-token allow-listing is its own concern (who can
 * charge, at which chargers/sites) rather than a charger-hardware
 * management task. No behavior changes from the embedded version, just a
 * dedicated page.
 */
export default function RfidPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const { run, busy } = useAsyncAction();

  const [rfidTokens, setRfidTokens] = useState<RfidToken[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);

  const [newTokenId, setNewTokenId] = useState("");
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenScope, setNewTokenScope] = useState<"GLOBAL" | "ZONE" | "CHARGER">("GLOBAL");
  const [newTokenZoneId, setNewTokenZoneId] = useState("");
  const [newTokenChargerId, setNewTokenChargerId] = useState("");
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);

  useEffect(() => subscribeRfidTokens(setRfidTokens), []);
  useEffect(() => subscribeZones(setZones), []);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);

  const zoneName = new Map(zones.map((z) => [z.id, z.name]));

  async function addToken() {
    if (!actor || !newTokenId.trim() || !newTokenLabel.trim()) return;
    await run(async () => {
      await addRfidToken(newTokenId, newTokenLabel, actor, {
        activationScope: newTokenScope,
        scopeZoneId: newTokenScope === "ZONE" ? newTokenZoneId || null : null,
        scopeChargerIds: newTokenScope === "CHARGER" && newTokenChargerId ? [newTokenChargerId] : [],
      });
      setNewTokenId("");
      setNewTokenLabel("");
      setNewTokenScope("GLOBAL");
      setNewTokenZoneId("");
      setNewTokenChargerId("");
    }, "RFID token added.");
  }

  return (
    <>
      <PageHeader
        title="RFID Tokens"
        description="Which tags/cards are allowed to start a session, and where — any charger, one site, or one specific charger."
      />

      <Card
        subtitle={rfidTokens.length === 0
          ? "No tokens registered — every tag is currently accepted (open mode)."
          : "Allow-list enforced — only ACTIVE tokens below can start a session."}
      >
        {canManageRfid(viewer) && (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Field label="Tag ID">
              <Input value={newTokenId} onChange={(e) => setNewTokenId(e.target.value)} placeholder="e.g. 04A1B2C3" />
            </Field>
            <Field label="Label">
              <Input value={newTokenLabel} onChange={(e) => setNewTokenLabel(e.target.value)} placeholder="e.g. Driver name / card #" />
            </Field>
            <Field label="Activation scope">
              <Select
                value={newTokenScope}
                onChange={(e) => setNewTokenScope(e.target.value as "GLOBAL" | "ZONE" | "CHARGER")}
                options={[
                  { value: "GLOBAL", label: "Any charger" },
                  { value: "ZONE", label: "Site only" },
                  { value: "CHARGER", label: "Specific charger" },
                ]}
              />
            </Field>
            {newTokenScope === "ZONE" && (
              <Field label="Site">
                <Select
                  value={newTokenZoneId}
                  onChange={(e) => setNewTokenZoneId(e.target.value)}
                  options={[{ value: "", label: "Select site…" }, ...zones.map((z) => ({ value: z.id, label: z.name }))]}
                />
              </Field>
            )}
            {newTokenScope === "CHARGER" && (
              <Field label="Charger">
                <Select
                  value={newTokenChargerId}
                  onChange={(e) => setNewTokenChargerId(e.target.value)}
                  options={[{ value: "", label: "Select charger…" }, ...registry.map((r) => ({ value: r.chargerId, label: r.label }))]}
                />
              </Field>
            )}
            <Button
              loading={busy}
              disabled={
                !newTokenId.trim()
                || !newTokenLabel.trim()
                || (newTokenScope === "ZONE" && !newTokenZoneId)
                || (newTokenScope === "CHARGER" && !newTokenChargerId)
              }
              onClick={() => void addToken()}
            >
              <Plus className="h-4 w-4" /> Add token
            </Button>
          </div>
        )}
        {rfidTokens.length === 0 ? (
          <EmptyState title="Nothing registered yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Tag ID</th><th className="th">Label</th><th className="th">Status</th><th className="th">Scope</th>{canManageRfid(viewer) && <th className="th text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rfidTokens.map((t) => {
                  const scope = t.activationScope ?? "GLOBAL";
                  const scopeLabel = scope === "ZONE"
                    ? `Site: ${t.scopeZoneId ? zoneName.get(t.scopeZoneId) ?? "—" : "—"}`
                    : scope === "CHARGER"
                      ? `Charger: ${(t.scopeChargerIds ?? [])[0] ?? "—"}`
                      : "Any charger";
                  return (
                    <tr key={t.id} className="hover:bg-ink-50">
                      <td className="td font-mono text-xs">{t.idToken}</td>
                      <td className="td">{t.label}</td>
                      <td className="td">
                        <Badge className={t.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="td">
                        {editingScopeId === t.id ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Select
                              value={scope}
                              onChange={(e) => {
                                const nextScope = e.target.value as "GLOBAL" | "ZONE" | "CHARGER";
                                void run(() => setRfidTokenScope(t.id, {
                                  activationScope: nextScope,
                                  scopeZoneId: nextScope === "ZONE" ? t.scopeZoneId ?? null : null,
                                  scopeChargerIds: nextScope === "CHARGER" ? t.scopeChargerIds ?? [] : [],
                                }));
                              }}
                              options={[
                                { value: "GLOBAL", label: "Any charger" },
                                { value: "ZONE", label: "Site only" },
                                { value: "CHARGER", label: "Specific charger" },
                              ]}
                            />
                            {scope === "ZONE" && (
                              <Select
                                value={t.scopeZoneId ?? ""}
                                onChange={(e) => void run(() => setRfidTokenScope(t.id, {
                                  activationScope: "ZONE", scopeZoneId: e.target.value || null, scopeChargerIds: [],
                                }))}
                                options={[{ value: "", label: "Select site…" }, ...zones.map((z) => ({ value: z.id, label: z.name }))]}
                              />
                            )}
                            {scope === "CHARGER" && (
                              <Select
                                value={(t.scopeChargerIds ?? [])[0] ?? ""}
                                onChange={(e) => void run(() => setRfidTokenScope(t.id, {
                                  activationScope: "CHARGER", scopeZoneId: null, scopeChargerIds: e.target.value ? [e.target.value] : [],
                                }))}
                                options={[{ value: "", label: "Select charger…" }, ...registry.map((r) => ({ value: r.chargerId, label: r.label }))]}
                              />
                            )}
                            <Button size="sm" onClick={() => setEditingScopeId(null)}>Done</Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-left text-xs text-ink-600 underline decoration-dotted disabled:no-underline disabled:cursor-default"
                            disabled={!canManageRfid(viewer)}
                            onClick={() => canManageRfid(viewer) && setEditingScopeId(t.id)}
                          >
                            {scopeLabel}
                          </button>
                        )}
                      </td>
                      {canManageRfid(viewer) && (
                        <td className="td text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => void run(() => setRfidTokenStatus(t.id, t.status === "ACTIVE" ? "BLOCKED" : "ACTIVE"))}
                            >
                              {t.status === "ACTIVE" ? "Block" : "Unblock"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!window.confirm(`Delete tag ${t.label}? This can't be undone.`)) return;
                                void run(() => deleteRfidToken(t.id), "Token deleted.");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
