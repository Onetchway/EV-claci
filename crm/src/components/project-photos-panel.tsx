"use client";

import { ExternalLink, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Button, Card, EmptyState, Field, Input, Modal, ProgressBar, Select, useAsyncAction, useToast,
} from "@/components/ui";
import { WORKSTREAMS, WORKSTREAM_LABEL, type Workstream } from "@/lib/constants";
import {
  deleteProjectPhoto, subscribeProjectPhotos, uploadProjectPhoto, validatePhotoFile,
} from "@/lib/db/project-photos";
import type { Actor, Project, ProjectPhoto } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function ProjectPhotosPanel({
  project, actor, canEdit, className,
}: {
  project: Project;
  actor: Actor;
  canEdit: boolean;
  className?: string;
}) {
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [workstream, setWorkstream] = useState<Workstream | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  useEffect(
    () => subscribeProjectPhotos(project.id, (rows) => { setPhotos(rows); setLoading(false); }, () => setLoading(false)),
    [project.id],
  );

  function pickFile(f: File | null) {
    if (!f) return;
    const problem = validatePhotoFile(f);
    if (problem) { push(problem, "error"); return; }
    setFile(f);
  }

  async function doUpload() {
    if (!file) throw new Error("Choose a photo to upload.");
    setProgress(0);
    try {
      await uploadProjectPhoto(project, file, { caption, workstream: workstream || null, onProgress: setProgress }, actor);
      setUploadOpen(false);
      setFile(null);
      setCaption("");
      setWorkstream("");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card
      title="Site photos"
      subtitle="Progress photos the project team uploads — also visible, read-only, to the investor in their portal."
      className={className}
      actions={
        canEdit && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Upload photo
          </Button>
        )
      }
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
      ) : photos.length === 0 ? (
        <EmptyState title="No photos yet" description="Upload progress photos as work happens on site." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-ink-200">
              <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-square bg-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || "Site photo"} className="h-full w-full object-cover" />
              </a>
              <div className="p-2">
                {p.workstream && <p className="text-[11px] font-medium text-brand-700">{WORKSTREAM_LABEL[p.workstream]}</p>}
                {p.caption && <p className="truncate text-xs text-ink-700" title={p.caption}>{p.caption}</p>}
                <p className="text-[11px] text-ink-400">{formatDateTime(p.uploadedAt)}</p>
              </div>
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-white/90 p-1 text-ink-600 shadow hover:bg-white"
                  title="Open full size"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {canEdit && (
                  <button
                    onClick={() => setConfirmDelete(p)}
                    className="rounded bg-white/90 p-1 text-rose-600 shadow hover:bg-white"
                    title="Delete photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); setFile(null); }}
        title="Upload a site photo"
        footer={
          <>
            <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!file} onClick={() => void run(doUpload, "Photo uploaded.")}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Photo" required>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="input"
            />
            {file && <p className="mt-1 text-xs text-ink-500">{file.name}</p>}
            {progress !== null && <ProgressBar pct={progress} className="mt-2" />}
          </Field>
          <Field label="Workstream" hint="Optional — tags which part of the build this documents.">
            <Select
              placeholder="Not tagged"
              value={workstream}
              onChange={(e) => setWorkstream(e.target.value as Workstream | "")}
              options={WORKSTREAMS.map((w) => ({ value: w, label: WORKSTREAM_LABEL[w] }))}
            />
          </Field>
          <Field label="Caption">
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Canopy installed" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this photo?"
        description="This can't be undone."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!confirmDelete) return;
                  await deleteProjectPhoto(project, confirmDelete);
                  setConfirmDelete(null);
                }, "Photo deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm text-ink-700">{confirmDelete.caption || "This photo"} will be permanently removed.</p>
        )}
      </Modal>
    </Card>
  );
}
