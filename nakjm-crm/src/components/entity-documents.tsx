"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Button, Card, Field, Modal, Select, Textarea, useAsyncAction } from "@/components/ui";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, type DocumentCategory } from "@/lib/constants";
import { deleteDocument, subscribeDocumentsForProject, uploadDocument } from "@/lib/db/documents";
import { canManageStages, canManageTasks } from "@/lib/permissions";
import type { NakjmDocument } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Documents filed against one specific record (a BOQ, PO, or Quotation) rather
 * than the project as a whole — e.g. the signed client PO scan on that PO, or
 * the BOQ source spreadsheet on that BOQ. Replaces the old standalone
 * top-level Documents page: attachments now live next to the record they
 * belong to.
 */
export function EntityDocuments({
  projectId,
  entityType,
  entityId,
  defaultDocType,
  title = "Documents",
}: {
  projectId: string;
  entityType: NonNullable<NakjmDocument["linkedEntityType"]>;
  entityId: string;
  defaultDocType: DocumentCategory;
  title?: string;
}) {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<NakjmDocument[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentCategory>(defaultDocType);
  const [notes, setNotes] = useState("");
  const { busy, run } = useAsyncAction();
  const canUpload = canManageTasks(viewer);
  const canDelete = canManageStages(viewer);

  useEffect(() => subscribeDocumentsForProject(projectId, setRows), [projectId]);

  const filtered = (rows ?? []).filter((d) => d.linkedEntityType === entityType && d.linkedEntityId === entityId);

  async function onUpload() {
    if (!file) return;
    await run(async () => {
      await uploadDocument({ file, projectId, linkedEntityType: entityType, linkedEntityId: entityId, docType, notes, actor });
      setShowForm(false); setFile(null); setDocType(defaultDocType); setNotes("");
    }, "Document uploaded.");
  }

  return (
    <Card
      title={title}
      actions={canUpload ? <Button variant="secondary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Attach</Button> : undefined}
    >
      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-400">No documents attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-brand-700 hover:underline">{d.fileName}</a>
                <p className="text-xs text-ink-500">{DOCUMENT_CATEGORY_LABEL[d.docType]} · {formatDate(d.createdAt)}{d.uploadedBy?.name ? ` · ${d.uploadedBy.name}` : ""}</p>
              </div>
              {canDelete && (
                <button className="shrink-0 text-ink-400 hover:text-rose-600" onClick={() => void run(async () => { await deleteDocument(d, actor); }, "Document deleted.")} disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={`Attach Document — ${title}`}
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onUpload()} loading={busy}>Upload</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="File" required className="col-span-2"><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" /></Field>
          <Field label="Category" required className="col-span-2"><Select value={docType} options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABEL[c] }))} onChange={(e) => setDocType(e.target.value as DocumentCategory)} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </Modal>
    </Card>
  );
}
