"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Banknote, Check, ExternalLink, FileText, Landmark, Loader2, MapPin,
} from "lucide-react";

import {
  EOI_STATUS_LABEL, LEAD_TYPE_STAGES, LOAN_STAGE_COLOR, LOAN_STAGE_LABEL,
  PAYMENT_STATUS_COLOR, PROJECT_STAGE_META, STAGE_META, TASK_STATUS_COLOR,
  TASK_STATUS_LABEL, WORKSTREAM_LABEL, WORKSTREAMS,
} from "@/lib/constants";
import { subscribeDocuments } from "@/lib/db/documents";
import { subscribeLead } from "@/lib/db/leads";
import { subscribePayments } from "@/lib/db/payments";
import { subscribeProjectPhotos } from "@/lib/db/project-photos";
import { subscribeProject } from "@/lib/db/projects";
import { usePortalAuth } from "@/lib/portal-auth";
import type { Lead, LeadDocument, Payment, Project, ProjectPhoto } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof Banknote; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <Icon className="h-4 w-4 text-brand-600" /> {title}
      </h2>
      {children}
    </div>
  );
}

export default function PortalLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router = useRouter();
  const { loading, user } = usePortalAuth();

  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [docs, setDocs] = useState<LeadDocument[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/portal/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!leadId) return;
    return subscribeLead(leadId, setLead, (e) => setLeadError(e.message));
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    return subscribePayments(leadId, setPayments);
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    return subscribeDocuments(leadId, setDocs);
  }, [leadId]);

  useEffect(() => {
    if (!lead?.projectId) { setProject(null); return; }
    return subscribeProject(lead.projectId, setProject);
  }, [lead?.projectId]);

  useEffect(() => {
    if (!project?.id) { setPhotos([]); return; }
    return subscribeProjectPhotos(project.id, setPhotos);
  }, [project?.id]);

  if (loading || !user || lead === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (leadError || lead === null) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-ink-700">We couldn&apos;t open this franchise.</p>
          <Link href="/portal" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to your franchises
          </Link>
        </div>
      </main>
    );
  }

  const stagePath = LEAD_TYPE_STAGES[lead.type] ?? LEAD_TYPE_STAGES.FRANCHISE;
  const currentStageIdx = stagePath.indexOf(lead.stage);
  const paid = lead.paidAmount ?? 0;
  const due = lead.dueAmount ?? Math.max(0, lead.value - paid);
  const financing = lead.financing;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Your franchises
      </Link>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink-900">{lead.code}</h1>
            {lead.site?.locationName && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                <MapPin className="h-3.5 w-3.5" /> {lead.site.locationName}
                {lead.client?.city ? `, ${lead.client.city}` : ""}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${STAGE_META[lead.stage]?.color ?? ""}`}>
            {STAGE_META[lead.stage]?.label ?? lead.stage}
          </span>
        </div>

        {/* Stage timeline */}
        <div className="mt-5 flex items-center">
          {stagePath.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    i <= currentStageIdx ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {i < currentStageIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="mt-1 max-w-[64px] text-center text-[10px] leading-tight text-ink-500">
                  {STAGE_META[s]?.short ?? s}
                </span>
              </div>
              {i < stagePath.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 ${i < currentStageIdx ? "bg-brand-600" : "bg-ink-100"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {lead.eoi && (
          <SectionCard title="Expression of Interest" icon={FileText}>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-ink-900">Letter {lead.eoi.number}</p>
                <p className="text-xs text-ink-500">Issued {formatDate(lead.eoi.issuedDate)}</p>
              </div>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700">
                {EOI_STATUS_LABEL[lead.eoi.status]}
              </span>
            </div>
          </SectionCard>
        )}

        {project && (
          <SectionCard title="Project progress" icon={Check}>
            <p className="mb-3 text-xs text-ink-500">
              Stage: <span className="font-medium text-ink-800">{PROJECT_STAGE_META[project.stage]?.label ?? project.stage}</span>
            </p>
            <div className="space-y-3">
              {WORKSTREAMS.map((w) => {
                const ws = project.workstreams?.[w];
                if (!ws) return null;
                return (
                  <div key={w}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-800">{WORKSTREAM_LABEL[w]}</span>
                      <span className={`rounded px-1.5 py-0.5 ${TASK_STATUS_COLOR[ws.status] ?? ""}`}>
                        {TASK_STATUS_LABEL[ws.status] ?? ws.status}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.max(0, Math.min(100, ws.progressPct ?? 0))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-ink-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || "Site photo"} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard title="Payments" icon={Banknote}>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-ink-50 p-2">
              <p className="text-xs text-ink-500">Total</p>
              <p className="text-sm font-semibold text-ink-900">{formatINR(lead.value)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2">
              <p className="text-xs text-emerald-700">Paid</p>
              <p className="text-sm font-semibold text-emerald-800">{formatINR(paid)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-xs text-amber-700">Due</p>
              <p className="text-sm font-semibold text-amber-800">{formatINR(due)}</p>
            </div>
          </div>
          {payments.length > 0 && (
            <div className="divide-y divide-ink-100 border-t border-ink-100">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-ink-800">{titleCase(p.milestone)} · {formatDate(p.paidAt ?? p.dueAt)}</p>
                    <p className="text-xs text-ink-500">{p.mode ? titleCase(p.mode) : ""}{p.reference ? ` · ${p.reference}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-ink-900">{formatINR(p.totalAmount)}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PAYMENT_STATUS_COLOR[p.status] ?? ""}`}>
                      {titleCase(p.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {financing && financing.mode !== "SELF" && (
          <SectionCard title="Loan / financing" icon={Landmark}>
            <div className="flex items-center justify-between text-sm">
              <div>
                {financing.bank && <p className="text-ink-900">{financing.bank}{financing.branch ? ` · ${financing.branch}` : ""}</p>}
                {financing.sanctionedAmount ? (
                  <p className="text-xs text-ink-500">Sanctioned {formatINR(financing.sanctionedAmount)}</p>
                ) : financing.requestedAmount ? (
                  <p className="text-xs text-ink-500">Requested {formatINR(financing.requestedAmount)}</p>
                ) : null}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${LOAN_STAGE_COLOR[financing.stage] ?? ""}`}>
                {LOAN_STAGE_LABEL[financing.stage]}
              </span>
            </div>
          </SectionCard>
        )}

        {docs.length > 0 && (
          <SectionCard title="Documents" icon={FileText}>
            <div className="divide-y divide-ink-100">
              {docs.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between py-2 text-sm text-ink-800 hover:text-brand-700"
                >
                  <span className="truncate">{d.fileName}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                </a>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        Updated {formatDateTime(lead.updatedAt)} · Questions? Reach out to your relationship manager.
      </p>
    </main>
  );
}
