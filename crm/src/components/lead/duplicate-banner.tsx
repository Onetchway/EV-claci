"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GitMerge } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Button, Modal, useAsyncAction, useToast } from "@/components/ui";
import { findDuplicateLeads, mergeLeads, setDuplicateOverride } from "@/lib/db/leads";
import { canMergeLeads } from "@/lib/permissions";
import type { Lead } from "@/lib/types";
import { formatDate, toDate } from "@/lib/utils";

/**
 * Runs the same phone/email/GSTIN check `createLead` runs before saving,
 * against every OTHER lead already in the system, so a duplicate that
 * slipped through (or predates that guard) surfaces right on the lead
 * itself — where staff can either merge the two or confirm it's a real,
 * separate case (a repeat customer buying a second franchise later) via
 * `duplicateOverride`, which drops it out of this check for good.
 */
export function DuplicateBanner({ lead }: { lead: Lead }) {
  const viewer = useViewer();
  const actor = useActor();
  const router = useRouter();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const [candidates, setCandidates] = useState<Lead[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<{ candidate: Lead; keepIsThis: boolean } | null>(null);

  useEffect(() => {
    if (lead.duplicateOverride || !canMergeLeads(viewer)) { setCandidates([]); return; }
    let cancelled = false;
    findDuplicateLeads({
      phone: lead.client?.phone,
      email: lead.client?.email,
      gstin: lead.client?.gstin,
      excludeId: lead.id,
    })
      .then((rows) => {
        if (!cancelled) setCandidates(rows); // findDuplicateLeads already excludes trashed/merged/confirmed-separate leads
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.client?.phone, lead.client?.email, lead.client?.gstin, lead.duplicateOverride, viewer.uid]);

  if (candidates.length === 0) return null;

  async function doMerge(candidate: Lead, keepIsThis: boolean) {
    const keep = keepIsThis ? lead : candidate;
    const discard = keepIsThis ? candidate : lead;
    await mergeLeads(keep, discard, actor);
    push(`Merged into ${keep.code}.`, "success");
    setConfirmTarget(null);
    if (!keepIsThis) router.push(`/leads/${candidate.id}`);
  }

  async function notDuplicate(candidate: Lead) {
    await setDuplicateOverride(lead, actor, `Confirmed separate from ${candidate.code}`);
    push("Marked as not a duplicate — this check won't flag it again.", "success");
  }

  return (
    <div className="mb-4 space-y-2 print:hidden">
      {candidates.map((c) => {
        const leadIsNewer = (toDate(lead.updatedAt)?.getTime() ?? 0) >= (toDate(c.updatedAt)?.getTime() ?? 0);
        return (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200"
          >
            <div>
              <p className="font-medium">
                Possible duplicate —{" "}
                <Link href={`/leads/${c.id}`} className="underline">{c.client?.name} ({c.code})</Link>
              </p>
              <p className="text-xs text-amber-700">
                Shares a phone, email or GSTIN with this lead. That record was last updated {formatDate(c.updatedAt)}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setConfirmTarget({ candidate: c, keepIsThis: leadIsNewer })}
              >
                <GitMerge className="h-3.5 w-3.5" /> Merge duplicate
              </Button>
              <Button size="sm" loading={busy} onClick={() => void run(() => notDuplicate(c))}>
                Not a duplicate
              </Button>
            </div>
          </div>
        );
      })}

      <Modal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget ? `Merge ${confirmTarget.keepIsThis ? confirmTarget.candidate.code : lead.code} into ${confirmTarget.keepIsThis ? lead.code : confirmTarget.candidate.code}` : ""}
        description="Client, site, financing, EOI and tags are combined onto the surviving lead — anything it's missing is filled in from the other. Payments, documents, EOI history and activity stay on their original record and show up together on the survivor. The other lead moves to Trash, recoverable, not deleted."
        footer={
          <>
            <Button onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => confirmTarget && void run(
                () => doMerge(confirmTarget.candidate, confirmTarget.keepIsThis),
                undefined,
              )}
            >
              <GitMerge className="h-4 w-4" /> Merge
            </Button>
          </>
        }
      >
        {confirmTarget && (
          <p className="text-sm text-ink-700">
            {confirmTarget.keepIsThis
              ? <>Keeps <strong>{lead.code}</strong> ({lead.client?.name}) and folds in <strong>{confirmTarget.candidate.code}</strong> — the more recently updated record wins.</>
              : <>Keeps <strong>{confirmTarget.candidate.code}</strong> ({confirmTarget.candidate.client?.name}) and folds in <strong>{lead.code}</strong> — you'll be moved to that lead's page.</>}
          </p>
        )}
      </Modal>
    </div>
  );
}
