"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Banknote, Camera, Check, Download, FileText, Landmark, Loader2, MapPin, Receipt, User, Zap,
} from "lucide-react";

import {
  AGREEMENT_STATUS_LABEL, DOC_KIND_LABEL, EOI_STATUS_LABEL, FUNDING_MODE_LABEL, LEAD_TYPE_STAGES, LOAN_STAGE_COLOR,
  LOAN_STAGE_LABEL, PAYMENT_STATUS_COLOR, PROJECT_STAGE_META, STAGE_META, TASK_STATUS_COLOR,
  TASK_STATUS_LABEL, WORKSTREAM_LABEL, WORKSTREAMS, type DocKind,
} from "@/lib/constants";
import { PortalBankDetailsCard } from "@/components/portal-bank-details";
import { PortalSupportCard } from "@/components/portal-support-card";
import { useSettings } from "@/hooks/use-settings";
import { subscribeDocuments } from "@/lib/db/documents";
import { subscribeLead } from "@/lib/db/leads";
import { subscribePayments } from "@/lib/db/payments";
import { subscribeProjectPhotos } from "@/lib/db/project-photos";
import { subscribeProject } from "@/lib/db/projects";
import { usePortalAuth } from "@/lib/portal-auth";
import { buildQuote } from "@/lib/pricing";
import type { Lead, LeadDocument, Payment, Project, ProjectPhoto } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

const KYC_KINDS: DocKind[] = ["AADHAAR", "PAN", "GST_CERTIFICATE", "CANCELLED_CHEQUE", "PHOTOGRAPH"];
const SITE_KINDS: DocKind[] = ["ELECTRICITY_BILL", "LOAD_SANCTION", "PROPERTY_PROOF", "LEASE_AGREEMENT", "SITE_PHOTO"];
const AGREEMENT_KINDS: DocKind[] = ["FRANCHISE_AGREEMENT", "EOI_FORM"];

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function SectionCard({
  title, icon: Icon, action, children,
}: {
  title: string; icon: typeof Banknote; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
          <Icon className="h-4 w-4 text-brand-600" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{value}</dd>
    </div>
  );
}

function isImageFile(contentType: string) {
  return contentType.startsWith("image/");
}

function DocGrid({ docs }: { docs: LeadDocument[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {docs.map((d) => (
        <a
          key={d.id}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-lg border border-ink-200 transition hover:border-brand-300 hover:shadow-sm"
        >
          <div className="flex aspect-[4/3] items-center justify-center bg-ink-50">
            {isImageFile(d.contentType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.url} alt={DOC_KIND_LABEL[d.kind] ?? d.fileName} className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-8 w-8 text-ink-300" />
            )}
          </div>
          <div className="flex items-center justify-between gap-1 p-2">
            <span className="truncate text-xs font-medium text-ink-800">{DOC_KIND_LABEL[d.kind] ?? d.fileName}</span>
            <Download className="h-3.5 w-3.5 shrink-0 text-ink-400 group-hover:text-brand-600" />
          </div>
        </a>
      ))}
    </div>
  );
}

export default function PortalLeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router = useRouter();
  const { loading, user } = usePortalAuth();
  const { settings } = useSettings();

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

  const quote = useMemo(
    () => (lead ? buildQuote(lead.config ?? [], { discount: lead.discount ?? 0, extras: lead.extras ?? [] }) : null),
    [lead],
  );

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
  const currentMeta = STAGE_META[lead.stage];
  const paid = lead.paidAmount ?? 0;
  const due = lead.dueAmount ?? Math.max(0, lead.value - paid);
  const financing = lead.financing;
  const site = lead.site;

  const kycDocs = docs.filter((d) => KYC_KINDS.includes(d.kind));
  const siteDocs = docs.filter((d) => SITE_KINDS.includes(d.kind));
  const agreementDocs = docs.filter((d) => AGREEMENT_KINDS.includes(d.kind));
  const uploadedAgreementDocs = docs.filter((d) => d.kind === "FRANCHISE_AGREEMENT");
  const otherDocs = docs.filter((d) => !KYC_KINDS.includes(d.kind) && !SITE_KINDS.includes(d.kind) && !AGREEMENT_KINDS.includes(d.kind));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Your franchises
      </Link>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink-900">{lead.code}</h1>
            {site?.locationName && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">
                <MapPin className="h-3.5 w-3.5" /> {site.locationName}
                {lead.client?.city ? `, ${lead.client.city}` : ""}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${currentMeta?.color ?? ""}`}>
            {currentMeta?.label ?? lead.stage}
          </span>
        </div>

        {/* Stage timeline */}
        <div className="mt-7 flex items-start">
          {stagePath.map((s, i) => {
            const meta = STAGE_META[s];
            const done = i < currentStageIdx;
            const active = i === currentStageIdx;
            return (
              <div key={s} className="flex flex-1 flex-col items-center last:flex-none">
                <div className="flex w-full items-center">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                      done
                        ? "bg-brand-600 text-white"
                        : active
                          ? "bg-white text-brand-700 ring-2 ring-brand-500 shadow-[0_0_0_4px_rgba(22,163,74,0.12)]"
                          : "bg-ink-100 text-ink-400"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  {i < stagePath.length - 1 && (
                    <div className={`mx-1 h-1 flex-1 rounded-full transition ${done ? "bg-brand-600" : "bg-ink-100"}`} />
                  )}
                </div>
                <span className={`mt-2 max-w-[72px] text-center text-[11px] leading-tight ${active ? "font-semibold text-brand-700" : "text-ink-500"}`}>
                  {meta?.short ?? s}
                </span>
              </div>
            );
          })}
        </div>
        {currentMeta?.hint && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">{currentMeta.hint}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SectionCard title="Your details" icon={User}>
            <dl className="space-y-2.5">
              <Detail label="Name" value={lead.client?.name} />
              <Detail label="Phone" value={lead.client?.phone ? `+91 ${lead.client.phone}` : undefined} />
              <Detail label="Email" value={lead.client?.email} />
              <Detail label="Company" value={lead.client?.company} />
              <Detail label="City / State" value={[lead.client?.city, lead.client?.state].filter(Boolean).join(", ") || undefined} />
            </dl>
          </SectionCard>

          <SectionCard title="Site location" icon={MapPin}>
            {site?.locationName || site?.address ? (
              <dl className="space-y-2.5">
                <Detail label="Location" value={site?.locationName} />
                <Detail label="Address" value={site?.address} />
                <Detail label="Landmark" value={site?.nearbyLandmark} />
                <Detail
                  label="Maps"
                  value={site?.mapsLink ? (
                    <a href={site.mapsLink} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                      Open in Google Maps
                    </a>
                  ) : undefined}
                />
                <Detail label="Space available" value={site?.spaceAvailableSqft ? `${site.spaceAvailableSqft} sq ft` : undefined} />
              </dl>
            ) : (
              <p className="text-sm text-ink-500">Site details will appear here once finalised.</p>
            )}
          </SectionCard>
        </div>

        {quote && quote.lines.length > 0 && (
          <SectionCard title="Chargers" icon={Zap}>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-200">
                  <tr>
                    <th className="py-1.5 text-left font-semibold text-ink-600">Item</th>
                    <th className="py-1.5 text-right font-semibold text-ink-600">Qty</th>
                    <th className="py-1.5 text-right font-semibold text-ink-600">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {quote.lines.map((l) => (
                    <tr key={l.key}>
                      <td className="py-2 text-ink-800">
                        {l.label}
                        {l.oem && <span className="ml-1 text-xs text-ink-500">· {l.oem}</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink-700">{l.qty}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-ink-900">{formatINR(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-ink-200">
                  <tr>
                    <td className="py-2 font-semibold text-ink-900" colSpan={2}>Total incl. GST</td>
                    <td className="py-2 text-right text-base font-bold tabular-nums text-brand-700">{formatINR(quote.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}

        {lead.eoi && (
          <SectionCard
            title="Expression of Interest"
            icon={FileText}
            action={
              <Link
                href={`/portal/${lead.id}/eoi`}
                className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <Download className="h-3.5 w-3.5" /> View / download
              </Link>
            }
          >
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

        {lead.agreement && (
          <SectionCard
            title="Franchise Agreement"
            icon={FileText}
            action={
              <Link
                href={`/portal/${lead.id}/agreement`}
                className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <Download className="h-3.5 w-3.5" /> View / download
              </Link>
            }
          >
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-ink-900">Agreement {lead.agreement.number}</p>
                <p className="text-xs text-ink-500">Issued {formatDate(lead.agreement.issuedDate)}</p>
              </div>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700">
                {AGREEMENT_STATUS_LABEL[lead.agreement.status]}
              </span>
            </div>
          </SectionCard>
        )}

        {/* Agreement uploaded as a file instead of drafted in-system — shown only when there's no system-drafted one above, so the section never appears twice. */}
        {!lead.agreement && uploadedAgreementDocs.length > 0 && (
          <SectionCard title="Franchise Agreement" icon={FileText}>
            <div className="space-y-2">
              {uploadedAgreementDocs.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 text-sm transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="truncate text-ink-800">{d.fileName}</span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                </a>
              ))}
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
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, ws.progressPct ?? 0))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {photos.length > 0 && (
          <SectionCard title="Site photos" icon={Camera}>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group block aspect-square overflow-hidden rounded-lg bg-ink-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || "Site photo"} className="h-full w-full object-cover transition group-hover:scale-105" />
                </a>
              ))}
            </div>
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
                <div key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="text-ink-800">{titleCase(p.milestone)} · {formatDate(p.paidAt ?? p.dueAt)}</p>
                    <p className="truncate text-xs text-ink-500">{p.mode ? titleCase(p.mode) : ""}{p.reference ? ` · ${p.reference}` : ""}</p>
                    {p.status === "REFUNDED" && p.note && (
                      <p className="mt-0.5 text-xs text-rose-600">Refund note: {p.note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium text-ink-900">{formatINR(p.totalAmount)}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${PAYMENT_STATUS_COLOR[p.status] ?? ""}`}>
                        {titleCase(p.status)}
                      </span>
                    </div>
                    {(p.status === "RECEIVED" || p.status === "VERIFIED") && (
                      <Link
                        href={`/portal/${lead.id}/payments/${p.id}/receipt`}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-700"
                        title="Download receipt"
                      >
                        <Receipt className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <PortalBankDetailsCard leadId={lead.id} companyBank={settings.bank} companyName={settings.company.shortName} />

        {financing && (
          <SectionCard title="Loan / financing" icon={Landmark}>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-ink-900">{FUNDING_MODE_LABEL[financing.mode] ?? titleCase(financing.mode)}</p>
                {financing.mode !== "SELF" && (
                  financing.bank ? (
                    <p className="text-xs text-ink-500">{financing.bank}{financing.branch ? ` · ${financing.branch}` : ""}</p>
                  ) : null
                )}
                {financing.mode !== "SELF" && (
                  financing.sanctionedAmount ? (
                    <p className="text-xs text-ink-500">Sanctioned {formatINR(financing.sanctionedAmount)}</p>
                  ) : financing.requestedAmount ? (
                    <p className="text-xs text-ink-500">Requested {formatINR(financing.requestedAmount)}</p>
                  ) : null
                )}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${LOAN_STAGE_COLOR[financing.stage] ?? ""}`}>
                {LOAN_STAGE_LABEL[financing.stage]}
              </span>
            </div>
          </SectionCard>
        )}

        {kycDocs.length > 0 && (
          <SectionCard title="KYC documents" icon={FileText}>
            <DocGrid docs={kycDocs} />
          </SectionCard>
        )}

        {siteDocs.length > 0 && (
          <SectionCard title="Site & property documents" icon={MapPin}>
            <DocGrid docs={siteDocs} />
          </SectionCard>
        )}

        {agreementDocs.length > 0 && (
          <SectionCard title="Agreement" icon={FileText}>
            <DocGrid docs={agreementDocs} />
          </SectionCard>
        )}

        {otherDocs.length > 0 && (
          <SectionCard title="Other documents" icon={FileText}>
            <DocGrid docs={otherDocs} />
          </SectionCard>
        )}

        <PortalSupportCard lead={lead} />
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        Updated {formatDateTime(lead.updatedAt)}
      </p>
    </main>
  );
}
