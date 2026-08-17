/**
 * Additive custom-automation layer on top of the hardcoded triggers in
 * auto-triggers.ts / tickets.ts / wallet.ts. Those keep running exactly as
 * before — this only lets a Super Admin attach *extra* actions at the same
 * four trigger points (charger offline, session completed, wallet low
 * balance, ticket SLA breach) without touching the already-verified
 * hardcoded logic. Rules live in Firestore (`workflowRules`, authored from
 * the CRM's /workflows page) and are read fresh on every fire — small fleet
 * size, no caching needed yet. Every call site treats this as best-effort:
 * a broken or slow custom rule must never block or fail the hardcoded path
 * that fired it.
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { openTicketIfNeeded } from "./tickets.js";
import { sendCommand } from "./ocpp/commands.js";
import { dispatchWebhookSafe } from "./webhooks.js";

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
}

export interface WorkflowContext {
  chargePointId?: string;
  zoneId?: string | null;
  ownerType?: "EMSP_USER" | "CORPORATE_ACCOUNT";
  ownerId?: string;
  balanceInr?: number;
  ticketId?: string;
  [key: string]: unknown;
}

export const WORKFLOW_RULES = "workflowRules";

async function activeRulesFor(type: WorkflowTriggerType): Promise<WorkflowRule[]> {
  const snap = await db().collection(WORKFLOW_RULES)
    .where("active", "==", true)
    .where("trigger.type", "==", type)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkflowRule, "id">) }));
}

/**
 * A rule can optionally narrow itself with trigger.params.chargePointId /
 * .zoneId (scope to one charger or one site) — undefined means "any", which
 * is what most rules will use. Not a general expression language on
 * purpose: the four trigger points already carry the fields most rules
 * need, and a real query language is more machinery than this needs yet.
 */
function ruleMatches(rule: WorkflowRule, ctx: WorkflowContext): boolean {
  const params = rule.trigger.params ?? {};
  if (params.chargePointId && params.chargePointId !== ctx.chargePointId) return false;
  if (params.zoneId && params.zoneId !== ctx.zoneId) return false;
  if (typeof params.minBalanceInr === "number" && typeof ctx.balanceInr === "number" && ctx.balanceInr > params.minBalanceInr) return false;
  return true;
}

async function runAction(action: WorkflowAction, ctx: WorkflowContext, rule: WorkflowRule): Promise<void> {
  try {
    switch (action.type) {
      case "CREATE_TICKET": {
        if (!ctx.chargePointId) return;
        const description = (action.params?.description as string) || `Workflow "${rule.name}" opened this ticket.`;
        await openTicketIfNeeded(ctx.chargePointId, "MANUAL", description);
        return;
      }
      case "NOTIFY_NOC":
      case "NOTIFY_TECHNICIAN": {
        const roles = action.type === "NOTIFY_NOC" ? ["SUPER_ADMIN", "ADMIN", "OPERATIONS"] : ["OPERATIONS"];
        const [byPrimary, byRoles] = await Promise.all([
          db().collection("users").where("role", "in", roles).get(),
          db().collection("users").where("roles", "array-contains-any", roles).get(),
        ]);
        const uids = new Set([...byPrimary.docs, ...byRoles.docs].map((d) => d.id));
        if (uids.size === 0) return;
        const batch = db().batch();
        for (const uid of uids) {
          const ref = db().collection("notifications").doc();
          batch.set(ref, {
            uid,
            title: `Workflow: ${rule.name}`,
            body: (action.params?.message as string) || `Triggered for ${ctx.chargePointId ?? ctx.ownerId ?? "—"}.`,
            href: "/workflows",
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        return;
      }
      case "ATTEMPT_RESET": {
        if (!ctx.chargePointId) return;
        await sendCommand(ctx.chargePointId, "Reset", { type: "OnIdle" }, { timeoutMs: 10_000, maxRetries: 0 }).catch(() => undefined);
        return;
      }
      case "SEND_EMAIL": {
        const to = action.params?.to as string | undefined;
        if (!to) return;
        await db().collection("mail").add({
          to: [to],
          message: {
            subject: (action.params?.subject as string) || `Livanto Green workflow: ${rule.name}`,
            html: (action.params?.html as string) || `<p>Workflow "${rule.name}" fired for ${ctx.chargePointId ?? ctx.ownerId ?? "—"}.</p>`,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
        return;
      }
      case "WEBHOOK": {
        dispatchWebhookSafe("workflow.custom", { ruleId: rule.id, rule: rule.name, ...ctx });
        return;
      }
    }
  } catch (err) {
    console.error(`[workflow-engine] action ${action.type} failed for rule ${rule.id}:`, err);
  }
}

/** Call from each of the four hardcoded trigger points, alongside (never instead of) their existing behavior. */
export async function fireWorkflowTrigger(type: WorkflowTriggerType, ctx: WorkflowContext): Promise<void> {
  try {
    const rules = await activeRulesFor(type);
    for (const rule of rules) {
      if (!ruleMatches(rule, ctx)) continue;
      for (const action of rule.actions ?? []) {
        await runAction(action, ctx, rule);
      }
    }
  } catch (err) {
    console.error(`[workflow-engine] failed evaluating trigger ${type}:`, err);
  }
}
