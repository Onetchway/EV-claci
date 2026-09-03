"use client";

import { LinkIcon, Plus, Unlink, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Input, Modal,
} from "@/components/ui";
import {
  subscribeChargerRegistry, subscribeChargerRegistryForLead, updateChargerRegistration,
  type ChargerRegistration,
} from "@/lib/db/charger-registry";
import { updateLead } from "@/lib/db/leads";
import type { Actor, Lead } from "@/lib/types";

/**
 * Links a charger already provisioned in Charger Management (CMS) to this
 * lead, and offers pulling that charger's location straight into the lead's
 * Site details — instead of a station's coordinates/label having to be
 * hand-typed twice once it exists on both sides.
 */
export function ChargingStationsPanel({
  lead, actor, canEdit,
}: {
  lead: Lead;
  actor: Actor;
  canEdit: boolean;
}) {
  const [linked, setLinked] = useState<ChargerRegistration[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => subscribeChargerRegistryForLead(lead.id, setLinked), [lead.id]);
  useEffect(() => {
    if (!pickerOpen) return;
    return subscribeChargerRegistry(setRegistry);
  }, [pickerOpen]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registry
      .filter((r) => !r.leadId || r.leadId === lead.id)
      .filter((r) => !q || r.label.toLowerCase().includes(q) || r.chargerId.toLowerCase().includes(q) || r.location.toLowerCase().includes(q))
      .slice(0, 30);
  }, [registry, search, lead.id]);

  async function link(reg: ChargerRegistration) {
    setBusyId(reg.id);
    try {
      await updateChargerRegistration(reg.id, { leadId: lead.id, leadCode: lead.code }, actor);
      // Fetch the site details in — only ever fills gaps, never overwrites what's already there.
      const patch: { site: Lead["site"] } = {
        site: {
          ...lead.site,
          locationName: lead.site?.locationName || reg.label,
          lat: lead.site?.lat ?? reg.lat ?? null,
          lng: lead.site?.lng ?? reg.lng ?? null,
        },
      };
      await updateLead(lead, patch, actor);
      setPickerOpen(false);
      setSearch("");
    } finally {
      setBusyId(null);
    }
  }

  async function unlink(reg: ChargerRegistration) {
    setBusyId(reg.id);
    try {
      await updateChargerRegistration(reg.id, { leadId: null, leadCode: null }, actor);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Charging stations"
      subtitle="Chargers in Charger Management (CMS) linked to this lead."
      actions={canEdit && (
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Link a charger
        </Button>
      )}
    >
      {linked.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-6 w-6" />}
          title="No stations linked yet"
          description="Link one already provisioned in Charger Management, or add it there once this deal is handed over."
        />
      ) : (
        <div className="divide-y divide-ink-100">
          {linked.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium text-ink-900">{r.label}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {r.chargerId} · {r.location}
                  {!r.active && <Badge className="ml-1.5 bg-ink-100 text-ink-500 ring-ink-200">Inactive</Badge>}
                </p>
              </div>
              {canEdit && (
                <Button size="sm" loading={busyId === r.id} onClick={() => void unlink(r)} title="Unlink from this lead">
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Link a charger"
        description="Search by name, charger ID, or site — picking one also fills in this lead's Site location/coordinates if they're still blank."
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chargers…"
          autoFocus
        />
        <div className="mt-3 max-h-80 divide-y divide-ink-100 overflow-y-auto scroll-thin">
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No matching chargers.</p>
          ) : (
            candidates.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void link(r)}
                disabled={busyId === r.id || r.leadId === lead.id}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div>
                  <p className="font-medium text-ink-900">{r.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{r.chargerId} · {r.location}</p>
                </div>
                {r.leadId === lead.id ? (
                  <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">Linked</Badge>
                ) : (
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                )}
              </button>
            ))
          )}
        </div>
      </Modal>
    </Card>
  );
}
