"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, Checkbox, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { createSiteVisit } from "@/lib/db/site-visits";
import { subscribeProjects } from "@/lib/db/projects";
import { listActiveTeamMembers } from "@/lib/db/team-members";
import type { Project, SiteVisitEngineer, TeamMember } from "@/lib/types";

export default function NewSiteVisitPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewSiteVisitForm />
    </Suspense>
  );
}

function NewSiteVisitForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
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

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);
  useEffect(() => { void listActiveTeamMembers().then(setTeam); }, []);

  const project = projects.find((p) => p.id === projectId);

  function toggleEngineer(id: string) {
    setEngineerIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function onCreate() {
    if (!projectId || !project) {
      push("Project is required.", "error");
      return;
    }
    await run(async () => {
      const assignedEngineers: SiteVisitEngineer[] = engineerIds
        .map((id) => team.find((m) => m.id === id))
        .filter((m): m is TeamMember => !!m)
        .map((m) => ({ teamMemberId: m.id, name: m.name }));
      const manager = team.find((m) => m.id === managerId);
      const visit = await createSiteVisit({
        projectId, projectName: project.name, siteName, locationLink, address,
        pocName, pocContact, pocEmail, chargerType,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        assignedEngineers, managerId: manager?.id, managerName: manager?.name, notes,
      }, actor);
      router.push(`/site-visits/${visit.id}`);
    }, "Site visit scheduled.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New Site Visit</h1>
        <p className="text-sm text-ink-500">Schedule an engineer to survey a client's project site.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Site details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project" required className="col-span-2">
                <Select value={projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setProjectId(e.target.value)} />
              </Field>
              <Field label="Site Name"><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Station 1" /></Field>
              <Field label="Charger Type"><Input value={chargerType} onChange={(e) => setChargerType(e.target.value)} placeholder="e.g. 60kW DC Fast Charger" /></Field>
              <Field label="Location Link" className="col-span-2" hint="Google Maps link or similar."><Input value={locationLink} onChange={(e) => setLocationLink(e.target.value)} placeholder="https://maps.google.com/…" /></Field>
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
              {team.length === 0 ? (
                <p className="text-sm text-ink-400">No active team members found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {team.map((m) => (
                    <Checkbox key={m.id} label={m.name} checked={engineerIds.includes(m.id)} onChange={() => toggleEngineer(m.id)} />
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Notes">
            <Field label="Notes / instructions for the visit"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd className="text-right">{project?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Engineers</dt><dd className="text-right">{engineerIds.length || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Manager</dt><dd className="text-right">{team.find((m) => m.id === managerId)?.name ?? "—"}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onCreate()} loading={busy}>Schedule Site Visit</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push("/site-visits")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
