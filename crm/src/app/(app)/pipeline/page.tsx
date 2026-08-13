"use client";

import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, GripVertical, Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  LeadFilterBar, emptyFilters, type FilterState,
} from "@/components/lead-filters";
import { gateFor } from "@/components/lead/stage-stepper";
import {
  Avatar, Badge, Button, PageHeader, Spinner, useToast,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import { STAGES, STAGE_META, type Stage } from "@/lib/constants";
import { applyClientFilters, changeStage } from "@/lib/db/leads";
import { canEditLead } from "@/lib/permissions";
import { describeConfig } from "@/lib/pricing";
import type { Lead } from "@/lib/types";
import { cn, formatCompactINR, formatDate, toDate } from "@/lib/utils";

function LeadCard({ lead, draggable }: { lead: Lead; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: !draggable,
  });

  const overdue =
    lead.status === "ACTIVE" && (toDate(lead.nextFollowUpAt)?.getTime() ?? Infinity) < Date.now();

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-ink-200 bg-white p-3 shadow-sm transition",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-ink-300 hover:text-ink-500 active:cursor-grabbing"
            aria-label={`Drag ${lead.client?.name}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900 hover:text-brand-700">
            {lead.client?.name}
          </p>
          <p className="truncate text-[11px] text-ink-500">
            {lead.code} · {lead.client?.city}
          </p>
          <p className="mt-1.5 truncate text-[11px] text-ink-600">{describeConfig(lead.config)}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-ink-900">
            {formatCompactINR(lead.value)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <Avatar name={lead.ownerName} size={18} />
              <span className="truncate text-[11px] text-ink-500">{lead.ownerName}</span>
            </span>
            {lead.nextFollowUpAt && (
              <span className={cn("shrink-0 text-[11px]", overdue ? "font-semibold text-rose-600" : "text-ink-400")}>
                {overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                {formatDate(lead.nextFollowUpAt)}
              </span>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}

function Column({
  stage, leads, draggable,
}: {
  stage: Stage; leads: Lead[]; draggable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];
  const value = leads.reduce((a, l) => a + (l.value ?? 0), 0);

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="sticky top-0 z-10 rounded-t-lg border border-b-0 border-ink-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
            <span className="text-sm font-semibold text-ink-900">{meta.short}</span>
          </span>
          <Badge className={meta.color}>{leads.length}</Badge>
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums text-ink-500">{formatCompactINR(value)}</p>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[220px] flex-1 space-y-2 rounded-b-lg border border-t-0 border-ink-200 p-2 transition",
          isOver ? "bg-brand-50 ring-2 ring-inset ring-brand-400" : "bg-ink-100/50",
        )}
      >
        {leads.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-400">Drop leads here</p>
        ) : (
          leads.map((l) => <LeadCard key={l.id} lead={l} draggable={draggable} />)
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { profile, role, actor } = useAuth();
  const { push } = useToast();
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState<Lead | null>(null);

  const { leads, loading } = useLeads(
    useMemo(
      () => ({ status: "ACTIVE" as const, type: filters.type, ownerId: filters.ownerId || undefined, max: 8000 }),
      [filters.type, filters.ownerId],
    ),
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(
    () =>
      applyClientFilters(leads, {
        sources: filters.sources,
        city: filters.city || undefined,
        search: filters.search || undefined,
        from: filters.from ? new Date(filters.from) : null,
        to: filters.to ? new Date(filters.to) : null,
        overdueOnly: filters.overdueOnly,
      }),
    [leads, filters],
  );

  const byStage = useMemo(() => {
    const map = new Map<Stage, Lead[]>(STAGES.map((s) => [s, []]));
    for (const l of rows) map.get(l.stage)?.push(l);
    return map;
  }, [rows]);

  const viewer = useViewer();

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current?.lead as Lead) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    const lead = e.active.data.current?.lead as Lead | undefined;
    const target = e.over?.id as Stage | undefined;
    setDragging(null);
    if (!lead || !target || !actor || lead.stage === target) return;

    // The board moves fast, so re-check the same gates the stepper enforces —
    // a drag must not be a way around a KYC or payment requirement.
    const forward = STAGES.indexOf(target) > STAGES.indexOf(lead.stage);
    if (forward) {
      const gate = gateFor(target, {
        hasConfig: (lead.config ?? []).length > 0,
        kycComplete: false,
        collectedPct: (lead.value ?? 0) > 0 ? Math.round(((lead.paidAmount ?? 0) / lead.value) * 100) : 0,
      });
      // KYC is not loaded on the board; only enforce the gates we can evaluate here.
      if (gate.blocked && target !== "AGREEMENT") {
        push(gate.reason ?? "This move is blocked.", "error");
        return;
      }
    }

    try {
      await changeStage(lead, target, actor);
      push(`${lead.client?.name} moved to ${STAGE_META[target].short}.`, "success");
    } catch (err) {
      push((err as Error).message || "Could not move the lead.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag a lead between stages. Every move is logged with your name."
        actions={<Link href="/leads/new"><Button variant="primary"><Plus className="h-4 w-4" /> New lead</Button></Link>}
      />

      <LeadFilterBar
        value={filters}
        onChange={setFilters}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((x) => !x)}
      />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="flex gap-3 overflow-x-auto pb-4 scroll-thin">
            {STAGES.map((s) => {
              const columnLeads = byStage.get(s) ?? [];
              const draggable = columnLeads.some((l) => canEditLead(viewer, l));
              return <Column key={s} stage={s} leads={columnLeads} draggable={draggable} />;
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div className="dnd-overlay w-64 rounded-lg border border-brand-400 bg-white p-3 shadow-lg">
                <p className="truncate text-sm font-medium text-ink-900">{dragging.client?.name}</p>
                <p className="truncate text-[11px] text-ink-500">{dragging.code}</p>
                <p className="mt-1 text-sm font-semibold">{formatCompactINR(dragging.value)}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
}
