/**
 * Charger catalogue — figures transcribed from
 * "Livanto_Franchise_Investment_Model_New.xlsx" → sheet "Franchise Model".
 *
 * Every money value here is in INR and is the price for ONE charger unit.
 * `basePrice` excludes GST. `stage1 + stage2 + stage3 === basePrice` (verified
 * against the workbook for all six options).
 */

/** GST on the charger hardware itself (HSN 8504 EVSE) — 5%, not the general 18% slab. */
export const GST_RATE = 0.05;
/** GST on the electrical connection, panel, wiring, civil work and HT infra bundled into a DC charger's BOM price. */
export const REST_GST_RATE = 0.18;

export type ChargerSku =
  | "DC-60"
  | "DC-90"
  | "DC-120"
  | "DC-180"
  | "DC-240"
  | "DC-360";

export interface ChargerSpec {
  sku: string;
  kw: number;
  label: string;
  chargerType: string;
  vehicleType: string;
  minSpaceSqft: string;
  dimensions: string;
  weight: string;
  installation: string;
  operatingTemp: string;
  display: string;
  portType: string;
  powerConnection: string;
  guns: number;
  gunCableLength: string;

  /** Franchise investment, excluding GST, for one unit. Bundles the charger hardware AND its electrical/civil BOM build-out. */
  basePrice: number;
  /**
   * The hardware-only slice of `basePrice` (BOM row "Equipment — Charger"),
   * taxed at 5% (HSN 8504 EVSE). The remainder — DISCOM connection,
   * electrical infra, panel, wiring, civil work, HT infra — is taxed at 18%.
   * Undefined on a custom (non-BOM) charger, which falls back to the whole
   * price at 5%.
   */
  equipmentPrice?: number;
  /** Milestone split of `basePrice` (pre-GST). */
  stage1EOI: number;
  stage2Infra: number;
  stage3Commissioning: number;

  /** Operating assumptions (per unit). */
  ops: {
    vehiclesPerDay: number;
    kWhPerSession: number;
    billingDaysPerMonth: number;
    unitsPerDay: number;
    unitsPerMonth: number;
  };

  /** Tariff stack, ₹ per unit (kWh). */
  tariff: {
    endUserRate: number;
    discomCost: number;
    landownerShare: number;
    cpoShare: number;
    investorMargin: number;
  };

  /** Modelled investor returns (per unit). */
  returns: {
    monthlyIncome: number;
    assuredMinMonthly: number;
    annualIncome: number;
    paybackMonths: number;
    roiPct: number;
    cumulative3Yr: number;
    cumulative5Yr: number;
  };
}

const spec = (
  kw: number,
  vehicleType: string,
  minSpaceSqft: string,
  basePrice: number,
  equipmentPrice: number,
  stage1EOI: number,
  stage2Infra: number,
  ops: ChargerSpec["ops"],
  tariff: ChargerSpec["tariff"],
  returns: ChargerSpec["returns"],
): ChargerSpec => ({
  sku: `DC-${kw}` as ChargerSku,
  kw,
  label: `${kw} kW`,
  chargerType: "DC",
  vehicleType,
  minSpaceSqft,
  dimensions: "1704 × 650 × 615 mm",
  weight: "250–300 kg",
  installation: "Ground Mounted (civil work required)",
  operatingTemp: "-20°C to 70°C",
  display: '7" HMI LED',
  portType: "CCS2",
  powerConnection: "3P + N + PE",
  guns: 2,
  gunCableLength: "5 m",
  basePrice,
  equipmentPrice,
  stage1EOI,
  stage2Infra,
  stage3Commissioning: basePrice - stage1EOI - stage2Infra,
  ops,
  tariff,
  returns,
});

export const CATALOG: Record<ChargerSku, ChargerSpec> = {
  "DC-60": spec(
    60, "Car", "300–350 sq.ft", 1_550_000, 600_000, 50_000, 750_000,
    { vehiclesPerDay: 5, kWhPerSession: 40, billingDaysPerMonth: 30, unitsPerDay: 200, unitsPerMonth: 6_000 },
    { endUserRate: 21, discomCost: 6.5, landownerShare: 2, cpoShare: 3, investorMargin: 9.5 },
    { monthlyIncome: 57_000, assuredMinMonthly: 15_000, annualIncome: 684_000, paybackMonths: 27.19, roiPct: 44.13, cumulative3Yr: 2_052_000, cumulative5Yr: 3_420_000 },
  ),
  "DC-90": spec(
    90, "Car", "300–350 sq.ft", 2_050_000, 750_000, 50_000, 1_000_000,
    { vehiclesPerDay: 5, kWhPerSession: 50, billingDaysPerMonth: 30, unitsPerDay: 250, unitsPerMonth: 7_500 },
    { endUserRate: 21, discomCost: 6.5, landownerShare: 2, cpoShare: 3, investorMargin: 9.5 },
    { monthlyIncome: 71_250, assuredMinMonthly: 15_000, annualIncome: 855_000, paybackMonths: 28.77, roiPct: 41.71, cumulative3Yr: 2_565_000, cumulative5Yr: 4_275_000 },
  ),
  "DC-120": spec(
    120, "Car", "300–350 sq.ft", 2_550_000, 950_000, 50_000, 1_250_000,
    { vehiclesPerDay: 6, kWhPerSession: 50, billingDaysPerMonth: 30, unitsPerDay: 300, unitsPerMonth: 9_000 },
    { endUserRate: 21, discomCost: 6.5, landownerShare: 2, cpoShare: 3, investorMargin: 9.5 },
    { monthlyIncome: 85_500, assuredMinMonthly: 20_000, annualIncome: 1_026_000, paybackMonths: 29.82, roiPct: 40.24, cumulative3Yr: 3_078_000, cumulative5Yr: 5_130_000 },
  ),
  "DC-180": spec(
    180, "Car", "300–350 sq.ft", 3_000_000, 1_025_000, 50_000, 1_475_000,
    { vehiclesPerDay: 5, kWhPerSession: 75, billingDaysPerMonth: 30, unitsPerDay: 375, unitsPerMonth: 11_250 },
    { endUserRate: 22, discomCost: 6.5, landownerShare: 2, cpoShare: 3, investorMargin: 10.5 },
    { monthlyIncome: 118_125, assuredMinMonthly: 20_000, annualIncome: 1_417_500, paybackMonths: 25.39, roiPct: 47.25, cumulative3Yr: 4_252_500, cumulative5Yr: 7_087_500 },
  ),
  "DC-240": spec(
    240, "Bus / Truck", "1,000–1,500 sq.ft", 3_800_000, 1_200_000, 100_000, 1_850_000,
    { vehiclesPerDay: 2, kWhPerSession: 400, billingDaysPerMonth: 30, unitsPerDay: 800, unitsPerMonth: 24_000 },
    { endUserRate: 17, discomCost: 6.5, landownerShare: 2, cpoShare: 3, investorMargin: 5.5 },
    { monthlyIncome: 132_000, assuredMinMonthly: 30_000, annualIncome: 1_584_000, paybackMonths: 28.78, roiPct: 41.68, cumulative3Yr: 4_752_000, cumulative5Yr: 7_920_000 },
  ),
  "DC-360": spec(
    360, "Bus / Truck", "1,000–1,500 sq.ft", 5_000_000, 1_550_000, 200_000, 2_400_000,
    { vehiclesPerDay: 2, kWhPerSession: 550, billingDaysPerMonth: 30, unitsPerDay: 1_100, unitsPerMonth: 33_000 },
    { endUserRate: 17, discomCost: 6.5, landownerShare: 2, cpoShare: 3, investorMargin: 5.5 },
    { monthlyIncome: 181_500, assuredMinMonthly: 40_000, annualIncome: 2_178_000, paybackMonths: 27.54, roiPct: 43.56, cumulative3Yr: 6_534_000, cumulative5Yr: 10_890_000 },
  ),
};

export const CATALOG_LIST: ChargerSpec[] = Object.values(CATALOG).sort((a, b) => a.kw - b.kw);

/**
 * Default GST on one unit at the catalogue price — the same 5%/18% BOM
 * split buildQuote() applies, kept here so display-only spots (the
 * catalogue palette, the catalogue page's reference tables) don't
 * hand-roll a flat `* 1.05` that's wrong for a bundled DC charger price.
 */
export function catalogueGst(spec: ChargerSpec): number {
  const equipRatio = spec.equipmentPrice != null && spec.basePrice > 0 ? spec.equipmentPrice / spec.basePrice : 1;
  const equipBase = spec.basePrice * equipRatio;
  return Math.round(equipBase * GST_RATE + (spec.basePrice - equipBase) * REST_GST_RATE);
}

export function catalogueAllIn(spec: ChargerSpec): number {
  return spec.basePrice + catalogueGst(spec);
}

export const SKUS = CATALOG_LIST.map((c) => c.sku);

/**
 * Chargers added on the Catalogue page live in Firestore, not this file —
 * the six DC options above are the verified franchise investment model and
 * stay hardcoded. This registry is populated once, app-wide, by
 * useChargerCatalog() so that buildQuote() (a plain function, not a React
 * hook) can still resolve a custom sku from anywhere a lead's quote is read.
 */
const customCatalog = new Map<string, ChargerSpec>();

export function setCustomCatalog(specs: ChargerSpec[]): void {
  customCatalog.clear();
  for (const s of specs) customCatalog.set(s.sku, s);
}

export function getSpec(sku: string): ChargerSpec | undefined {
  return CATALOG[sku as ChargerSku] ?? customCatalog.get(sku);
}

/** Financing assumptions from sheet section 3. */
export const FINANCING = {
  loanToValue: 0.7,
  interestRate: 0.09,
  tenuresYears: [3, 5, 6, 7] as const,
};

/** Benchmarks from sheet "Returns Comparison". */
export const BENCHMARKS = {
  fdRate: 0.07,
  inflation: 0.03,
  mutualFundRate: 0.1,
};
