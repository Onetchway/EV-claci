"use client";

import { useMemo, useState } from "react";

import { ChargerConfigurator } from "@/components/charger-configurator";
import { Card, PageHeader } from "@/components/ui";
import { BENCHMARKS, CATALOG_LIST } from "@/lib/catalog";
import type { ConfigItem } from "@/lib/pricing";
import { formatCompactINR, formatINR, formatNumber } from "@/lib/utils";

/**
 * Reference sheet + a scratch calculator. Agents use this on a call to answer
 * "what would two 120s cost me?" without creating a lead first.
 */
export default function CatalogPage() {
  const [config, setConfig] = useState<ConfigItem[]>([]);

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

  return (
    <>
      <PageHeader
        title="Charger catalogue & calculator"
        description="Pricing, specifications and modelled returns, straight from the Livanto franchise investment model."
      />

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
    </>
  );
}
