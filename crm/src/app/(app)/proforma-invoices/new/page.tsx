"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ChargerConfigurator } from "@/components/charger-configurator";
import {
  Button, Card, Field, Input, PageHeader, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import type { GstMode } from "@/lib/constants";
import { getLead } from "@/lib/db/leads";
import { createProformaInvoice } from "@/lib/db/proforma-invoices";
import { buildQuote, type ConfigItem, type ExtraItem } from "@/lib/pricing";
import { canApplyDiscount, canManageProformaInvoices, canOverridePrice } from "@/lib/permissions";
import type { ClientInfo } from "@/lib/types";
import { formatINR } from "@/lib/utils";

const blankClient: ClientInfo = { name: "", phone: "", email: "", company: "", city: "", state: "", address: "", gstin: "" };

function NewProformaInvoiceInner() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");
  const { busy, run } = useAsyncAction();
  const { settings } = useSettings();

  const [client, setClient] = useState<ClientInfo>(blankClient);
  const [leadCode, setLeadCode] = useState<string | null>(null);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [gstMode, setGstMode] = useState<GstMode>(settings.finance.defaultGstMode);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingLead, setLoadingLead] = useState(!!leadId);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    getLead(leadId).then((lead) => {
      if (cancelled || !lead) return;
      setClient(lead.client);
      setLeadCode(lead.code);
      setItems(lead.config);
      if (lead.gstMode) setGstMode(lead.gstMode);
    }).finally(() => { if (!cancelled) setLoadingLead(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  if (!canManageProformaInvoices(viewer)) {
    return <p className="text-sm text-ink-500">You don't have permission to create proforma invoices.</p>;
  }

  const quote = buildQuote(items, { discount, extras });

  async function submit() {
    if (!actor || !client.name.trim() || !client.phone.trim()) return;
    await run(async () => {
      const { id } = await createProformaInvoice({
        leadId: leadId ?? null,
        leadCode,
        client,
        items,
        extras,
        discount,
        gstMode,
        validUntil: validUntil ? new Date(validUntil) : null,
        notes,
      }, actor);
      router.push(`/proforma-invoices/${id}`);
    }, "Proforma invoice created.");
  }

  if (loadingLead) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }

  return (
    <>
      <PageHeader
        title="New proforma invoice"
        description={leadCode ? `Prefilled from lead ${leadCode} — client details can still be edited below.` : "For a client who needs a formal bill ahead of the tax invoice — doesn't need to be an existing lead."}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Client details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={client.name} onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))} />
              </Field>
              <Field label="Phone" required>
                <Input value={client.phone} onChange={(e) => setClient((c) => ({ ...c, phone: e.target.value }))} />
              </Field>
              <Field label="Company">
                <Input value={client.company ?? ""} onChange={(e) => setClient((c) => ({ ...c, company: e.target.value }))} />
              </Field>
              <Field label="Email">
                <Input value={client.email ?? ""} onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))} />
              </Field>
              <Field label="City">
                <Input value={client.city} onChange={(e) => setClient((c) => ({ ...c, city: e.target.value }))} />
              </Field>
              <Field label="GSTIN">
                <Input value={client.gstin ?? ""} onChange={(e) => setClient((c) => ({ ...c, gstin: e.target.value }))} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={client.address ?? ""} onChange={(e) => setClient((c) => ({ ...c, address: e.target.value }))} />
              </Field>
            </div>
          </Card>

          <Card title="Chargers & services">
            <ChargerConfigurator
              value={items}
              onChange={setItems}
              extras={extras}
              onExtrasChange={setExtras}
              discount={discount}
              onDiscountChange={setDiscount}
              allowDiscount={canApplyDiscount(viewer)}
              allowPriceOverride={canOverridePrice(viewer)}
              gstMode={gstMode}
              onGstModeChange={setGstMode}
            />
          </Card>

          <Card title="Terms">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid until" hint="Optional — shown on the printed proforma invoice.">
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes" className="mt-4">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes, or terms to show on the proforma invoice." />
            </Field>
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(quote.subtotal)}</dd></div>
              {quote.discount > 0 && (
                <div className="flex justify-between"><dt className="text-ink-600">Discount</dt><dd className="tabular-nums text-rose-600">−{formatINR(quote.discount)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(quote.gst)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(quote.grandTotal)}</dd></div>
            </dl>
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={!client.name.trim() || !client.phone.trim() || (items.length === 0 && extras.length === 0)}
              onClick={() => void submit()}
            >
              Create proforma invoice
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function NewProformaInvoicePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewProformaInvoiceInner />
    </Suspense>
  );
}
