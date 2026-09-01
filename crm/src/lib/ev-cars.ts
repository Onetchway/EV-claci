/**
 * India-market EV reference catalogue — manufacturer-stated battery
 * capacities, approximate and variant-dependent (a base vs. long-range
 * trim of the same model can differ). Treat as a starting point for the
 * vehicle form, not a certified spec sheet — the form lets a user pick
 * "Other" and enter a custom make/model/battery figure when a car isn't
 * listed here or the number doesn't match their exact variant.
 */

export interface EvCarSpec {
  id: string;
  make: string;
  model: string;
  batteryKwh: number;
}

export const EV_CAR_CATALOG: EvCarSpec[] = [
  { id: "tata-tiago-ev", make: "Tata", model: "Tiago EV", batteryKwh: 24 },
  { id: "tata-punch-ev", make: "Tata", model: "Punch EV", batteryKwh: 35 },
  { id: "tata-tigor-ev", make: "Tata", model: "Tigor EV", batteryKwh: 26 },
  { id: "tata-nexon-ev", make: "Tata", model: "Nexon EV", batteryKwh: 40.5 },
  { id: "tata-curvv-ev", make: "Tata", model: "Curvv EV", batteryKwh: 45 },
  { id: "mg-comet-ev", make: "MG", model: "Comet EV", batteryKwh: 17.3 },
  { id: "mg-zs-ev", make: "MG", model: "ZS EV", batteryKwh: 50.3 },
  { id: "mg-windsor-ev", make: "MG", model: "Windsor EV", batteryKwh: 38 },
  { id: "mahindra-xuv400", make: "Mahindra", model: "XUV400", batteryKwh: 39.4 },
  { id: "mahindra-be6", make: "Mahindra", model: "BE 6", batteryKwh: 79 },
  { id: "mahindra-xev9e", make: "Mahindra", model: "XEV 9e", batteryKwh: 79 },
  { id: "hyundai-kona", make: "Hyundai", model: "Kona Electric", batteryKwh: 39.2 },
  { id: "hyundai-ioniq5", make: "Hyundai", model: "Ioniq 5", batteryKwh: 72.6 },
  { id: "kia-ev6", make: "Kia", model: "EV6", batteryKwh: 77.4 },
  { id: "byd-atto3", make: "BYD", model: "Atto 3", batteryKwh: 60.5 },
  { id: "byd-seal", make: "BYD", model: "Seal", batteryKwh: 82.5 },
  { id: "byd-e6", make: "BYD", model: "e6", batteryKwh: 71.7 },
  { id: "citroen-ec3", make: "Citroën", model: "eC3", batteryKwh: 29.2 },
  { id: "volvo-xc40", make: "Volvo", model: "XC40 Recharge", batteryKwh: 78 },
  { id: "volvo-c40", make: "Volvo", model: "C40 Recharge", batteryKwh: 78 },
  { id: "bmw-ix1", make: "BMW", model: "iX1", batteryKwh: 66.5 },
  { id: "bmw-i4", make: "BMW", model: "i4", batteryKwh: 83.9 },
  { id: "mercedes-eqb", make: "Mercedes-Benz", model: "EQB", batteryKwh: 66.5 },
  { id: "mercedes-eqs", make: "Mercedes-Benz", model: "EQS", batteryKwh: 107.8 },
  { id: "audi-q8-etron", make: "Audi", model: "Q8 e-tron", batteryKwh: 95 },
  { id: "jaguar-ipace", make: "Jaguar", model: "I-Pace", batteryKwh: 90 },
];

export const OTHER_CAR_ID = "OTHER";

export function findCar(id: string): EvCarSpec | undefined {
  return EV_CAR_CATALOG.find((c) => c.id === id);
}
