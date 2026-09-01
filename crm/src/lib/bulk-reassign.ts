"use client";

/**
 * Fixes up ownership on leads that already exist in the CRM — matched by
 * phone number — for exactly the situation an import leaves behind when the
 * sheet's agent names didn't resolve to a team member at import time (the
 * import runs once; this repairs the result without re-creating leads).
 */

import { findLeadsByPhone, reassignLead } from "./db/leads";
import { matchAgent } from "./lead-import";
import type { Actor, AppUser } from "./types";
import { normalisePhone } from "./utils";

export interface ReassignRow {
  phone: string;
  agentName: string;
}

export interface ReassignOutcome {
  phone: string;
  agentName: string;
  status: "updated" | "already-correct" | "no-lead" | "no-agent-match" | "invalid-phone";
  leadCode?: string;
}

export async function bulkReassignByPhone(
  rows: ReassignRow[],
  agents: AppUser[],
  actor: Actor,
  onProgress?: (done: number, total: number) => void,
): Promise<ReassignOutcome[]> {
  const outcomes: ReassignOutcome[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const phone = normalisePhone(row.phone);

    if (!phone || phone.length !== 10) {
      outcomes.push({ ...row, status: "invalid-phone" });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    const agent = matchAgent(row.agentName, agents);
    if (!agent) {
      outcomes.push({ ...row, status: "no-agent-match" });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    const leads = await findLeadsByPhone(phone);
    if (leads.length === 0) {
      outcomes.push({ ...row, status: "no-lead" });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    for (const lead of leads) {
      if (lead.ownerId === agent.uid) {
        outcomes.push({ ...row, status: "already-correct", leadCode: lead.code });
        continue;
      }
      await reassignLead(lead, agent.uid, agent.name, actor);
      outcomes.push({ ...row, status: "updated", leadCode: lead.code });
    }
    onProgress?.(i + 1, rows.length);
  }

  return outcomes;
}
