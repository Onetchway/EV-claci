"use client";

import {
  CheckCircle2, ExternalLink, FileText, Image as ImageIcon, Trash2, Upload, XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, Select,
  Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { DOC_KINDS, DOC_KIND_LABEL, type DocKind } from "@/lib/constants";
import {
  deleteDocument, kycStatus, reviewDocument, subscribeDocuments, uploadDocument,
  validateFile,
} from "@/lib/db/documents";
import { canDeleteDocument, canVerifyDocument, type Viewer } from "@/lib/permissions";
import type { Actor, Lead, LeadDocument } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
};

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({
  lead, actor, viewer, canEdit, onKyc,
}: {
  lead: Lead;
  actor: Actor;
  viewer: Viewer;
  canEdit: boolean;
  onKyc?: (complete: boolean) => void;
}) {
  const [docs, setDocs] = useState<LeadDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [kind, setKind] = useState<DocKind>("AADHAAR");
  const [refNumber, setRefNumber] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LeadDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  const mergedFromIds = (lead.mergedFrom ?? []).map((m) => m.id);
  useEffect(
    () => subscribeDocuments([lead.id, ...mergedFromIds], (rows) => { setDocs(rows); setLoading(false); }, () => setLoading(false)),
    [lead.id, mergedFromIds.join(",")],
  );

  const kyc = kycStatus(lead, docs);
  useEffect(() => onKyc?.(kyc.complete), [kyc.complete, onKyc]);

  function pickFile(f: File | null) {
    if (!f) return;
    const problem = validateFile(f);
    if (problem) { push(problem, "error"); return; }
    setFile(f);
  }

  async function doUpload() {
    if (!file) throw new Error("Choose a file to upload.");
    setProgress(0);
    try {
      await uploadDocument(lead, file, { kind, refNumber, note, onProgress: setProgress }, actor);
      setUploadOpen(false);
      setFile(null);
      setRefNumber("");
      setNote("");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="KYC checklist"
        subtitle={`${kyc.verified.length} of ${kyc.required.length} mandatory documents verified`}
        actions={
          canEdit && (
            <Button size="sm" variant="primary" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          )
        }
      >
        <ProgressBar pct={kyc.pct} />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {kyc.required.map((k) => {
            const verified = kyc.verified.includes(k);
            const present = kyc.present.includes(k);
            return (
              <li key={k} className="flex items-center gap-2 text-sm">
                {verified ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : present ? (
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-amber-400" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-ink-300" />
                )}
                <span className={cn(verified ? "text-ink-800" : "text-ink-500")}>
                  {DOC_KIND_LABEL[k]}
                  {present && !verified && <span className="ml-1 text-xs text-amber-600">(awaiting verification)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="All documents" subtitle={`${docs.length} file${docs.length === 1 ? "" : "s"} on record`}>
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-500">Loading…</p>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No documents uploaded"
            description="Aadhaar, PAN, load sanction letters and site photos all live here."
            action={canEdit ? <Button variant="primary" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload a document</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {docs.map((d) => {
              const isImage = d.contentType.startsWith("image/");
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{DOC_KIND_LABEL[d.kind]}</span>
                      <Badge className={STATUS_STYLE[d.status]}>{d.status}</Badge>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {d.fileName} · {fileSize(d.size)} · uploaded by {d.uploadedBy?.name} on {formatDateTime(d.uploadedAt)}
                      {d.refNumber && ` · ref ${d.refNumber}`}
                    </p>
                    {d.note && <p className="mt-0.5 text-xs italic text-ink-500">{d.note}</p>}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                    {canVerifyDocument(viewer) && d.status !== "VERIFIED" && (
                      <button
                        type="button"
                        onClick={() => void run(() => reviewDocument(lead, d, "VERIFIED", actor), "Document verified.")}
                        className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        Verify
                      </button>
                    )}
                    {canVerifyDocument(viewer) && d.status !== "REJECTED" && (
                      <button
                        type="button"
                        onClick={() => void run(() => reviewDocument(lead, d, "REJECTED", actor, "Illegible or incorrect document"), "Document rejected.")}
                        className="rounded px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    )}
                    {canDeleteDocument(viewer, d) && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(d)}
                        className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={uploadOpen}
        onClose={() => { if (progress === null) { setUploadOpen(false); setFile(null); } }}
        title="Upload document"
        description="PDF, JPG, PNG, WEBP or HEIC, up to 15 MB."
        footer={
          <>
            <Button onClick={() => { setUploadOpen(false); setFile(null); }} disabled={progress !== null}>Cancel</Button>
            <Button variant="primary" loading={busy || progress !== null} onClick={() => void run(doUpload, "Document uploaded.")}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Document type" required>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as DocKind)}
              options={DOC_KINDS.map((k) => ({ value: k, label: DOC_KIND_LABEL[k] }))}
            />
          </Field>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
              dragOver ? "border-brand-500 bg-brand-50" : "border-ink-300 hover:border-ink-400",
            )}
          >
            <Upload className="mx-auto h-6 w-6 text-ink-400" />
            <p className="mt-2 text-sm font-medium text-ink-800">
              {file ? file.name : "Drop a file here, or click to browse"}
            </p>
            {file && <p className="mt-0.5 text-xs text-ink-500">{fileSize(file.size)}</p>}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {progress !== null && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-500">
                <span>Uploading…</span><span>{progress}%</span>
              </div>
              <ProgressBar pct={progress} />
            </div>
          )}

          <Field label="Document number" hint="Aadhaar last 4, PAN, sanction letter number…">
            <Input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} />
          </Field>
          <Field label="Note">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this document?"
        description="The file is removed from storage and the deletion is logged."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (confirmDelete) await deleteDocument(lead, confirmDelete, actor);
                  setConfirmDelete(null);
                }, "Document deleted.")
              }
            >
              Delete
            </Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm text-ink-700">
            {DOC_KIND_LABEL[confirmDelete.kind]} — {confirmDelete.fileName}
          </p>
        )}
      </Modal>
    </div>
  );
}
