"use client";

/**
 * Phase 5 workflow engine — custom automation rules a Super Admin/Admin
 * attaches on top of (never instead of) the hardcoded automation in
 * Auto Triggers. Evaluated server-side by ocpp-server (see
 * ocpp-server/src/workflow-engine.ts) at the same four points that logic
 * already fires: charger offline, session completed, wallet low balance,
 * ticket SLA breach.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { logChangeSafe } from "./change-log";
import type { Actor } from "../types";

export const WORKFLOW_RULES = "workflowRules";

export type WorkflowTriggerType =
  | "CHARGER_OFFLINE" | "SESSION_COMPLETED" | "WALLET_LOW_BALANCE" | "TICKET_SLA_BREACH";

export type WorkflowActionType =
  | "CREATE_TICKET" | "NOTIFY_NOC" | "ATTEMPT_RESET" | "NOTIFY_TECHNICIAN" | "SEND_EMAIL" | "WEBHOOK";

export interface WorkflowAction {
  type: WorkflowActionType;
  params?: Record<string, unknown>;
}

export interface WorkflowRule {
  id: string;
  name: string;
  active: boolean;
  trigger: { type: WorkflowTriggerType; params?: Record<string, unknown> };
  actions: WorkflowAction[];
  createdAt?: unknown;
  createdBy?: Actor;
}

export const WORKFLOW_TRIGGER_LABEL: Record<WorkflowTriggerType, string> = {
  CHARGER_OFFLINE: "Charger goes offline",
  SESSION_COMPLETED: "Charging session completes",
  WALLET_LOW_BALANCE: "Wallet balance crosses the low-balance threshold",
  TICKET_SLA_BREACH: "Open ticket breaches its SLA",
};

export const WORKFLOW_ACTION_LABEL: Record<WorkflowActionType, string> = {
  CREATE_TICKET: "Open a ticket",
  NOTIFY_NOC: "Notify NOC (Super Admin/Admin/Operations)",
  ATTEMPT_RESET: "Attempt a non-disruptive Reset(OnIdle)",
  NOTIFY_TECHNICIAN: "Notify Operations",
  SEND_EMAIL: "Send an email",
  WEBHOOK: "Fire a webhook (workflow.custom)",
};

function mapRule(id: string, data: Record<string, unknown>): WorkflowRule {
  return { id, ...(data as Omit<WorkflowRule, "id">) };
}

export function subscribeWorkflowRules(
  cb: (rows: WorkflowRule[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), WORKFLOW_RULES), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapRule(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type WorkflowRuleDraft = Pick<WorkflowRule, "name" | "active" | "trigger" | "actions">;

export async function createWorkflowRule(draft: WorkflowRuleDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), WORKFLOW_RULES), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  logChangeSafe({ entityType: "WORKFLOW_RULE", entityId: ref.id, entityLabel: draft.name, action: "CREATE", actor });
  return ref.id;
}

export async function updateWorkflowRule(id: string, draft: WorkflowRuleDraft, actor?: Actor): Promise<void> {
  await updateDoc(doc(getDb(), WORKFLOW_RULES, id), { ...draft });
  if (actor) logChangeSafe({ entityType: "WORKFLOW_RULE", entityId: id, entityLabel: draft.name, action: "UPDATE", actor });
}

export async function setWorkflowRuleActive(id: string, active: boolean, actor?: Actor, name?: string): Promise<void> {
  await updateDoc(doc(getDb(), WORKFLOW_RULES, id), { active });
  if (actor) logChangeSafe({ entityType: "WORKFLOW_RULE", entityId: id, entityLabel: name ?? id, action: active ? "ACTIVATE" : "DEACTIVATE", actor });
}

export async function deleteWorkflowRule(id: string, actor?: Actor, name?: string): Promise<void> {
  await deleteDoc(doc(getDb(), WORKFLOW_RULES, id));
  if (actor) logChangeSafe({ entityType: "WORKFLOW_RULE", entityId: id, entityLabel: name ?? id, action: "DELETE", actor });
}
