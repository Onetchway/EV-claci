/**
 * Minimal OCPP 2.0.1 payload shapes for the actions Phase 1 handles.
 * Deliberately not the full spec — every field a charge point might omit or
 * add beyond this is read defensively (optional chaining, fallbacks), since
 * real-world Exicom/Everta/Mindra firmware hasn't been tested against this
 * server yet and vendor quirks are expected.
 */

export type RegistrationStatus = "Accepted" | "Pending" | "Rejected";

export interface BootNotificationRequest {
  reason: string;
  chargingStation: {
    model: string;
    vendorName: string;
    serialNumber?: string;
    firmwareVersion?: string;
  };
}
export interface BootNotificationResponse {
  currentTime: string;
  interval: number;
  status: RegistrationStatus;
}

export interface HeartbeatResponse {
  currentTime: string;
}

/** OCPP 2.0.1 connector status values (§ ConnectorStatusEnumType). */
export type ConnectorStatus =
  | "Available" | "Occupied" | "Reserved" | "Unavailable" | "Faulted";

export interface StatusNotificationRequest {
  timestamp: string;
  connectorStatus: ConnectorStatus;
  evseId: number;
  connectorId: number;
}

export interface IdToken {
  idToken: string;
  type: string;
}

export interface AuthorizeRequest {
  idToken: IdToken;
}
export interface AuthorizeResponse {
  idTokenInfo: { status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "Unknown" | "NoCredit" };
}

export type TransactionEventType = "Started" | "Updated" | "Ended";

export interface SampledValue {
  value: number;
  measurand?: string;
  unitOfMeasure?: { unit?: string };
  context?: string;
}
export interface MeterValue {
  timestamp: string;
  sampledValue: SampledValue[];
}

export interface TransactionEventRequest {
  eventType: TransactionEventType;
  timestamp: string;
  triggerReason: string;
  seqNo: number;
  transactionInfo: {
    transactionId: string;
    chargingState?: string;
    stoppedReason?: string;
  };
  evse?: { id: number; connectorId?: number };
  idToken?: IdToken;
  meterValue?: MeterValue[];
}
export interface TransactionEventResponse {
  idTokenInfo?: { status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "Unknown" };
}

export interface MeterValuesRequest {
  evseId: number;
  meterValue: MeterValue[];
}

// ------------------------------------------------------- outbound (Phase 2)
// Calls this server sends TO a charge point — the remote-command surface.

export interface RequestStartTransactionRequest {
  remoteStartId: number;
  idToken: IdToken;
  evseId?: number;
}
export interface RequestStartTransactionResponse {
  status: "Accepted" | "Rejected";
}

export interface RequestStopTransactionRequest {
  transactionId: string;
}
export interface RequestStopTransactionResponse {
  status: "Accepted" | "Rejected";
}

export type ResetType = "Immediate" | "OnIdle";
export interface ResetRequest {
  type: ResetType;
  evseId?: number;
}
export interface ResetResponse {
  status: "Accepted" | "Rejected" | "Scheduled";
}

export interface UnlockConnectorRequest {
  evseId: number;
  connectorId: number;
}
export interface UnlockConnectorResponse {
  status: "Unlocked" | "UnlockFailed" | "OngoingAuthorizedTransaction" | "UnknownConnector";
}

export type OperationalStatus = "Inoperative" | "Operative";
export interface ChangeAvailabilityRequest {
  operationalStatus: OperationalStatus;
  evse?: { id: number; connectorId?: number };
}
export interface ChangeAvailabilityResponse {
  status: "Accepted" | "Rejected" | "Scheduled";
}

/** Pulls the Wh energy reading out of a meterValue array, if present. */
export function energyWhFrom(values: MeterValue[] | undefined): number | null {
  if (!values?.length) return null;
  for (const mv of values) {
    const sample = mv.sampledValue.find(
      (s) => (s.measurand ?? "Energy.Active.Import.Register") === "Energy.Active.Import.Register",
    );
    if (sample) {
      const unit = sample.unitOfMeasure?.unit ?? "Wh";
      return unit === "kWh" ? sample.value * 1000 : sample.value;
    }
  }
  return null;
}

/** Pulls the State-of-Charge percentage out of a meterValue array, if the charger reports it — many don't (it requires the EV to relay it over the charging protocol), so this is commonly absent even mid-session. */
export function socFrom(values: MeterValue[] | undefined): number | null {
  if (!values?.length) return null;
  for (const mv of values) {
    const sample = mv.sampledValue.find((s) => s.measurand === "SoC");
    if (sample) return sample.value;
  }
  return null;
}
