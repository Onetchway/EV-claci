"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { subscribeCorporateAccounts } from "@/lib/db/emsp-users";
import { createFleet, subscribeFleets } from "@/lib/db/fleets";
import { canManageFleets } from "@/lib/permissions";
import type { CorporateAccount, Fleet } from "@/lib/types";

export default function FleetsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageFleets(viewer);
  const { run, busy } = useAsyncAction();

  const [fleets, setFleets] = useState<Fleet[] | null>(null);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");

  useEffect(() => subscribeFleets(setFleets), []);
  useEffect(() => subscribeCorporateAccounts(setAccounts), []);

  async function submit() {
    if (!actor || !name.trim()) return;
    await run(async () => {
      await createFleet({ name: name.trim(), corporateAccountId: accountId || null }, actor);
      setName(""); setAccountId(""); setOpen(false);
    }, "Fleet created.");
  }

  return (
    <>
      <PageHeader
        title="Fleet Management"
        description="Fleet operators, their vehicles, and their drivers."
        actions={canManage && <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New fleet</Button>}
      />

      {fleets === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : fleets.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="No fleets yet" action={canManage && <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New fleet</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fleets.map((f) => (
            <Link key={f.id} href={`/fleets/${f.id}`}>
              <Card title={f.name} className="transition hover:ring-2 hover:ring-brand-300">
                <p className="text-sm text-ink-500">View vehicles &amp; drivers →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New fleet"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>Create</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Fleet name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Logistics — Delhi fleet" /></Field>
          <Field label="Corporate account" hint="Optional — link this fleet's billing to a corporate account.">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="None" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
