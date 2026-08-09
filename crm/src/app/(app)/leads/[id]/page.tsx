"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ExternalLink, HardHat, Mail, MapPin, Pencil, Phone, RotateCcw,
  UserCog, XCircle,
} from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ActivityPanel } from "@/components/lead/activity-panel";
import { TasksPanel } from "@/components/lead/tasks-panel";
import { DocumentsPanel } from "@/components/lead/documents-panel";
import { PaymentsPanel } from "@/components/lead/payments-panel";
import { EoiPanel } from "@/components/lead/eoi-panel";
import { FinancingPanel } from "@/components/lead/financing-panel";
import { StageStepper } from "@/components/lead/stage-stepper";
import { LeadForm, leadToFormValues, type LeadFormValues } from "@/components/lead-form";
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import {
  COMMERCIAL_MODEL_LABEL, FRANCHISE_LOI_TYPES, LAND_TYPE_LABEL, LEAD_TYPE_LABEL,
  LOCATION_TYPE_LABEL, OWNERSHIP_LABEL, OWNER_TYPE_LABEL, POWER_LOAD_LABEL,
  REJECTION_LABEL, REJECTION_REASONS, SOURCE_LABEL, STAGE_META, STATUS_COLOR,
  STATUS_LABEL, type RejectionReason,
} from "@/lib/constants";
import {
  reassignLead, reopenLead, subscribeLead, rejectLead, updateLead,
} from "@/lib/db/leads";
import { convertLeadToProject } from "@/lib/db/projects";
import { notifyAssigned } from "@/lib/db/notifications";
import { scoreLead } from "@/lib/scoring";
import {
  canCreateLead, canEditLead, canReassign, canReopenLead, canViewLead,
} from "@/lib/permissions";
import { buildQuote, describeConfig } from "@/lib/pricing";
import type { Lead } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/utils";

const TABS = [
  "Overview", "Quotation", "Financing", "Letter of Intent", "Payments", "Documents", "Tasks", "Activity",
] as const;
type Tab = (typeof TABS)[number];

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value ?? "—"}</dd>
    </div>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, role, actor } = useAuth();
  const { users } = useAgents();
  const { busy, run } = useAsyncAction();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");

  const [editing, setEditing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState<RejectionReason>("NOT_INTERESTED");
  const [reasonNote, setReasonNote] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [newOwner, setNewOwner] = useState("");

  const [kycComplete, setKycComplete] = useState(false);
  const [collectedPct, setCollectedPct] = useState(0);

  useEffect(() => {
    if (!id) return;
    return subscribeLead(
      id,
      (l) => { setLead(l); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, [id]);

  const viewer = useViewer();

  const quote = useMemo(
    () =>
      lead
        ? buildQuote(lead.config ?? [], { discount: lead.discount ?? 0, extras: lead.extras ?? [] })
        : null,
    [lead],
  );

  const onKyc = useCallback((v: boolean) => setKycComplete(v), []);
  const onSummary = useCallback((v: number) => setCollectedPct(v), []);

  if (loading) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }

  if (error || !lead) {
    return (
      <EmptyState
        title="Lead not available"
        description={error ?? "This lead does not exist, or it may have been deleted."}
        action={<Link href="/leads"><Button>Back to leads</Button></Link>}
      />
    );
  }

  if (!canViewLead(viewer, lead)) {
    return (
      <EmptyState
        title="You do not have access to this lead"
        description="Leads are visible to their owning agent and to admins."
        action={<Link href="/leads"><Button>Back to leads</Button></Link>}
      />
    );
  }

  const editable = canEditLead(viewer, lead) && Boolean(actor);
  const stage = STAGE_META[lead.stage];
  const score = scoreLead(lead);

  async function saveEdits(values: LeadFormValues) {
    if (!actor || !lead) return;
    await updateLead(
      lead,
      {
        type: values.type,
        client: values.client,
        source: values.source,
        sourceDetail: values.sourceDetail,
        config: values.config,
        extras: values.extras,
        discount: values.discount,
        oem: values.oem,
        financing: values.financing,
        site: values.site,
        tags: values.tags,
        nextFollowUpAt: values.nextFollowUpAt,
        expectedCloseAt: values.expectedCloseAt,
        partnerId: values.partnerId,
        partnerName: values.partnerName,
        commercialModel: values.commercialModel,
      },
      actor,
    );
    setEditing(false);
  }

  if (editing) {
    return (
      <>
        <PageHeader
          title={`Edit ${lead.code}`}
          description={lead.client?.name}
          actions={<Button onClick={() => setEditing(false)}>Cancel</Button>}
        />
        <LeadForm
          initial={leadToFormValues(lead)}
          submitLabel="Save changes"
          currentLeadId={lead.id}
          onSubmit={saveEdits}
          onCancel={() => setEditing(false)}
        />
      </>
    );
  }

  return (
    <>
      <button onClick={() => router.push("/leads")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 print:hidden">
        <ArrowLeft className="h-4 w-4" /> All leads
      </button>

      <PageHeader
        className="print:hidden"
        title={lead.client?.name ?? "Lead"}
        description={`${lead.code} · ${LEAD_TYPE_LABEL[lead.type]} · created ${formatDate(lead.createdAt)} by ${lead.createdBy?.name ?? "—"}`}
        actions={
          <>
            {editable && (
              <Button onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
            )}
            {canReassign(viewer) && (
              <Button onClick={() => { setNewOwner(lead.ownerId); setReassignOpen(true); }}>
                <UserCog className="h-4 w-4" /> Reassign
              </Button>
            )}
            {lead.status === "WON" && !lead.projectId && canCreateLead(viewer) && (
              <Button
                variant="primary"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const project = await convertLeadToProject(lead, actor!);
                    router.push(`/projects/${project.id}`);
                  }, "Project created.")
                }
              >
                <HardHat className="h-4 w-4" /> Convert to project
              </Button>
            )}
            {lead.projectId && (
              <Link href={`/projects/${lead.projectId}`}>
                <Button><HardHat className="h-4 w-4" /> Open project {lead.projectCode}</Button>
              </Link>
            )}
            {lead.status === "REJECTED" ? (
              canReopenLead(viewer) && (
                <Button variant="primary" onClick={() => void run(() => reopenLead(lead, actor!), "Lead reopened.")} loading={busy}>
                  <RotateCcw className="h-4 w-4" /> Reopen
                </Button>
              )
            ) : (
              editable && (
                <Button variant="danger" onClick={() => setRejectOpen(true)}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              )
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Badge className={stage.color}>{stage.label}</Badge>
        <Badge className={STATUS_COLOR[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
        {lead.status === "ACTIVE" && (
          <Badge
            className={score.band.color}
            title={score.factors.map((f) => `${f.label} (${f.points > 0 ? "+" : ""}${f.points})`).join(", ")}
          >
            {score.band.label} · {score.score}
          </Badge>
        )}
        <Badge>{SOURCE_LABEL[lead.source] ?? lead.source}</Badge>
        <span className="flex items-center gap-1.5 text-sm text-ink-600">
          <Avatar name={lead.ownerName} size={20} /> {lead.ownerName}
        </span>
        {(lead.tags ?? []).map((t) => <Badge key={t}>{t}</Badge>)}
      </div>

      {lead.status === "REJECTED" && lead.rejection && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-inset ring-rose-200 print:hidden">
          <p className="font-semibold">Rejected — {REJECTION_LABEL[lead.rejection.reason]}</p>
          {lead.rejection.note && <p className="mt-0.5">{lead.rejection.note}</p>}
          <p className="mt-1 text-xs text-rose-700">
            By {lead.rejection.by?.name} on {formatDateTime(lead.rejection.at)}
          </p>
        </div>
      )}

      <div className="mb-4 print:hidden">
        <StageStepper
          lead={lead}
          actor={actor!}
          canEdit={editable}
          gateContext={{ kycComplete, collectedPct, hasConfig: (lead.config ?? []).length > 0 }}
        />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-200 scroll-thin print:hidden">
        {TABS.filter((t) => t !== "Letter of Intent" || FRANCHISE_LOI_TYPES.includes(lead.type)).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === t
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Client" className="lg:col-span-2">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Name" value={lead.client?.name} />
              {lead.commercialModel && (
                <Detail label="Commercial model" value={COMMERCIAL_MODEL_LABEL[lead.commercialModel]} />
              )}
              <Detail
                label="Phone"
                value={
                  <a href={`tel:${lead.client?.phone}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {lead.client?.phone}
                  </a>
                }
              />
              <Detail label="Alternate phone" value={lead.client?.altPhone || "—"} />
              <Detail
                label="Email"
                value={
                  lead.client?.email ? (
                    <a href={`mailto:${lead.client.email}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Mail className="h-3.5 w-3.5" /> {lead.client.email}
                    </a>
                  ) : "—"
                }
              />
              <Detail label="Company" value={lead.client?.company || "—"} />
              <Detail label="City" value={lead.client?.city} />
              <Detail label="State" value={lead.client?.state || "—"} />
              <Detail label="PAN" value={lead.client?.pan || "—"} />
              <Detail label="GSTIN" value={lead.client?.gstin || "—"} />
              <Detail label="Address" value={lead.client?.address || "—"} />
            </dl>
          </Card>

          <Card title="Pipeline">
            <dl className="space-y-3">
              <Detail label="Stage" value={stage.label} />
              <Detail label="Source" value={`${SOURCE_LABEL[lead.source]}${lead.sourceDetail ? ` — ${lead.sourceDetail}` : ""}`} />
              <Detail label="Configuration" value={describeConfig(lead.config)} />
              <Detail label="Total value" value={<span className="font-semibold">{formatINR(lead.value)}</span>} />
              <Detail label="Collected" value={formatINR(lead.paidAmount ?? 0)} />
              <Detail label="Balance" value={formatINR(Math.max(0, (lead.value ?? 0) - (lead.paidAmount ?? 0)))} />
              <Detail label="Next follow-up" value={formatDate(lead.nextFollowUpAt)} />
              <Detail label="Expected close" value={formatDate(lead.expectedCloseAt)} />
              <Detail label="Last updated" value={`${formatDateTime(lead.updatedAt)} by ${lead.updatedBy?.name ?? "—"}`} />
            </dl>
          </Card>

          {lead.type === "SITE" && (
            <Card title="Site details" className="lg:col-span-3">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Location name" value={lead.site?.locationName || "—"} />
                <Detail
                  label="Google Maps"
                  value={
                    lead.site?.mapsLink ? (
                      <a href={lead.site.mapsLink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <MapPin className="h-3.5 w-3.5" /> Open map <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : "—"
                  }
                />
                <Detail
                  label="Coordinates"
                  value={lead.site?.lat && lead.site?.lng ? `${lead.site.lat.toFixed(5)}, ${lead.site.lng.toFixed(5)}` : "—"}
                />
                <Detail
                  label="Location type"
                  value={(lead.site?.locationTypes ?? []).map((t) => LOCATION_TYPE_LABEL[t]).join(", ") || "—"}
                />
                <Detail label="Land type" value={lead.site?.landType ? LAND_TYPE_LABEL[lead.site.landType] : "—"} />
                <Detail label="Owner type" value={lead.site?.ownerType ? OWNER_TYPE_LABEL[lead.site.ownerType] : "—"} />
                <Detail label="Property owner" value={lead.site?.ownership ? OWNERSHIP_LABEL[lead.site.ownership] : "—"} />
                <Detail label="Revenue-share interest" value={lead.site?.commercialModelInterested ? "Yes" : "No"} />
                <Detail label="Power load" value={lead.site?.powerLoad ? POWER_LOAD_LABEL[lead.site.powerLoad] : "—"} />
                <Detail label="Sanctioned load" value={lead.site?.sanctionedLoadKva ? `${lead.site.sanctionedLoadKva} kVA` : "—"} />
                <Detail label="Space available" value={lead.site?.spaceAvailableSqft ? `${formatNumber(lead.site.spaceAvailableSqft)} sq.ft` : "—"} />
                <Detail label="Nearby landmark" value={lead.site?.nearbyLandmark || "—"} />
                <Detail label="Remarks" value={lead.site?.remarks || "—"} />
              </dl>
            </Card>
          )}
        </div>
      )}

      {tab === "Quotation" && quote && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Quotation" subtitle={describeConfig(lead.config)} className="lg:col-span-2">
            {quote.lines.length === 0 ? (
              <EmptyState
                title="No configuration yet"
                description="Edit the lead and drag chargers into the configuration to generate a quotation."
                action={editable ? <Button variant="primary" onClick={() => setEditing(true)}>Configure chargers</Button> : undefined}
              />
            ) : (
              <>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full">
                    <thead className="border-b border-ink-200">
                      <tr>
                        <th className="th">Charger</th>
                        <th className="th text-right">Qty</th>
                        <th className="th text-right">Unit price</th>
                        <th className="th text-right">Base</th>
                        <th className="th text-right">GST</th>
                        <th className="th text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {quote.lines.map((l) => (
                        <tr key={l.key}>
                          <td className="td font-medium">
                            {l.label}
                            {l.oem && <span className="ml-1 text-xs font-normal text-ink-500">· {l.oem}</span>}
                            {l.overridden && (
                              <span className="ml-1 text-xs font-normal text-amber-700">
                                (list {formatINR(l.catalogueUnitBase ?? 0)})
                              </span>
                            )}
                          </td>
                          <td className="td text-right tabular-nums">{l.qty}</td>
                          <td className="td text-right tabular-nums">{formatINR(l.unitBase)}</td>
                          <td className="td text-right tabular-nums">{formatINR(l.base)}</td>
                          <td className="td text-right tabular-nums text-ink-500">
                            {formatINR(l.gst)}
                            <span className="ml-1 text-[10px] text-ink-400">{l.gstPct}%</span>
                          </td>
                          <td className="td text-right font-semibold tabular-nums">{formatINR(l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-ink-200">
                      <tr>
                        <td className="td font-semibold" colSpan={3}>
                          {quote.unitCount} unit{quote.unitCount === 1 ? "" : "s"} · {quote.totalKw} kW
                        </td>
                        <td className="td text-right font-semibold tabular-nums">{formatINR(quote.subtotal)}</td>
                        <td className="td text-right font-semibold tabular-nums">{formatINR(quote.gst)}</td>
                        <td className="td text-right text-base font-bold tabular-nums text-brand-700">{formatINR(quote.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {quote.discount > 0 && (
                  <p className="mt-2 text-sm text-rose-600">
                    A discount of {formatINR(quote.discount)} has been applied to the pre-GST value.
                  </p>
                )}

                <div className="mt-5">
                  <p className="label">Payment schedule</p>
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full">
                      <thead className="border-b border-ink-200">
                        <tr>
                          <th className="th">Milestone</th>
                          <th className="th text-right">Base</th>
                          <th className="th text-right">GST</th>
                          <th className="th text-right">Payable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {quote.milestones.map((m) => (
                          <tr key={m.key}>
                            <td className="td">{m.label}</td>
                            <td className="td text-right tabular-nums">{formatINR(m.base)}</td>
                            <td className="td text-right tabular-nums text-ink-500">{formatINR(m.gst)}</td>
                            <td className="td text-right font-semibold tabular-nums">{formatINR(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </Card>

          <div className="space-y-4">
            <Card title="Projected returns" subtitle="From the Livanto investment model">
              <dl className="space-y-3">
                <Detail label="Projected monthly income" value={formatINR(quote.projected.monthlyIncome)} />
                <Detail label="Assured minimum (24 months)" value={formatINR(quote.projected.assuredMinMonthly)} />
                <Detail label="Projected annual income" value={formatINR(quote.projected.annualIncome)} />
                <Detail label="Payback period" value={quote.projected.paybackMonths ? `${quote.projected.paybackMonths.toFixed(1)} months` : "—"} />
                <Detail label="Annual ROI" value={`${quote.projected.roiPct}%`} />
                <Detail label="Units dispensed / month" value={`${formatNumber(quote.projected.unitsPerMonth)} kWh`} />
              </dl>
            </Card>

            <Card title="If bank funded" subtitle="70% LTV at 9% p.a.">
              <dl className="space-y-3">
                <Detail label="Down payment" value={formatINR(quote.financing.downPayment)} />
                <Detail label="Loan amount" value={formatINR(quote.financing.loanAmount)} />
              </dl>
              <table className="mt-3 w-full">
                <thead className="border-b border-ink-200">
                  <tr><th className="th">Tenure</th><th className="th text-right">EMI</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {quote.financing.emis.map((e) => (
                    <tr key={e.years}>
                      <td className="td">{e.years} years</td>
                      <td className="td text-right font-medium tabular-nums">{formatINR(e.emi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}

      {tab === "Financing" && actor && (
        <FinancingPanel lead={lead} actor={actor} viewer={viewer} canEdit={editable} />
      )}

      {tab === "Letter of Intent" && actor && (
        <EoiPanel lead={lead} actor={actor} viewer={viewer} canEdit={editable} />
      )}

      {tab === "Payments" && actor && (
        <PaymentsPanel lead={lead} actor={actor} viewer={viewer} canEdit={editable} onSummary={onSummary} />
      )}

      {tab === "Documents" && actor && (
        <DocumentsPanel lead={lead} actor={actor} viewer={viewer} canEdit={editable} onKyc={onKyc} />
      )}

      {tab === "Tasks" && actor && (
        <TasksPanel lead={lead} actor={actor} canEdit={editable} />
      )}

      {tab === "Activity" && actor && (
        <ActivityPanel lead={lead} actor={actor} canEdit={editable} />
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this lead"
        description="Rejected leads stay in the system for reporting and can be reopened by an admin."
        footer={
          <>
            <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await rejectLead(lead, reason, reasonNote.trim(), actor!);
                  setRejectOpen(false);
                  setReasonNote("");
                }, "Lead rejected.")
              }
            >
              Reject lead
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reason" required>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value as RejectionReason)}
              options={REJECTION_REASONS.map((r) => ({ value: r, label: REJECTION_LABEL[r] }))}
            />
          </Field>
          <Field label="Details" hint="Context helps the team learn what is not working.">
            <Textarea rows={3} value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign lead"
        description="The change is recorded in the audit log with both names."
        footer={
          <>
            <Button onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  const u = users.find((x) => x.uid === newOwner);
                  if (!u) throw new Error("Choose an agent.");
                  await reassignLead(lead, u.uid, u.name, actor!);
                  if (u.uid !== actor!.uid) {
                    notifyAssigned({
                      toUid: u.uid,
                      toEmail: u.email,
                      agentName: u.name,
                      leadCode: lead.code,
                      leadName: lead.client?.name,
                      actorName: actor!.name,
                      leadId: lead.id,
                    });
                  }
                  setReassignOpen(false);
                }, "Lead reassigned.")
              }
            >
              Reassign
            </Button>
          </>
        }
      >
        <Field label="Assign to" required>
          <Select
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="Select an agent"
            options={users.map((u) => ({ value: u.uid, label: `${u.name} — ${u.role.replace("_", " ").toLowerCase()}` }))}
          />
        </Field>
      </Modal>
    </>
  );
}
