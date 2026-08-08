"use client";

import { Check, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";

import { Button, Modal, Textarea, useAsyncAction } from "@/components/ui";
import { STAGES, STAGE_META, type Stage } from "@/lib/constants";
import type { Actor, Lead } from "@/lib/types";
import { changeStage } from "@/lib/db/leads";
import { cn } from "@/lib/utils";

/**
 * Stage gates. These are advisory-but-enforced in the UI: an agent cannot mark
 * a lead as agreed before KYC is on file, or hand it over before the money is
 * collected, because both of those states are recoverable only by hand.
 */
export interface StageGate {
  blocked: boolean;
  reason?: string;
}

export function gateFor(
  stage: Stage,
  ctx: { kycComplete: boolean; collectedPct: number; hasConfig: boolean },
): StageGate {
  if (stage === "EOI" && !ctx.hasConfig) {
    return { blocked: true, reason: "Add the charger configuration before recording an EOI." };
  }
  if (stage === "AGREEMENT" && !ctx.kycComplete) {
    return { blocked: true, reason: "Upload the mandatory KYC documents before the agreement stage." };
  }
  if (stage === "COMMISSIONING" && ctx.collectedPct < 50) {
    return { blocked: true, reason: "At least 50% of the investment must be collected before commissioning." };
  }
  if (stage === "HANDOVER" && ctx.collectedPct < 100) {
    return { blocked: true, reason: "Collect the full investment before handover." };
  }
  return { blocked: false };
}

export function StageStepper({
  lead, actor, canEdit, gateContext,
}: {
  lead: Lead;
  actor: Actor;
  canEdit: boolean;
  gateContext: { kycComplete: boolean; collectedPct: number; hasConfig: boolean };
}) {
  const [target, setTarget] = useState<Stage | null>(null);
  const [note, setNote] = useState("");
  const { busy, run } = useAsyncAction();

  const currentIndex = STAGES.indexOf(lead.stage);
  const gate = target ? gateFor(target, gateContext) : { blocked: false };
  const movingForward = target ? STAGES.indexOf(target) > currentIndex : false;

  return (
    <>
      <div className="card overflow-x-auto scroll-thin">
        <ol className="flex min-w-max items-center gap-1 p-3">
          {STAGES.map((s, i) => {
            const meta = STAGE_META[s];
            const done = i < currentIndex || lead.status === "WON";
            const current = i === currentIndex;
            const blocked = gateFor(s, gateContext).blocked && i > currentIndex;

            return (
              <li key={s} className="flex items-center">
                <button
                  type="button"
                  disabled={!canEdit || current}
                  onClick={() => { setTarget(s); setNote(""); }}
                  title={blocked ? gateFor(s, gateContext).reason : meta.hint}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left transition",
                    current && "bg-ink-900 text-white",
                    done && !current && "bg-emerald-50 text-emerald-800",
                    !done && !current && "text-ink-600 hover:bg-ink-100",
                    !canEdit && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      current ? "bg-white text-ink-900" : done ? "bg-emerald-500 text-white" : "bg-ink-200 text-ink-600",
                    )}
                  >
                    {done && !current ? <Check className="h-3 w-3" /> : blocked ? <Lock className="h-2.5 w-2.5" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap text-xs font-medium">{meta.short}</span>
                </button>
                {i < STAGES.length - 1 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />}
              </li>
            );
          })}
        </ol>
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `Move to ${STAGE_META[target].label}` : ""}
        description={target ? STAGE_META[target].hint : undefined}
        footer={
          <>
            <Button onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={gate.blocked && movingForward}
              onClick={() =>
                void run(async () => {
                  if (!target) return;
                  await changeStage(lead, target, actor, note.trim() || undefined);
                  setTarget(null);
                }, "Stage updated.")
              }
            >
              Confirm move
            </Button>
          </>
        }
      >
        {gate.blocked && movingForward ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            {gate.reason}
          </div>
        ) : (
          <>
            {!movingForward && target && (
              <div className="mb-3 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-700">
                You are moving this lead <strong>backwards</strong> to {STAGE_META[target].label}. The
                reason below is recorded in the audit log.
              </div>
            )}
            <label className="label">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What changed? e.g. EOI cheque received, site survey scheduled for Friday."
            />
          </>
        )}
      </Modal>
    </>
  );
}
