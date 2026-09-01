"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Upload, UserCog } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Card, Modal, useAsyncAction, useToast } from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import { bulkReassignByPhone, type ReassignOutcome } from "@/lib/bulk-reassign";
import { readSpreadsheet } from "@/lib/spreadsheet";

const STATUS_LABEL: Record<ReassignOutcome["status"], string> = {
  updated: "Reassigned",
  "already-correct": "Already correct",
  "no-lead": "No lead found with this phone",
  "no-agent-match": "No team member matches this name",
  "invalid-phone": "Invalid phone number",
};

/**
 * Repairs ownership on leads already in the CRM, matched by phone — for
 * cleaning up an import that landed with the wrong owner because the sheet's
 * agent names didn't resolve to a team member at the time. Expects a CSV/XLSX
 * with a "Phone" column and an "Agent" column; nothing else is required.
 */
export function BulkReassignButton() {
  const { actor } = useAuth();
  const { users: agents } = useAgents();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<ReassignOutcome[] | null>(null);

  async function handleFile(file: File) {
    const { headers, rows } = await readSpreadsheet(file);
    const phoneKey = headers.find((h) => /phone/i.test(h));
    const agentKey = headers.find((h) => /agent|owner/i.test(h));
    if (!phoneKey || !agentKey) {
      push("The file needs a “Phone” column and an “Agent” column.", "error");
      return;
    }

    const parsed = rows
      .map((r) => ({ phone: r[phoneKey] ?? "", agentName: r[agentKey] ?? "" }))
      .filter((r) => r.phone.trim());

    if (parsed.length === 0) {
      push("No rows with a phone number were found.", "error");
      return;
    }

    setOutcomes(null);
    setProgress({ done: 0, total: parsed.length });
    await run(async () => {
      const result = await bulkReassignByPhone(parsed, agents, actor!, (done, total) => setProgress({ done, total }));
      setOutcomes(result);
    }, "Bulk reassign complete.");
  }

  const summary = outcomes
    ? {
        updated: outcomes.filter((o) => o.status === "updated").length,
        skipped: outcomes.filter((o) => o.status !== "updated" && o.status !== "already-correct").length,
      }
    : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserCog className="h-4 w-4" /> Fix agent assignment
      </Button>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setOutcomes(null); setProgress(null); }}
        title="Fix agent assignment"
        description="Upload a CSV/XLSX with Phone and Agent columns. Matches existing leads by phone and corrects their owner — nothing is created or duplicated."
        wide
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
          />
          <Button onClick={() => inputRef.current?.click()} loading={busy}>
            <Upload className="h-4 w-4" /> Choose file
          </Button>

          {progress && (
            <p className="text-sm text-ink-600">
              {busy ? `Processing ${progress.done} / ${progress.total}…` : `Processed ${progress.total} rows.`}
            </p>
          )}

          {summary && (
            <Card>
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {summary.updated} lead{summary.updated === 1 ? "" : "s"} reassigned
              </p>
              {summary.skipped > 0 && (
                <p className="mt-1 text-sm text-ink-600">{summary.skipped} rows skipped — see below.</p>
              )}
              {outcomes && outcomes.some((o) => o.status !== "updated") && (
                <div className="mt-3 max-h-64 overflow-y-auto scroll-thin rounded-lg border border-ink-200">
                  <table className="w-full text-sm">
                    <thead className="border-b border-ink-200 bg-ink-50">
                      <tr>
                        <th className="th">Phone</th>
                        <th className="th">Agent (from file)</th>
                        <th className="th">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {outcomes.filter((o) => o.status !== "updated").map((o, i) => (
                        <tr key={i}>
                          <td className="td">{o.phone}</td>
                          <td className="td">{o.agentName}</td>
                          <td className="td text-ink-500">{STATUS_LABEL[o.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>
    </>
  );
}
