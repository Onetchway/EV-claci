"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Landmark, Search } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import { ExportButton } from "@/components/data-transfer";
import {
  Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, ProgressBar,
  Select, Spinner, StatCard,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import {
  FUNDING_MODE_LABEL, LOAN_STAGES, LOAN_STAGE_COLOR, LOAN_STAGE_LABEL,
  STAGE_META, type LoanStage,
} from "@/lib/constants";
import { LOAN_COLUMNS } from "@/lib/exports";
import { canExport } from "@/lib/permissions";
import { emiFor } from "@/lib/pricing";
import type { Lead } from "@/lib/types";
import { cn, formatCompactINR, formatDate, formatINR } from "@/lib/utils";

/**
 * The loan book — every lead that involves a bank, in one place.
 *
 * Kept separate from the sales pipeline on purpose: a deal at Agreement whose
 * loan is stuck in review needs chasing at the bank, not at the client, and a
 * combined view hides that distinction.
 */
export default function LoansPage() {
  const viewer = useViewer();
  const { leads, loading } = useLeads(useMemo(() => ({ max: 500 }), []));

  const [stage, setStage] = useState<LoanStage | "">("");
  const [bank, setBank] = useState("");
  const [search, setSearch] = useState("");

  const financed = useMemo(
    () => leads.filter((l) => l.financing && l.financing.mode !== "SELF"),
    [leads],
  );

  const banks = useMemo(
    () => [...new Set(financed.map((l) => l.financing?.bank).filter(Boolean) as string[])].sort(),
    [financed],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return financed
      .filter((l) => !stage || l.financing?.stage === stage)
      .filter((l) => !bank || l.financing?.bank === bank)
      .filter((l) => {
        if (!needle) return true;
        const hay = [
          l.code, l.client?.name, l.client?.phone, l.client?.city,
          l.financing?.bank, l.financing?.applicationNo, l.financing?.relationshipManager,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => (b.financing?.sanctionedAmount ?? 0) - (a.financing?.sanctionedAmount ?? 0));
  }, [financed, stage, bank, search]);

  const stats = useMemo(() => {
    const sum = (pick: (l: Lead) => number | null | undefined) =>
      rows.reduce((a, l) => a + (pick(l) ?? 0), 0);
    const sanctioned = sum((l) => l.financing?.sanctionedAmount);
    const disbursed = sum((l) => l.financing?.disbursedAmount);
    return {
      count: rows.length,
      requested: sum((l) => l.financing?.requestedAmount),
      sanctioned,
      disbursed,
      pendingDisbursal: Math.max(0, sanctioned - disbursed),
      awaiting: rows.filter((l) =>
        ["ENQUIRY", "DOCUMENTS_COLLECTED", "APPLIED", "UNDER_REVIEW"].includes(l.financing?.stage ?? ""),
      ).length,
      rejected: rows.filter((l) => l.financing?.stage === "REJECTED").length,
    };
  }, [rows]);

  const byStage = useMemo(
    () => LOAN_STAGES.map((s) => ({ stage: s, count: rows.filter((l) => l.financing?.stage === s).length })),
    [rows],
  );

  const byBank = useMemo(() => {
    const map = new Map<string, { bank: string; count: number; sanctioned: number; disbursed: number }>();
    for (const l of rows) {
      const key = l.financing?.bank || "Not recorded";
      const row = map.get(key) ?? { bank: key, count: 0, sanctioned: 0, disbursed: 0 };
      row.count += 1;
      row.sanctioned += l.financing?.sanctionedAmount ?? 0;
      row.disbursed += l.financing?.disbursedAmount ?? 0;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.sanctioned - a.sanctioned);
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Loan customers"
        description="Every client funding their participation through a bank, and where each application stands."
        actions={
          canExport(viewer) && (
            <ExportButton
              filename="livanto-loan-book"
              sheetName="Loan book"
              columns={LOAN_COLUMNS}
              rows={rows}
            />
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Loan customers" value={stats.count} icon={<Landmark className="h-4 w-4" />} />
        <StatCard label="Sanctioned" value={formatCompactINR(stats.sanctioned)} tone="positive" />
        <StatCard label="Disbursed" value={formatCompactINR(stats.disbursed)} />
        <StatCard
          label="Awaiting disbursal"
          value={formatCompactINR(stats.pendingDisbursal)}
          tone={stats.pendingDisbursal ? "warn" : "default"}
        />
        <StatCard
          label="With the bank"
          value={stats.awaiting}
          sub={stats.rejected ? `${stats.rejected} rejected` : undefined}
          tone={stats.rejected ? "negative" : "default"}
        />
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, phone, bank, application number or RM…"
            className="pl-9"
          />
        </div>
        <Select
          value={stage}
          onChange={(e) => setStage(e.target.value as LoanStage | "")}
          className="w-auto"
          placeholder="All loan stages"
          options={LOAN_STAGES.map((s) => ({ value: s, label: LOAN_STAGE_LABEL[s] }))}
        />
        <Select
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="w-auto"
          placeholder="All banks"
          options={banks.map((b) => ({ value: b, label: b }))}
        />
      </div>

      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {byStage.filter((s) => s.count > 0).map((s) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => setStage(stage === s.stage ? "" : s.stage)}
              className={cn("chip ring-inset transition", LOAN_STAGE_COLOR[s.stage], stage === s.stage && "ring-2 ring-ink-900")}
            >
              {LOAN_STAGE_LABEL[s.stage]}: {s.count}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-8 w-8" />}
          title="No loan customers yet"
          description="Leads appear here once their funding mode is set to a bank loan on the Financing tab."
          action={<Link href="/leads"><Button>Go to leads</Button></Link>}
        />
      ) : (
        <div className="space-y-4">
          <Card title="Loan book" subtitle={`${rows.length} customer${rows.length === 1 ? "" : "s"}`}>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200">
                  <tr>
                    <th className="th">Client</th>
                    <th className="th">Bank</th>
                    <th className="th">Loan stage</th>
                    <th className="th text-right">Deal value</th>
                    <th className="th text-right">Sanctioned</th>
                    <th className="th text-right">Disbursed</th>
                    <th className="th text-right">Indicative EMI</th>
                    <th className="th">Sales stage</th>
                    <th className="th">Agent</th>
                    <th className="th">Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((l) => {
                    const f = l.financing!;
                    const principal = f.sanctionedAmount ?? f.requestedAmount ?? 0;
                    const emi = principal
                      ? emiFor(principal, (f.interestRate ?? 9) / 100, f.tenureYears ?? 5)
                      : 0;
                    return (
                      <tr key={l.id} className="hover:bg-ink-50">
                        <td className="td">
                          <Link href={`/leads/${l.id}`} className="block">
                            <span className="font-medium text-ink-900 hover:text-brand-700">
                              {l.client?.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-ink-500">
                              {l.code} · {l.client?.phone} · {l.client?.city}
                            </span>
                          </Link>
                        </td>
                        <td className="td">
                          <span className="block text-ink-800">{f.bank || "—"}</span>
                          <span className="block text-xs text-ink-500">
                            {FUNDING_MODE_LABEL[f.mode]}
                            {f.applicationNo ? ` · ${f.applicationNo}` : ""}
                          </span>
                        </td>
                        <td className="td">
                          <Badge className={LOAN_STAGE_COLOR[f.stage]}>{LOAN_STAGE_LABEL[f.stage]}</Badge>
                        </td>
                        <td className="td text-right tabular-nums">{formatINR(l.value)}</td>
                        <td className="td text-right font-medium tabular-nums">
                          {f.sanctionedAmount ? formatINR(f.sanctionedAmount) : "—"}
                        </td>
                        <td className="td text-right tabular-nums">
                          {f.disbursedAmount ? formatINR(f.disbursedAmount) : "—"}
                        </td>
                        <td className="td text-right tabular-nums text-ink-600">
                          {emi ? formatINR(emi) : "—"}
                        </td>
                        <td className="td">
                          <Badge className={STAGE_META[l.stage].color}>{STAGE_META[l.stage].short}</Badge>
                        </td>
                        <td className="td">
                          <span className="flex items-center gap-1.5">
                            <Avatar name={l.ownerName} size={20} />
                            <span className="text-ink-700">{l.ownerName}</span>
                          </span>
                        </td>
                        <td className="td text-ink-500">{formatDate(f.appliedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="By lender" subtitle="Where the book sits, and how much has actually landed.">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200">
                  <tr>
                    <th className="th">Bank</th>
                    <th className="th text-right">Customers</th>
                    <th className="th text-right">Sanctioned</th>
                    <th className="th text-right">Disbursed</th>
                    <th className="th w-40">Disbursed of sanctioned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {byBank.map((b) => (
                    <tr key={b.bank}>
                      <td className="td font-medium">{b.bank}</td>
                      <td className="td text-right tabular-nums">{b.count}</td>
                      <td className="td text-right tabular-nums">{formatINR(b.sanctioned)}</td>
                      <td className="td text-right tabular-nums">{formatINR(b.disbursed)}</td>
                      <td className="td">
                        <ProgressBar pct={b.sanctioned ? (b.disbursed / b.sanctioned) * 100 : 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
