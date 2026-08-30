/**
 * Depreciation math for the asset register — an internal management view of
 * what site equipment is worth today, not a substitute for the company's
 * statutory books. Confirm useful life / WDV rate with your CA; this
 * doesn't know your actual tax elections.
 */

import type { Asset } from "./types";
import { toDate } from "./utils";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function ageInYears(purchaseDate: Date, asOf: Date): number {
  return Math.max(0, (asOf.getTime() - purchaseDate.getTime()) / MS_PER_YEAR);
}

export interface DepreciationSnapshot {
  ageYears: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export function calcDepreciation(asset: Asset, asOf: Date = new Date()): DepreciationSnapshot {
  const purchaseDate = toDate(asset.purchaseDate);
  if (!purchaseDate || asset.cost <= 0) {
    return { ageYears: 0, accumulatedDepreciation: 0, bookValue: asset.cost };
  }
  const age = ageInYears(purchaseDate, asOf);
  const salvage = Math.max(0, asset.salvageValue ?? 0);

  if (asset.method === "WDV") {
    const rate = Math.min(1, Math.max(0, (asset.wdvRatePct ?? 0) / 100));
    const bookValue = Math.max(salvage, Math.round(asset.cost * Math.pow(1 - rate, age)));
    return { ageYears: age, accumulatedDepreciation: asset.cost - bookValue, bookValue };
  }

  const life = Math.max(1, asset.usefulLifeYears ?? 5);
  const depreciableBase = Math.max(0, asset.cost - salvage);
  const accumulated = Math.min(depreciableBase, Math.round((depreciableBase / life) * age));
  return { ageYears: age, accumulatedDepreciation: accumulated, bookValue: asset.cost - accumulated };
}

export interface DepreciationScheduleRow {
  year: number;
  openingValue: number;
  depreciation: number;
  closingValue: number;
}

/** A year-by-year schedule for display — straight-line runs to full useful life, WDV shown for a fixed 10-year horizon since it never mathematically reaches zero. */
export function depreciationSchedule(asset: Asset): DepreciationScheduleRow[] {
  const salvage = Math.max(0, asset.salvageValue ?? 0);
  const rows: DepreciationScheduleRow[] = [];

  if (asset.method === "WDV") {
    const rate = Math.min(1, Math.max(0, (asset.wdvRatePct ?? 0) / 100));
    let opening = asset.cost;
    for (let year = 1; year <= 10 && opening > salvage; year++) {
      const dep = Math.min(opening - salvage, Math.round(opening * rate));
      const closing = opening - dep;
      rows.push({ year, openingValue: opening, depreciation: dep, closingValue: closing });
      opening = closing;
    }
    return rows;
  }

  const life = Math.max(1, asset.usefulLifeYears ?? 5);
  const depreciableBase = Math.max(0, asset.cost - salvage);
  const annual = Math.round(depreciableBase / life);
  let opening = asset.cost;
  for (let year = 1; year <= life; year++) {
    const dep = year === life ? opening - salvage : Math.min(opening - salvage, annual);
    const closing = opening - dep;
    rows.push({ year, openingValue: opening, depreciation: dep, closingValue: closing });
    opening = closing;
  }
  return rows;
}
