"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Mail, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea,
  useAsyncAction, useToast,
} from "@/components/ui";
import {
  createCampaign, deleteCampaign, sendCampaignNow, setCampaignActive, subscribeCampaigns, updateCampaign,
  type CampaignDraft,
} from "@/lib/db/campaigns";
import { hasRole } from "@/lib/permissions";
import type { Campaign, CampaignAudience } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

const AUDIENCE_LABEL: Record<CampaignAudience, string> = {
  ALL_EMSP: "All app/wallet users",
  ALL_CORPORATE: "All corporate accounts",
  ALL: "Everyone",
};

const blank: CampaignDraft = {
  name: "", audience: "ALL_EMSP", subject: "", message: "", showAsBanner: false, bannerImageUrl: "", bannerLinkUrl: "",
};

export default function CampaignsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = hasRole(viewer, "SUPER_ADMIN", "ADMIN", "SALES_MANAGER");
  const { run, busy } = useAsyncAction();
  const { push } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CampaignDraft>(blank);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => subscribeCampaigns(setCampaigns), []);

  function openNew() {
    setEditingId(null);
    setDraft(blank);
    setStartAt(""); setEndAt("");
    setOpen(true);
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id);
    setDraft({
      name: c.name, audience: c.audience, subject: c.subject, message: c.message,
      showAsBanner: c.showAsBanner, bannerImageUrl: c.bannerImageUrl ?? "", bannerLinkUrl: c.bannerLinkUrl ?? "",
    });
    setStartAt(""); setEndAt("");
    setOpen(true);
  }

  async function submit() {
    if (!actor || !draft.name.trim() || !draft.subject.trim() || !draft.message.trim()) return;
    const full: CampaignDraft = {
      ...draft,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
    };
    await run(async () => {
      if (editingId) await updateCampaign(editingId, full);
      else await createCampaign(full, actor);
      setOpen(false);
    }, editingId ? "Campaign updated." : "Campaign created.");
  }

  async function handleSend(c: Campaign) {
    if (!window.confirm(`Send "${c.name}" to ${AUDIENCE_LABEL[c.audience]} now? This can't be undone.`)) return;
    setSending(c.id);
    try {
      const count = await sendCampaignNow(c);
      push(count > 0 ? `Sent to ${count} recipient${count === 1 ? "" : "s"}.` : "No recipients with an email on file.", count > 0 ? "success" : "error");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setSending(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Email/notification blasts and banners. A banner shows on driver-facing surfaces (currently the app-less QR charging page) during its active window."
        actions={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New campaign</Button>}
      />

      {campaigns === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={<Mail className="h-8 w-8" />} title="No campaigns yet" action={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New campaign</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">{AUDIENCE_LABEL[c.audience]}</p>
                </div>
                <div className="flex gap-1">
                  {c.showAsBanner && <Badge className="bg-sky-100 text-sky-800 ring-sky-200"><ImageIcon className="mr-1 inline h-3 w-3" />Banner</Badge>}
                  <Badge className={c.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                    {c.active ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-ink-700">{c.subject}</p>
              <p className="mt-1 line-clamp-2 text-sm text-ink-500">{c.message}</p>
              {(c.startAt || c.endAt) && (
                <p className="mt-2 text-xs text-ink-400">
                  {c.startAt ? formatDate(c.startAt) : "Any time"} – {c.endAt ? formatDate(c.endAt) : "No end"}
                </p>
              )}
              {c.sentAt && (
                <p className="mt-2 text-xs text-emerald-700">Sent {formatDateTime(c.sentAt)} to {c.sentCount ?? 0} recipient{c.sentCount === 1 ? "" : "s"}.</p>
              )}
              {canManage && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => void handleSend(c)} loading={sending === c.id}>
                    <Send className="h-3.5 w-3.5" /> Send now
                  </Button>
                  <Button size="sm" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={() => void run(() => setCampaignActive(c.id, !c.active))}>
                    {c.active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Delete "${c.name}"?`)) return;
                      void run(() => deleteCampaign(c.id), "Campaign deleted.");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit campaign" : "New campaign"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!draft.name.trim() || !draft.subject.trim() || !draft.message.trim()} onClick={() => void submit()}>
              {editingId ? "Save" : "Create"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Audience">
            <Select
              value={draft.audience}
              onChange={(e) => setDraft({ ...draft, audience: e.target.value as CampaignAudience })}
              options={(Object.keys(AUDIENCE_LABEL) as CampaignAudience[]).map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))}
            />
          </Field>
          <Field label="Subject / title" required><Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
          <Field label="Message" required><Textarea value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} rows={4} /></Field>
          <Checkbox label="Also show as a banner" checked={draft.showAsBanner} onChange={(v) => setDraft({ ...draft, showAsBanner: v })} />
          {draft.showAsBanner && (
            <>
              <Field label="Banner image URL" hint="Optional — uploaded elsewhere, pasted here."><Input value={draft.bannerImageUrl ?? ""} onChange={(e) => setDraft({ ...draft, bannerImageUrl: e.target.value })} /></Field>
              <Field label="Banner link URL" hint="Optional — where tapping the banner goes."><Input value={draft.bannerLinkUrl ?? ""} onChange={(e) => setDraft({ ...draft, bannerLinkUrl: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start showing"><Input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></Field>
                <Field label="Stop showing"><Input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></Field>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
