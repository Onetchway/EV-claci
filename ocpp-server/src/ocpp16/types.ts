/**
 * Minimal OCPP 1.6J payload shapes — the second wire dialect this server
 * accepts, alongside OCPP 2.0.1 (ocpp/types.ts). Deliberately narrow: only
 * the actions handlers.ts actually implements. Same defensive-read
 * philosophy as the 2.0.1 types — real 1.6 firmware in the field varies a
 * lot in what it sends.
 */

export interface BootNotification16Request {
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  firmwareVersion?: string;
}
export interface BootNotification16Response {
  status: "Accepted" | "Pending" | "Rejected";
  currentTime: string;
  interval: number;
}

export interface Heartbeat16Response {
  currentTime: string;
}

/** OCPP 1.6 ChargePointStatus (§ Status Notification) — a richer enum than 2.0.1's, mapped down to the shared internal ConnectorStatus in handlers.ts. */
export type ChargePointStatus16 =
  | "Available" | "Preparing" | "Charging" | "SuspendedEVSE" | "SuspendedEV"
  | "Finishing" | "Reserved" | "Unavailable" | "Faulted";

export interface StatusNotification16Request {
  connectorId: number;
  status: ChargePointStatus16;
  errorCode: string;
  timestamp?: string;
}

export interface Authorize16Request {
  idTag: string;
}
export interface Authorize16Response {
  idTagInfo: { status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx" };
}

export interface StartTransaction16Request {
  connectorId: number;
  idTag: string;
  meterStart: number;
  timestamp: string;
  reservationId?: number;
}
export interface StartTransaction16Response {
  transactionId: number;
  idTagInfo: { status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx" };
}

export interface StopTransaction16Request {
  transactionId: number;
  idTag?: string;
  meterStop: number;
  timestamp: string;
  reason?: string;
}
export interface StopTransaction16Response {
  idTagInfo?: { status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx" };
}

export interface SampledValue16 {
  value: string;
  measurand?: string;
  unit?: string;
}
export interface MeterValue16 {
  timestamp: string;
  sampledValue: SampledValue16[];
}
export interface MeterValues16Request {
  connectorId: number;
  transactionId?: number;
  meterValue: MeterValue16[];
}

/** Pulls the Wh energy reading out of a 1.6 meterValue array — string-typed values, unlike 2.0.1's numeric ones. */
export function energyWhFrom16(values: MeterValue16[] | undefined): number | null {
  if (!values?.length) return null;
  for (const mv of values) {
    const sample = mv.sampledValue.find(
      (s) => (s.measurand ?? "Energy.Active.Import.Register") === "Energy.Active.Import.Register",
    );
    if (sample) {
      const raw = Number(sample.value);
      if (Number.isNaN(raw)) continue;
      return (sample.unit ?? "Wh") === "kWh" ? raw * 1000 : raw;
    }
  }
  return null;
}

/** Pulls the State-of-Charge percentage out of a 1.6 meterValue array, if the charger reports it. */
export function socFrom16(values: MeterValue16[] | undefined): number | null {
  if (!values?.length) return null;
  for (const mv of values) {
    const sample = mv.sampledValue.find((s) => s.measurand === "SoC");
    if (sample) {
      const raw = Number(sample.value);
      if (!Number.isNaN(raw)) return raw;
    }
  }
  return null;
}
