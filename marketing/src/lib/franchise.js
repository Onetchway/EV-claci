/**
 * Livanto Green franchise investment model — sourced verbatim from
 * "Livanto_Franchise_Investment_Model_New.xlsx" and
 * "Livanto_Franchise_BOM.xlsx" (company-provided). Every number below is
 * real. Do not adjust without an updated source file.
 */
/** Constants used by the interactive calculator — from the Franchise Investment Model. */
export const CALC_ASSUMPTIONS = {
  discomCost: 6.5, // ₹/unit — electricity/DISCOM cost
  landownerShare: 2, // ₹/unit — paid to landowner when land is leased
  cpoShare: 3, // ₹/unit — Livanto's CPO/O&M share
  gstRate: 0.18,
};

export const FRANCHISE_TIERS = [
  {
    kw: 60,
    vehicleType: 'Car',
    investment: 1550000,
    avgEnergyPerSession: 40,
    gst: 279000,
    totalCost: 1829000,
    downPayment: 548700,
    loanAmount: 1280300,
    emi5yr: 26577,
    vehiclesPerDay: 5,
    unitsPerMonth: 6000,
    tariff: 21,
    investorMargin: 9.5,
    projectedMonthlyIncome: 57000,
    assuredMinimum: 15000,
    paybackMonths: 27.19,
    paybackYears: 2.27,
    roiPct: 44.13,
    cumulative3yr: 2052000,
    cumulative5yr: 3420000,
  },
  {
    kw: 90,
    vehicleType: 'Car',
    investment: 2050000,
    avgEnergyPerSession: 50,
    gst: 369000,
    totalCost: 2419000,
    downPayment: 725700,
    loanAmount: 1693300,
    emi5yr: 35150,
    vehiclesPerDay: 5,
    unitsPerMonth: 7500,
    tariff: 21,
    investorMargin: 9.5,
    projectedMonthlyIncome: 71250,
    assuredMinimum: 15000,
    paybackMonths: 28.77,
    paybackYears: 2.40,
    roiPct: 41.71,
    cumulative3yr: 2565000,
    cumulative5yr: 4275000,
  },
  {
    kw: 120,
    vehicleType: 'Car',
    investment: 2550000,
    avgEnergyPerSession: 50,
    gst: 459000,
    totalCost: 3009000,
    downPayment: 902700,
    loanAmount: 2106300,
    emi5yr: 43723,
    vehiclesPerDay: 6,
    unitsPerMonth: 9000,
    tariff: 21,
    investorMargin: 9.5,
    projectedMonthlyIncome: 85500,
    assuredMinimum: 20000,
    paybackMonths: 29.82,
    paybackYears: 2.49,
    roiPct: 40.24,
    cumulative3yr: 3078000,
    cumulative5yr: 5130000,
  },
  {
    kw: 180,
    vehicleType: 'Car',
    investment: 3000000,
    avgEnergyPerSession: 75,
    gst: 540000,
    totalCost: 3540000,
    downPayment: 1062000,
    loanAmount: 2478000,
    emi5yr: 51439,
    vehiclesPerDay: 5,
    unitsPerMonth: 11250,
    tariff: 22,
    investorMargin: 10.5,
    projectedMonthlyIncome: 118125,
    assuredMinimum: 30000,
    paybackMonths: 25.39,
    paybackYears: 2.12,
    roiPct: 47.25,
    cumulative3yr: 4252500,
    cumulative5yr: 7087500,
    featured: true,
  },
  {
    kw: 240,
    vehicleType: 'Bus / Truck',
    investment: 3800000,
    avgEnergyPerSession: 400,
    gst: 684000,
    totalCost: 4484000,
    downPayment: 1345200,
    loanAmount: 3138800,
    emi5yr: 65156,
    vehiclesPerDay: 2,
    unitsPerMonth: 24000,
    tariff: 17,
    investorMargin: 5.5,
    projectedMonthlyIncome: 132000,
    assuredMinimum: 35000,
    paybackMonths: 28.78,
    paybackYears: 2.40,
    roiPct: 41.68,
    cumulative3yr: 4752000,
    cumulative5yr: 7920000,
  },
  {
    kw: 360,
    vehicleType: 'Bus / Truck',
    investment: 5000000,
    avgEnergyPerSession: 550,
    gst: 900000,
    totalCost: 5900000,
    downPayment: 1770000,
    loanAmount: 4130000,
    emi5yr: 85732,
    vehiclesPerDay: 2,
    unitsPerMonth: 33000,
    tariff: 17,
    investorMargin: 5.5,
    projectedMonthlyIncome: 181500,
    assuredMinimum: 45000,
    paybackMonths: 27.54,
    paybackYears: 2.30,
    roiPct: 43.56,
    cumulative3yr: 6534000,
    cumulative5yr: 10890000,
  },
];

/** Financing terms, common across all tiers. */
export const FINANCING = {
  loanToValue: 0.7,
  interestRate: 0.09,
};

/** The real 7-step franchise partnership process. */
export const FRANCHISE_STEPS = [
  { n: '01', title: 'Partner', body: 'Application & screening.' },
  { n: '02', title: 'Land', body: 'Site feasibility & DISCOM check.' },
  { n: '03', title: 'Invest', body: 'Sign-off & capex.' },
  { n: '04', title: 'Install', body: 'Turnkey EPC build.' },
  { n: '05', title: 'Operate', body: 'Livanto runs the network 24×7.' },
  { n: '06', title: 'Revenue', body: 'Transparent monthly share.' },
  { n: '07', title: 'Support', body: 'Ongoing training & QBRs.' },
];

/** The three landowner monetisation models. */
export const LANDOWNER_MODELS = [
  {
    title: 'Full Investment Model',
    subtitle: '(Max Yield)',
    body: 'Partner provides Land + CAPEX. Partner retains full revenue ownership and maximum upside.',
  },
  {
    title: 'Revenue Share Model',
    subtitle: '(Performance)',
    body: 'Partner provides Land only. Partner earns a percentage of every unit of electricity sold. Ideal for high-traffic sites.',
  },
  {
    title: 'Fixed Rental Model',
    subtitle: '(Stability)',
    body: 'Livanto leases the land. Partner receives a stable, lease-like rental income stream regardless of market fluctuation.',
  },
];

/** The 8 things Livanto manages, end to end, per the "Partnering for National Scale" slide. */
export const MANAGE_STEPS = [
  'Site Evaluation',
  'Design & Engineering',
  'Electrical Infra',
  'Charger Procurement',
  'Installation',
  'Network Software',
  '24×7 Monitoring',
  'Maintenance & Support',
];

/** Who the franchise program is designed for. */
export const PARTNER_TYPES = [
  { title: 'Landowners', body: 'Monetise idle real estate space.' },
  { title: 'Investors', body: 'Seeking stable recurring income.' },
  { title: 'Business Owners', body: 'Add EV charging to drive new revenue streams.' },
  { title: 'Fleet Operators', body: 'Build dedicated charging for your fleets.' },
  { title: 'Property Owners', body: 'Enhance property value with EV infrastructure.' },
  { title: 'Highway Owners', body: 'Create high-traffic charging destinations.' },
];

/** Illustrative site tiers mapped to the real charger-power ladder. */
export const INVESTMENT_PLANS = [
  { title: 'City Charge', tag: 'Ideal for urban locations', kwRange: '60–120 kW', features: ['Malls', 'Retail', 'Offices', 'Hotels', 'Commercial complexes'] },
  { title: 'Highway Hub', tag: 'Ideal for high-traffic corridors', kwRange: '180–240 kW', features: ['Highways', 'Food plazas', 'Fuel stations', 'Travel stops', 'Recreational hubs'] },
  { title: 'Mega Hub', tag: 'Ideal for high throughput', kwRange: '240–360 kW', features: ['Fleet depots', 'Bus operators', 'Logistics parks', 'Industrial zones', 'Large highway hubs'] },
];

export const FRANCHISE_FAQ = [
  { q: 'What is the minimum investment?', a: `The entry tier is a 60 kW DC franchise station at ₹${fmtLakhStr(1550000)} (before GST) — see the calculator above for the full range up to 360 kW.` },
  { q: 'Do I need to own the land?', a: 'No. Livanto offers three landowner models — Full Investment, Revenue Share, or Fixed Rental — so you can partner whether you own the site, lease it, or provide land only.' },
  { q: 'Who installs the chargers?', a: 'Livanto manages turnkey EPC installation end to end — electrical infra, civil work, charger procurement and commissioning.' },
  { q: 'Who operates the charging station?', a: 'Livanto runs the network 24×7 — remote monitoring, OCPP management, and on-ground maintenance and support.' },
  { q: 'How are revenues settled?', a: 'Revenue share is transparent and settled monthly, with a Livanto-assured minimum payout for the first 24 months.' },
];

function fmtLakhStr(n) {
  return (n / 100000).toFixed(1) + 'L';
}

export const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const fmtLakh = (n) => '₹' + (n / 100000).toFixed(1) + 'L';
