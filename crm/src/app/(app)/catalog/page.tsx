"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ChargerConfigurator } from "@/components/charger-configurator";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  useAsyncAction,
} from "@/components/ui";
import { useChargerCatalog } from "@/hooks/use-catalog";
import { BENCHMARKS, CATALOG_LIST, type ChargerSpec } from "@/lib/catalog";
import { addCustomCharger, archiveCustomCharger, type CustomChargerDoc } from "@/lib/db/catalog";
import { canManageCatalog } from "@/lib/permissions";
import type { ConfigItem } from "@/lib/pricing";
import { formatCompactINR, formatINR, formatNumber } from "@/lib/utils";

interface NewChargerDraft {
  chargerType: "AC" | "DC";
  kw: string;
  label: string;
  vehicleType: string;
  minSpaceSqft: string;
  dimensions: string;
  weight: string;
  installation: string;
  operatingTemp: string;
  display: string;
  portType: string;
  powerConnection: string;
  guns: string;
  gunCableLength: string;
  basePrice: string;
  stage1EOI: string;
  stage2Infra: string;
}

const blankChargerDraft: NewChargerDraft = {
  chargerType: "AC",
  kw: "",
  label: "",
  vehicleType: "",
  minSpaceSqft: "",
  dimensions: "",
  weight: "",
  installation: "",
  operatingTemp: "",
  display: "",
  portType: "",
  powerConnection: "",
  guns: "1",
  gunCableLength: "",
  basePrice: "",
  stage1EOI: "",
  stage2Infra: "",
};

/**
 * Reference sheet + a scratch calculator. Agents use this on a call to answer
 * "what would two 120s cost me?" without creating a lead first.
 */
export default function CatalogPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const { custom } = useChargerCatalog();
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [draft, setDraft] = useState<NewChargerDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CustomChargerDoc | null>(null);
  const { busy, run } = useAsyncAction();

  const comparison = useMemo(
    () =>
      CATALOG_LIST.map((s) => {
        const total = Math.round(s.basePrice * 1.18);
        const fd5 = total * Math.pow(1 + BENCHMARKS.fdRate, 5);
        const mf5 = total * Math.pow(1 + BENCHMARKS.mutualFundRate, 5);
        return {
          sku: s.sku,
          label: s.label,
          total,
          fd5,
          mf5,
          livanto5: s.returns.cumulative5Yr,
          multiple: s.returns.cumulative5Yr / fd5,
        };
      }),
    [],
  );

  async function saveCharger() {
    if (!draft || !actor) return;
    const kw = Number(draft.kw);
    const basePrice = Math.round(Number(draft.basePrice) || 0);
    const stage1EOI = Math.round(Number(draft.stage1EOI) || 0);
    const stage2Infra = Math.round(Number(draft.stage2Infra) || 0);
    if (!kw || kw <= 0) throw new Error("Enter the charger's kW rating.");
    if (basePrice <= 0) throw new Error("Enter a price greater than zero.");
    if (stage1EOI + stage2Infra > basePrice) {
      throw new Error("Stage 1 + Stage 2 can't add up to more than the total price.");
    }

    const spec: Omit<ChargerSpec, "sku"> = {
      kw,
      label: draft.label.trim() || `${kw} kW ${draft.chargerType}`,
      chargerType: draft.chargerType,
      vehicleType: draft.vehicleType.trim() || "—",
      minSpaceSqft: draft.minSpaceSqft.trim() || "—",
      dimensions: draft.dimensions.trim() || "—",
      weight: draft.weight.trim() || "—",
      installation: draft.installation.trim() || "—",
      operatingTemp: draft.operatingTemp.trim() || "—",
      display: draft.display.trim() || "—",
      portType: draft.portType.trim() || "—",
      powerConnection: draft.powerConnection.trim() || "—",
      guns: Math.max(1, Math.round(Number(draft.guns) || 1)),
      gunCableLength: draft.gunCableLength.trim() || "—",
      basePrice,
      stage1EOI,
      stage2Infra,
      stage3Commissioning: basePrice - stage1EOI - stage2Infra,
      ops: { vehiclesPerDay: 0, kWhPerSession: 0, billingDaysPerMonth: 30, unitsPerDay: 0, unitsPerMonth: 0 },
      tariff: { endUserRate: 0, discomCost: 0, landownerShare: 0, cpoShare: 0, investorMargin: 0 },
      returns: { monthlyIncome: 0, assuredMinMonthly: 0, annualIncome: 0, paybackMonths: 0, roiPct: 0, cumulative3Yr: 0, cumulative5Yr: 0 },
    };

    await addCustomCharger(spec, actor);
    setDraft(null);
  }

  return (
    <>
      <PageHeader
        title="Charger catalogue & calculator"
        description="Pricing, specifications and modelled returns, straight from the Livanto franchise investment model."
        actions={
          canManageCatalog(viewer) && (
            <Button variant="primary" onClick={() => setDraft({ ...blankChargerDraft })}>
              <Plus className="h-4 w-4" /> Add charger
            </Button>
          )
        }
      />

      <Card
        title="Custom chargers"
        subtitle="Added here, not in the verified investment model — priced manually, GST set per quote line like any other item."
        className="mb-4"
      >
        {custom.length === 0 ? (
          <EmptyState
            title="No custom chargers yet"
            description="AC options like 3.3 kW / 7.4 kW / 11 kW / 30 kW, or anything outside the six DC investment-model chargers, go here."
            action={canManageCatalog(viewer) ? <Button variant="primary" onClick={() => setDraft({ ...blankChargerDraft })}><Plus className="h-4 w-4" /> Add charger</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Charger</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Price (excl. GST)</th>
                  <th className="th text-right">All-in (18% GST)</th>
                  <th className="th text-right">Stage 1</th>
                  <th className="th text-right">Stage 2</th>
                  <th className="th text-right">Stage 3</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {custom.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="td font-semibold">{s.label}</td>
                    <td className="td"><Badge className="bg-ink-100 text-ink-700 ring-ink-200">{s.chargerType}</Badge></td>
                    <td className="td text-right tabular-nums">{formatINR(s.basePrice)}</td>
                    <td className="td text-right font-semibold tabular-nums">{formatINR(Math.round(s.basePrice * 1.18))}</td>
                    <td className="td text-right tabular-nums">{formatINR(s.stage1EOI)}</td>
                    <td className="td text-right tabular-nums">{formatINR(s.stage2Infra)}</td>
                    <td className="td text-right tabular-nums">{formatINR(s.stage3Commissioning)}</td>
                    <td className="td">
                      {canManageCatalog(viewer) && (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(s)}
                          className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${s.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Quick quotation"
        subtitle="Drag chargers in to price a package. Nothing is saved — create a lead to keep it."
        className="mb-4"
      >
        <ChargerConfigurator value={config} onChange={setConfig} />
      </Card>

      <Card title="Investment by charger" className="mb-4">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Option</th>
                <th className="th">Vehicle</th>
                <th className="th text-right">Investment</th>
                <th className="th text-right">GST 18%</th>
                <th className="th text-right">All-in</th>
                <th className="th text-right">Stage 1 (EOI)</th>
                <th className="th text-right">Stage 2</th>
                <th className="th text-right">Stage 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {CATALOG_LIST.map((s) => (
                <tr key={s.sku} className="hover:bg-ink-50">
                  <td className="td font-semibold">{s.label}</td>
                  <td className="td text-ink-600">{s.vehicleType}</td>
                  <td className="td text-right tabular-nums">{formatINR(s.basePrice)}</td>
                  <td className="td text-right tabular-nums text-ink-500">{formatINR(s.basePrice * 0.18)}</td>
                  <td className="td text-right font-semibold tabular-nums">{formatINR(s.basePrice * 1.18)}</td>
                  <td className="td text-right tabular-nums">{formatINR(s.stage1EOI)}</td>
                  <td className="td text-right tabular-nums">{formatINR(s.stage2Infra)}</td>
                  <td className="td text-right tabular-nums">{formatINR(s.stage3Commissioning)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Stage amounts are exclusive of GST and always add back up to the total investment.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Operating assumptions & returns" subtitle="Per charger unit, at modelled utilisation">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Option</th>
                  <th className="th text-right">kWh / mo</th>
                  <th className="th text-right">Margin ₹/unit</th>
                  <th className="th text-right">Monthly</th>
                  <th className="th text-right">Assured</th>
                  <th className="th text-right">Payback</th>
                  <th className="th text-right">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {CATALOG_LIST.map((s) => (
                  <tr key={s.sku}>
                    <td className="td font-semibold">{s.label}</td>
                    <td className="td text-right tabular-nums">{formatNumber(s.ops.unitsPerMonth)}</td>
                    <td className="td text-right tabular-nums">₹{s.tariff.investorMargin}</td>
                    <td className="td text-right tabular-nums">{formatCompactINR(s.returns.monthlyIncome)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{formatCompactINR(s.returns.assuredMinMonthly)}</td>
                    <td className="td text-right tabular-nums">{s.returns.paybackMonths.toFixed(1)} mo</td>
                    <td className="td text-right font-medium tabular-nums text-emerald-700">{s.returns.roiPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="5-year comparison"
          subtitle={`vs fixed deposit at ${(BENCHMARKS.fdRate * 100).toFixed(0)}% and equity at ${(BENCHMARKS.mutualFundRate * 100).toFixed(0)}%`}
        >
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Option</th>
                  <th className="th text-right">Invested</th>
                  <th className="th text-right">FD</th>
                  <th className="th text-right">Equity MF</th>
                  <th className="th text-right">Livanto</th>
                  <th className="th text-right">×FD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {comparison.map((c) => (
                  <tr key={c.sku}>
                    <td className="td font-semibold">{c.label}</td>
                    <td className="td text-right tabular-nums">{formatCompactINR(c.total)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{formatCompactINR(c.fd5)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{formatCompactINR(c.mf5)}</td>
                    <td className="td text-right font-semibold tabular-nums text-emerald-700">{formatCompactINR(c.livanto5)}</td>
                    <td className="td text-right tabular-nums">{c.multiple.toFixed(2)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Illustrative only. Fixed-deposit returns are contractual; franchise returns depend on
            utilisation, tariff and site performance.
          </p>
        </Card>
      </div>

      <Card title="Technical specification" className="mt-4">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Attribute</th>
                {CATALOG_LIST.map((s) => <th key={s.sku} className="th text-right">{s.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {([
                ["Charger type", (s) => s.chargerType],
                ["Vehicle type", (s) => s.vehicleType],
                ["Minimum space", (s) => s.minSpaceSqft],
                ["Dimensions", (s) => s.dimensions],
                ["Weight", (s) => s.weight],
                ["Installation", (s) => s.installation],
                ["Operating temperature", (s) => s.operatingTemp],
                ["Display", (s) => s.display],
                ["Port type", (s) => s.portType],
                ["Power connection", (s) => s.powerConnection],
                ["Charging guns", (s) => String(s.guns)],
                ["Gun cable length", (s) => s.gunCableLength],
              ] as [string, (s: (typeof CATALOG_LIST)[number]) => string][]).map(([label, get]) => (
                <tr key={label}>
                  <td className="td font-medium text-ink-700">{label}</td>
                  {CATALOG_LIST.map((s) => (
                    <td key={s.sku} className="td text-right text-ink-600">{get(s)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title="Add charger"
        description="Kept separate from the six verified investment-model chargers — priced manually, selectable in every lead's quotation the moment it's saved."
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(saveCharger, "Charger added.")}>
              Add charger
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Charger type" required>
              <Select
                value={draft.chargerType}
                onChange={(e) => setDraft({ ...draft, chargerType: e.target.value as "AC" | "DC" })}
                options={[{ value: "AC", label: "AC" }, { value: "DC", label: "DC" }]}
              />
            </Field>
            <Field label="Rating (kW)" required>
              <Input type="number" min={0} step={0.1} value={draft.kw} onChange={(e) => setDraft({ ...draft, kw: e.target.value })} placeholder="3.3" />
            </Field>

            <Field label="Label" hint="Defaults to “{kW} kW {type}” if left blank." className="sm:col-span-2">
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="3.3 kW AC charger" />
            </Field>

            <Field label="Price, excl. GST" required>
              <Input type="number" min={0} step={1} value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: e.target.value })} />
            </Field>
            <Field label="Vehicle type">
              <Input value={draft.vehicleType} onChange={(e) => setDraft({ ...draft, vehicleType: e.target.value })} placeholder="2W / 3W / Car" />
            </Field>

            <Field label="Stage 1 — EOI" hint="Pre-GST. Stage 3 is worked out automatically.">
              <Input type="number" min={0} step={1} value={draft.stage1EOI} onChange={(e) => setDraft({ ...draft, stage1EOI: e.target.value })} />
            </Field>
            <Field label="Stage 2 — Infrastructure" hint="Pre-GST.">
              <Input type="number" min={0} step={1} value={draft.stage2Infra} onChange={(e) => setDraft({ ...draft, stage2Infra: e.target.value })} />
            </Field>

            <Field label="Minimum space">
              <Input value={draft.minSpaceSqft} onChange={(e) => setDraft({ ...draft, minSpaceSqft: e.target.value })} placeholder="100 sq.ft" />
            </Field>
            <Field label="Dimensions">
              <Input value={draft.dimensions} onChange={(e) => setDraft({ ...draft, dimensions: e.target.value })} />
            </Field>

            <Field label="Weight">
              <Input value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
            </Field>
            <Field label="Installation">
              <Input value={draft.installation} onChange={(e) => setDraft({ ...draft, installation: e.target.value })} placeholder="Wall Mounted" />
            </Field>

            <Field label="Operating temperature">
              <Input value={draft.operatingTemp} onChange={(e) => setDraft({ ...draft, operatingTemp: e.target.value })} />
            </Field>
            <Field label="Display">
              <Input value={draft.display} onChange={(e) => setDraft({ ...draft, display: e.target.value })} />
            </Field>

            <Field label="Port type">
              <Input value={draft.portType} onChange={(e) => setDraft({ ...draft, portType: e.target.value })} placeholder="Type 2 / CCS2" />
            </Field>
            <Field label="Power connection">
              <Input value={draft.powerConnection} onChange={(e) => setDraft({ ...draft, powerConnection: e.target.value })} />
            </Field>

            <Field label="Charging guns">
              <Input type="number" min={1} step={1} value={draft.guns} onChange={(e) => setDraft({ ...draft, guns: e.target.value })} />
            </Field>
            <Field label="Gun cable length">
              <Input value={draft.gunCableLength} onChange={(e) => setDraft({ ...draft, gunCableLength: e.target.value })} placeholder="5 m" />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remove charger?"
        description="Hides it from the picker for new quotations. Any lead that already used it keeps its recorded price unaffected."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (confirmDelete) await archiveCustomCharger(confirmDelete.id);
                  setConfirmDelete(null);
                }, "Charger removed.")
              }
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </>
        }
      >
        {confirmDelete && <p className="text-sm text-ink-700">{confirmDelete.label}</p>}
      </Modal>
    </>
  );
}
