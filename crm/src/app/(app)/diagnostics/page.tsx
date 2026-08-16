"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  addDiagnosticCode, deleteDiagnosticCode, DIAGNOSTIC_SEVERITY_LABEL, subscribeDiagnosticCodes, updateDiagnosticCode,
  type DiagnosticCodeDraft,
} from "@/lib/db/diagnostics";
import { canManageDiagnostics } from "@/lib/permissions";
import type { DiagnosticCode, DiagnosticSeverity } from "@/lib/types";

const SEVERITY_STYLE: Record<DiagnosticSeverity, string> = {
  INFO: "bg-sky-100 text-sky-800 ring-sky-200",
  WARNING: "bg-amber-100 text-amber-800 ring-amber-200",
  CRITICAL: "bg-rose-100 text-rose-800 ring-rose-200",
};

const blankDraft: DiagnosticCodeDraft = {
  code: "", vendor: "", title: "", description: "", likelyCause: "", recommendedAction: "", severity: "WARNING",
};

export default function DiagnosticsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageDiagnostics(viewer);
  const { run, busy } = useAsyncAction();

  const [codes, setCodes] = useState<DiagnosticCode[] | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DiagnosticCodeDraft>(blankDraft);

  useEffect(() => subscribeDiagnosticCodes(setCodes), []);

  const filtered = useMemo(() => {
    if (!codes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter((c) => [c.code, c.vendor, c.title, c.description, c.likelyCause, c.recommendedAction]
      .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [codes, search]);

  function openNew() {
    setEditingId(null);
    setDraft(blankDraft);
    setOpen(true);
  }

  function openEdit(c: DiagnosticCode) {
    setEditingId(c.id);
    setDraft({
      code: c.code, vendor: c.vendor, title: c.title, description: c.description ?? "",
      likelyCause: c.likelyCause ?? "", recommendedAction: c.recommendedAction ?? "", severity: c.severity,
    });
    setOpen(true);
  }

  async function submit() {
    if (!actor || !draft.code.trim() || !draft.vendor.trim() || !draft.title.trim()) return;
    await run(async () => {
      if (editingId) await updateDiagnosticCode(editingId, draft);
      else await addDiagnosticCode(draft, actor);
      setOpen(false);
    }, editingId ? "Diagnostic code updated." : "Diagnostic code added.");
  }

  return (
    <>
      <PageHeader
        title="Diagnostic Knowledge Base"
        description="Searchable OEM fault-code reference for NOC/support triage — what a code means, its likely cause, and the recommended fix."
        actions={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New entry</Button>}
      />

      <Card className="mb-4">
        <Field label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, vendor, title, cause…"
            />
          </div>
        </Field>
      </Card>

      {codes === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title={codes.length === 0 ? "No diagnostic entries yet" : "No matches"}
          description={codes.length === 0 ? "Add OEM fault codes so support can look them up during a ticket." : undefined}
          action={canManage && codes.length === 0 && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New entry</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{c.code}</span>
                    <Badge className="bg-ink-100 text-ink-600 ring-ink-200">{c.vendor}</Badge>
                    <Badge className={SEVERITY_STYLE[c.severity]}>{DIAGNOSTIC_SEVERITY_LABEL[c.severity]}</Badge>
                  </div>
                  <p className="mt-1 font-medium">{c.title}</p>
                  {c.description && <p className="mt-1 text-sm text-ink-600">{c.description}</p>}
                  {c.likelyCause && (
                    <p className="mt-2 text-sm"><span className="font-medium text-ink-700">Likely cause: </span>
                      <span className="text-ink-600">{c.likelyCause}</span></p>
                  )}
                  {c.recommendedAction && (
                    <p className="mt-1 text-sm"><span className="font-medium text-ink-700">Recommended action: </span>
                      <span className="text-ink-600">{c.recommendedAction}</span></p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(`Delete diagnostic entry ${c.code}?`)) return;
                        void run(() => deleteDiagnosticCode(c.id), "Diagnostic entry deleted.");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit diagnostic entry" : "New diagnostic entry"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!draft.code.trim() || !draft.vendor.trim() || !draft.title.trim()}
              onClick={() => void submit()}
            >
              {editingId ? "Save" : "Add"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fault code" required>
            <Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} placeholder="e.g. E042" />
          </Field>
          <Field label="Vendor" required>
            <Input value={draft.vendor} onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))} placeholder="e.g. EVERTA" />
          </Field>
          <Field label="Title" required className="sm:col-span-2">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Ground fault detected" />
          </Field>
          <Field label="Severity">
            <Select
              value={draft.severity}
              onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as DiagnosticSeverity }))}
              options={[
                { value: "INFO", label: "Info" },
                { value: "WARNING", label: "Warning" },
                { value: "CRITICAL", label: "Critical" },
              ]}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2} />
          </Field>
          <Field label="Likely cause" className="sm:col-span-2">
            <Textarea value={draft.likelyCause} onChange={(e) => setDraft((d) => ({ ...d, likelyCause: e.target.value }))} rows={2} />
          </Field>
          <Field label="Recommended action" className="sm:col-span-2">
            <Textarea value={draft.recommendedAction} onChange={(e) => setDraft((d) => ({ ...d, recommendedAction: e.target.value }))} rows={2} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
