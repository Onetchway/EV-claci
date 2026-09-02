"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, Checkbox, EmptyState, Field, Input, Select, Spinner, Textarea, useAsyncAction } from "@/components/ui";
import { getSiteVisit, updateSiteVisit } from "@/lib/db/site-visits";
import { listActiveTeamMembers } from "@/lib/db/team-members";
import type { SiteVisit, SiteVisitEngineer, TeamMember } from "@/lib/types";

export default function EditSiteVisitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { busy, run } = useAsyncAction();

  const [visit, setVisit] = useState<SiteVisit | null | undefined>(undefined);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [siteName, setSiteName] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [address, setAddress] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocContact, setPocContact] = useState("");
  const [pocEmail, setPocEmail] = useState("");
  const [chargerType, setChargerType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [engineerIds, setEngineerIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { void listActiveTeamMembers().then(setTeam); }, []);
  useEffect(() => {
    void getSiteVisit(id).then((row) => {
      setVisit(row);
      if (!row) return;
      setSiteName(row.siteName ?? "");
      setLocationLink(row.locationLink ?? "");
      setAddress(row.address ?? "");
      setPocName(row.pocName ?? "");
      setPocContact(row.pocContact ?? "");
      setPocEmail(row.pocEmail ?? "");
      setChargerType(row.chargerType ?? "");
      setScheduledDate(row.scheduledDate ? row.scheduledDate.toDate().toISOString().slice(0, 10) : "");
      setEngineerIds(row.assignedEngineers.map((e) => e.teamMemberId));
      setManagerId(row.managerId ?? "");
      setNotes(row.notes ?? "");
    });
  }, [id]);

  if (visit === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (visit === null) return <EmptyState title="Site visit not found" action={<Link href="/site-visits"><Button>Back to site visits</Button></Link>} />;

  function toggleEngineer(memberId: string) {
    setEngineerIds((ids) => (ids.includes(memberId) ? ids.filter((x) => x !== memberId) : [...ids, memberId]));
  }

  async function onSave() {
    await run(async () => {
      const assignedEngineers: SiteVisitEngineer[] = engineerIds
        .map((mid) => team.find((m) => m.id === mid))
        .filter((m): m is TeamMember => !!m)
        .map((m) => ({ teamMemberId: m.id, name: m.name }));
      const manager = team.find((m) => m.id === managerId);
      await updateSiteVisit(visit!, {
        siteName, locationLink, address, pocName, pocContact, pocEmail, chargerType,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        assignedEngineers, managerId: manager?.id ?? "", managerName: manager?.name ?? "", notes,
      }, actor);
      router.push(`/site-visits/${visit!.id}`);
    }, "Site visit updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit Site Visit</h1>
        <p className="text-sm text-ink-500">{visit.visitNo} — {visit.projectName}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Site details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site Name"><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></Field>
              <Field label="Charger Type"><Input value={chargerType} onChange={(e) => setChargerType(e.target.value)} /></Field>
              <Field label="Location Link" className="col-span-2"><Input value={locationLink} onChange={(e) => setLocationLink(e.target.value)} /></Field>
              <Field label="Address" className="col-span-2"><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
              <Field label="Scheduled Date"><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Point of contact">
            <div className="grid grid-cols-2 gap-3">
              <Field label="POC Name"><Input value={pocName} onChange={(e) => setPocName(e.target.value)} /></Field>
              <Field label="POC Contact"><Input value={pocContact} onChange={(e) => setPocContact(e.target.value)} /></Field>
              <Field label="POC Email" className="col-span-2"><Input type="email" value={pocEmail} onChange={(e) => setPocEmail(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Assign team">
            <Field label="Manager"><Select value={managerId} placeholder="Select manager…" options={team.map((m) => ({ value: m.id, label: m.name }))} onChange={(e) => setManagerId(e.target.value)} /></Field>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Engineers</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {team.map((m) => (
                  <Checkbox key={m.id} label={m.name} checked={engineerIds.includes(m.id)} onChange={() => toggleEngineer(m.id)} />
                ))}
              </div>
            </div>
          </Card>

          <Card title="Notes">
            <Field label="Notes / instructions for the visit"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd className="text-right">{visit.projectName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Engineers</dt><dd className="text-right">{engineerIds.length || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Manager</dt><dd className="text-right">{team.find((m) => m.id === managerId)?.name ?? "—"}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/site-visits/${visit!.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
