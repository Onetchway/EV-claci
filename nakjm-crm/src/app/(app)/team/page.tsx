"use client";

import { useEffect, useState } from "react";
import { Plus, Users2 } from "lucide-react";

import {
  Avatar, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import { DEPARTMENTS, type Department } from "@/lib/constants";
import { createTeamMember, subscribeTeamMembers } from "@/lib/db/team-members";
import type { TeamMember } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const EMPTY = { name: "", email: "", phone: "", designation: "", department: "SITE" as Department, joinedDate: "" };

export default function TeamPage() {
  const [rows, setRows] = useState<TeamMember[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeTeamMembers({}, setRows), []);

  async function onCreate() {
    if (!form.name.trim()) return;
    await run(async () => {
      await createTeamMember({
        ...form,
        joinedDate: form.joinedDate ? new Date(form.joinedDate) : null,
      });
      setShowForm(false);
      setForm(EMPTY);
    }, "Team member added.");
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="NAKJM staff who get assigned to projects."
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Team Member</Button>}
      />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users2 className="h-8 w-8" />} title="No team members yet" />
      ) : (
        <div className="table-wrapper overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Designation</th>
                <th className="th">Department</th>
                <th className="th">Email</th>
                <th className="th">Phone</th>
                <th className="th">Joined</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-ink-100">
                  <td className="td"><span className="flex items-center gap-2"><Avatar name={m.name} size={26} /> {m.name}</span></td>
                  <td className="td">{m.designation || "—"}</td>
                  <td className="td capitalize">{m.department.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="td">{m.email || "—"}</td>
                  <td className="td">{m.phone || "—"}</td>
                  <td className="td">{formatDate(m.joinedDate)}</td>
                  <td className="td">
                    <Badge className={m.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                      {m.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Team Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()} loading={busy}>Add Member</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} /></Field>
          <Field label="Department">
            <Select
              value={form.department}
              options={DEPARTMENTS.map((d) => ({ value: d, label: d.replace(/_/g, " ") }))}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as Department }))}
            />
          </Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Joined Date" className="col-span-2">
            <Input type="date" value={form.joinedDate} onChange={(e) => setForm((f) => ({ ...f, joinedDate: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
