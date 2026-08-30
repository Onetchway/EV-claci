"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, Field, Modal, PageHeader, Select, StatCard, Textarea, useAsyncAction } from "@/components/ui";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, type DocumentCategory } from "@/lib/constants";
import { deleteDocument, subscribeDocuments, uploadDocument } from "@/lib/db/documents";
import { subscribeProjects } from "@/lib/db/projects";
import { canManageStages, canManageTasks } from "@/lib/permissions";
import type { NakjmDocument, Project } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DocumentsListPage() {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<NakjmDocument[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [category, setCategory] = useState<DocumentCategory | "ALL">("ALL");
  const [projectId, setProjectId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState("");
  const [docType, setDocType] = useState<DocumentCategory>("OTHER");
  const [notes, setNotes] = useState("");
  const { busy, run } = useAsyncAction();
  const canUpload = canManageTasks(viewer);
  const canDelete = canManageStages(viewer);

  useEffect(() => subscribeDocuments(setRows), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const projectName = (id?: string | null) => projects.find((p) => p.id === id)?.name ?? "—";

  const filtered = useMemo(
    () => (rows ?? []).filter((d) => (category === "ALL" || d.docType === category) && (!projectId || d.projectId === projectId)),
    [rows, category, projectId],
  );

  async function onUpload() {
    if (!file) return;
    await run(async () => {
      await uploadDocument({ file, projectId: uploadProjectId || null, docType, notes, actor });
      setShowForm(false); setFile(null); setUploadProjectId(""); setDocType("OTHER"); setNotes("");
    }, "Document uploaded.");
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Every drawing, approval, technical document and report, across every project."
        actions={canUpload ? <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Upload</Button> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Documents" value={rows?.length ?? 0} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Drawings" value={(rows ?? []).filter((d) => d.docType === "DRAWING").length} />
        <StatCard label="Approvals" value={(rows ?? []).filter((d) => d.docType === "APPROVAL").length} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={category} className="w-auto" options={[{ value: "ALL", label: "All categories" }, ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABEL[c] }))]} onChange={(e) => setCategory(e.target.value as DocumentCategory | "ALL")} />
        <Select value={projectId} className="w-auto" placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setProjectId(e.target.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents yet" description="Upload here, or from a project's Documents tab — either way it's filed against the project." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">File</th>
                <th className="th">Category</th>
                <th className="th">Project</th>
                <th className="th">Uploaded By</th>
                <th className="th">Date</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><a href={d.downloadUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{d.fileName}</a></td>
                  <td className="td"><Badge>{DOCUMENT_CATEGORY_LABEL[d.docType]}</Badge></td>
                  <td className="td">{d.projectId ? projectName(d.projectId) : "—"}</td>
                  <td className="td">{d.uploadedBy?.name || "—"}</td>
                  <td className="td">{formatDate(d.createdAt)}</td>
                  <td className="td text-right">
                    {canDelete && (
                      <button className="text-xs font-medium text-rose-600 hover:underline" onClick={() => void run(async () => { await deleteDocument(d, actor); }, "Document deleted.")} disabled={busy}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Upload Document"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onUpload()} loading={busy}>Upload</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="File" required className="col-span-2"><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" /></Field>
          <Field label="Project"><Select value={uploadProjectId} placeholder="Unfiled" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setUploadProjectId(e.target.value)} /></Field>
          <Field label="Category" required><Select value={docType} options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABEL[c] }))} onChange={(e) => setDocType(e.target.value as DocumentCategory)} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
