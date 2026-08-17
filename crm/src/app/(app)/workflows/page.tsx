"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import {
  createWorkflowRule, deleteWorkflowRule, setWorkflowRuleActive, subscribeWorkflowRules, updateWorkflowRule,
  WORKFLOW_ACTION_LABEL, WORKFLOW_TRIGGER_LABEL,
  type WorkflowAction, type WorkflowActionType, type WorkflowRule, type WorkflowTriggerType,
} from "@/lib/db/workflows";
import { isAdmin } from "@/lib/permissions";

const TRIGGER_TYPES = Object.keys(WORKFLOW_TRIGGER_LABEL) as WorkflowTriggerType[];
const ACTION_TYPES = Object.keys(WORKFLOW_ACTION_LABEL) as WorkflowActionType[];

export default function WorkflowsPage() {
  const { actor, role } = useAuth();
  const canManage = !!role && isAdmin(role);
  const { run, busy } = useAsyncAction();
  const { push } = useToast();

  const [rules, setRules] = useState<WorkflowRule[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowRule | null>(null);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>("CHARGER_OFFLINE");
  const [actions, setActions] = useState<WorkflowAction[]>([{ type: "NOTIFY_NOC" }]);

  useEffect(() => subscribeWorkflowRules(setRules), []);

  if (!canManage) {
    return <EmptyState title="Admins only" description="Workflows are restricted to admins." />;
  }

  function openNew() {
    setEditing(null);
    setName("");
    setTriggerType("CHARGER_OFFLINE");
    setActions([{ type: "NOTIFY_NOC" }]);
    setOpen(true);
  }

  function openEdit(rule: WorkflowRule) {
    setEditing(rule);
    setName(rule.name);
    setTriggerType(rule.trigger.type);
    setActions(rule.actions.length ? rule.actions : [{ type: "NOTIFY_NOC" }]);
    setOpen(true);
  }

  function updateAction(i: number, patch: Partial<WorkflowAction>) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  async function submit() {
    if (!actor || !name.trim()) return;
    const draft = {
      name: name.trim(),
      active: editing?.active ?? true,
      trigger: { type: triggerType },
      actions,
    };
    await run(async () => {
      if (editing) await updateWorkflowRule(editing.id, draft);
      else await createWorkflowRule(draft, actor);
      setOpen(false);
    }, editing ? "Workflow updated." : "Workflow created.");
  }

  async function handleDelete(rule: WorkflowRule) {
    if (!window.confirm(`Delete workflow "${rule.name}"?`)) return;
    try {
      await deleteWorkflowRule(rule.id);
      push("Workflow deleted.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Custom automation attached to the same four points Auto Triggers already fires at — this is additive, not a replacement. Evaluated by the OCPP server on every trigger."
        actions={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New workflow</Button>}
      />

      <Card>
        {rules === null ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<WorkflowIcon className="h-8 w-8" />}
            title="No custom workflows yet"
            description="Attach extra actions — a NOC notification, an auto-reset attempt, an email, a webhook — to charger-offline, session-completed, low-balance, or SLA-breach events."
          />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Trigger</th>
                  <th className="th">Actions</th>
                  <th className="th">Active</th>
                  <th className="th text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50 cursor-pointer" onClick={() => openEdit(r)}>
                    <td className="td font-medium">{r.name}</td>
                    <td className="td text-ink-600">{WORKFLOW_TRIGGER_LABEL[r.trigger.type]}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1">
                        {r.actions.map((a, i) => <Badge key={i}>{WORKFLOW_ACTION_LABEL[a.type]}</Badge>)}
                      </div>
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <Checkbox label="" checked={r.active} onChange={(v) => void setWorkflowRuleActive(r.id, v)} />
                    </td>
                    <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => void handleDelete(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit workflow" : "New workflow"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Escalate offline DC fast chargers" /></Field>
          <Field label="Trigger" required>
            <Select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as WorkflowTriggerType)}
              options={TRIGGER_TYPES.map((t) => ({ value: t, label: WORKFLOW_TRIGGER_LABEL[t] }))}
            />
          </Field>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-700">Actions</span>
              <Button size="sm" variant="ghost" onClick={() => setActions((prev) => [...prev, { type: "NOTIFY_NOC" }])}>
                <Plus className="h-3.5 w-3.5" /> Add action
              </Button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-ink-200 p-2">
                <Select
                  className="flex-1"
                  value={a.type}
                  onChange={(e) => updateAction(i, { type: e.target.value as WorkflowActionType, params: {} })}
                  options={ACTION_TYPES.map((t) => ({ value: t, label: WORKFLOW_ACTION_LABEL[t] }))}
                />
                {a.type === "SEND_EMAIL" && (
                  <Input
                    className="flex-1"
                    placeholder="Recipient email"
                    value={(a.params?.to as string) ?? ""}
                    onChange={(e) => updateAction(i, { params: { ...a.params, to: e.target.value } })}
                  />
                )}
                {a.type === "CREATE_TICKET" && (
                  <Input
                    className="flex-1"
                    placeholder="Ticket description"
                    value={(a.params?.description as string) ?? ""}
                    onChange={(e) => updateAction(i, { params: { ...a.params, description: e.target.value } })}
                  />
                )}
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={actions.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
