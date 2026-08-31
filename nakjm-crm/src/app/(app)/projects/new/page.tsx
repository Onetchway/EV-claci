"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Sparkles, Upload } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { PROJECT_STATUSES, PROJECT_TYPES, statusMeta, type ProjectStatus, type ProjectType } from "@/lib/constants";
import { listActiveClients } from "@/lib/db/clients";
import { uploadDocument } from "@/lib/db/documents";
import { createProject, getProject } from "@/lib/db/projects";
import { linkTenderToProject } from "@/lib/db/tenders";
import { listActiveTeamMembers } from "@/lib/db/team-members";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { Client, Project, TeamMember } from "@/lib/types";

const EMPTY = {
  name: "", clientId: "", billingGstin: "", projectType: "EV_CHARGING_STATION" as ProjectType, city: "", state: "", address: "",
  capacityKw: "", status: "LEAD" as ProjectStatus, budgetAmount: "0", contractValue: "0",
  startDate: "", targetEndDate: "", projectManagerId: "", clientRequirements: "",
};

export default function NewProjectPage() {
  return (
    <Suspense fallback={null}>
      <NewProjectForm />
    </Suspense>
  );
}

function NewProjectForm() {
  const router = useRouter();
  const actor = useActor();
  const { busy, run } = useAsyncAction();
  const { push } = useToast();
  const params = useSearchParams();
  const tenderId = params.get("tenderId");
  const parentProjectId = params.get("parentProjectId");

  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [unmatchedClientName, setUnmatchedClientName] = useState<string | null>(null);

  useEffect(() => { void listActiveClients().then(setClients); void listActiveTeamMembers().then(setTeam); }, []);

  useEffect(() => {
    const clientId = params.get("clientId");
    const name = params.get("name");
    const contractValue = params.get("contractValue");
    if (clientId || name || contractValue) {
      setForm((f) => ({
        ...f,
        clientId: clientId ?? f.clientId,
        name: name ?? f.name,
        contractValue: contractValue ?? f.contractValue,
      }));
    }
    if (parentProjectId) void getProject(parentProjectId).then(setParentProject);
  }, [params, parentProjectId]);

  async function onCreate() {
    if (!form.name.trim() || !form.clientId) return;
    await run(async () => {
      const client = clients.find((c) => c.id === form.clientId);
      let sourceDocumentId: string | null = null;
      if (poFile) {
        const doc = await uploadDocument({ file: poFile, docType: "CLIENT_PO", actor });
        sourceDocumentId = doc.id;
      }
      const pm = team.find((t) => t.id === form.projectManagerId);
      const project = await createProject(
        {
          name: form.name,
          clientId: form.clientId,
          clientName: client?.name ?? "",
          projectManagerId: pm?.id ?? null,
          projectManagerName: pm?.name ?? null,
          projectType: form.projectType,
          site: { address: form.address, city: form.city, state: form.state },
          capacityKw: form.capacityKw ? Number(form.capacityKw) : null,
          status: form.status,
          startDate: form.startDate ? new Date(form.startDate) : null,
          targetEndDate: form.targetEndDate ? new Date(form.targetEndDate) : null,
          budgetAmount: Number(form.budgetAmount) || 0,
          contractValue: Number(form.contractValue) || 0,
          clientRequirements: form.clientRequirements,
          billingGstin: form.billingGstin || null,
          billingState: client?.gstRegistrations?.find((r) => r.gstin === form.billingGstin)?.state ?? null,
          sourceDocumentId,
          tenderId: tenderId || null,
          parentProjectId: parentProjectId || null,
          parentProjectCode: parentProject?.code ?? null,
        },
        actor,
      );
      if (tenderId) await linkTenderToProject(tenderId, project.id);
      router.push(`/projects/${project.id}`);
    }, "Project created.");
  }

  async function onExtract(file: File) {
    setPoFile(file);
    setUnmatchedClientName(null);
    setExtracting(true);
    try {
      const current = getFirebaseAuth().currentUser;
      if (!current) throw new Error("Your session expired. Sign in again.");
      const token = await current.getIdToken();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/extract-po", { method: "POST", headers: { authorization: `Bearer ${token}` }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Extraction failed (${res.status}).`);

      const matchedClient = data.clientName
        ? clients.find((c) => c.name.toLowerCase().includes(String(data.clientName).toLowerCase()) || String(data.clientName).toLowerCase().includes(c.name.toLowerCase()))
        : undefined;
      if (data.clientName && !matchedClient) setUnmatchedClientName(data.clientName);

      setForm((f) => ({
        ...f,
        name: data.projectName || f.name,
        clientId: matchedClient?.id ?? f.clientId,
        projectType: data.projectType ?? f.projectType,
        contractValue: data.contractValue != null ? String(data.contractValue) : f.contractValue,
        startDate: data.startDate || f.startDate,
        targetEndDate: data.completionDate || f.targetEndDate,
        address: data.location || f.address,
      }));
      push(
        data.scopeOfWork ? `Extracted — scope: ${data.scopeOfWork}` : "Extracted — review the fields below before creating the project.",
        "success",
      );
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setExtracting(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === form.clientId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={parentProject ? `New Sub-project of ${parentProject.code}` : "New Project"}
        description={
          parentProject
            ? `Under ${parentProject.name} — inherits nothing automatically, fill in this sub-project's own scope.`
            : "Start from scratch, or bootstrap it from a client PO / work order."
        }
      />
      {(parentProject || tenderId) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {parentProject && <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">Parent project: {parentProject.code}</Badge>}
          {tenderId && <Badge className="bg-violet-50 text-violet-700 ring-violet-200">Linked to a tender</Badge>}
        </div>
      )}
      <Card>
        <div className="mb-5 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-800">
            <Sparkles className="h-4 w-4" />
            {extracting ? "Reading document…" : "Auto-fill from a client PO / Work Order (PDF or photo)"}
            <input
              type="file" className="hidden" accept=".pdf,image/*" disabled={extracting}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onExtract(f); }}
            />
          </label>
          <p className="mt-1 text-xs text-brand-700">Upload the client's PO/WO and the fields below get filled in automatically — review them before creating the project.</p>
          {unmatchedClientName && (
            <p className="mt-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs text-amber-800">
              Extracted client "{unmatchedClientName}" doesn't match an existing client — pick one below, or <a href="/clients" className="underline">create it first</a>.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Client" required>
            <Select
              value={form.clientId}
              placeholder="Select client…"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(e) => {
                const client = clients.find((c) => c.id === e.target.value);
                setForm((f) => ({ ...f, clientId: e.target.value, billingGstin: client?.gstRegistrations?.length === 1 ? client.gstRegistrations[0].gstin : "" }));
              }}
            />
          </Field>
          {(selectedClient?.gstRegistrations?.length ?? 0) > 0 && (
            <Field label="Billing GSTIN" required hint="Which of the client's state registrations this project bills under.">
              <Select
                value={form.billingGstin}
                placeholder="Select registration…"
                options={(selectedClient!.gstRegistrations ?? []).map((r) => ({ value: r.gstin, label: `${r.state} — ${r.gstin}` }))}
                onChange={(e) => setForm((f) => ({ ...f, billingGstin: e.target.value }))}
              />
            </Field>
          )}
          <Field label="Project Type">
            <Select
              value={form.projectType}
              options={PROJECT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
              onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value as ProjectType }))}
            />
          </Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Field>
          <Field label="State"><Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></Field>
          <Field label="Capacity (kW)"><Input type="number" value={form.capacityKw} onChange={(e) => setForm((f) => ({ ...f, capacityKw: e.target.value }))} /></Field>
          <Field label="Status">
            <Select
              value={form.status}
              options={PROJECT_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }))}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
            />
          </Field>
          <Field label="Project Manager">
            <Select
              value={form.projectManagerId}
              placeholder="Unassigned"
              options={team.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(e) => setForm((f) => ({ ...f, projectManagerId: e.target.value }))}
            />
          </Field>
          <Field label="Budget (₹)"><Input type="number" value={form.budgetAmount} onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))} /></Field>
          <Field label="Contract Value (₹)"><Input type="number" value={form.contractValue} onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))} /></Field>
          <Field label="Start Date"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
          <Field label="Target End Date"><Input type="date" value={form.targetEndDate} onChange={(e) => setForm((f) => ({ ...f, targetEndDate: e.target.value }))} /></Field>
          <Field label="Site Address" className="col-span-2"><Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Client Requirements" className="col-span-2" hint="What the client asked for — shown on the project's stage-wise client report.">
            <Textarea value={form.clientRequirements} onChange={(e) => setForm((f) => ({ ...f, clientRequirements: e.target.value }))} />
          </Field>
          <Field
            label="Client PO / Work Order"
            hint="Optional — attach the document this project is being created from."
            className="col-span-2"
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
              <Upload className="h-4 w-4" />
              {poFile ? poFile.name : "Choose a file…"}
              <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => void onCreate()} loading={busy}>Create Project</Button>
        </div>
      </Card>
    </div>
  );
}
