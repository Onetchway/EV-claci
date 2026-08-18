/**
 * One handler per OCPP 1.6J action this server understands — the 1.6
 * counterpart to ocpp/handlers.ts. Kept as a fully separate switch rather
 * than merged with the 2.0.1 one: the two dialects use different action
 * names for the same events (StartTransaction vs TransactionEvent) and
 * different payload shapes for the ones that share a name, so a merged
 * handler would need per-action protocol branching anyway.
 */

import {
  markOnline, recordFirmwareStatus, record16MeterValue,
  start16Transaction, stop16Transaction, touchHeartbeat, updateConnectorStatus,
} from "../registry.js";
import { checkIdToken, checkMonthlyCap } from "../rfid.js";
import { openTicketIfNeeded as openTicket } from "../tickets.js";
import { OcppErrorCode } from "../ocpp/rpc.js";
import type { ConnectorStatus } from "../ocpp/types.js";
import {
  energyWhFrom16, socFrom16, type Authorize16Request, type Authorize16Response,
  type BootNotification16Request, type BootNotification16Response, type ChargePointStatus16,
  type Heartbeat16Response, type MeterValues16Request, type StartTransaction16Request,
  type StartTransaction16Response, type StatusNotification16Request, type StopTransaction16Request,
  type StopTransaction16Response,
} from "./types.js";

export type HandlerResult =
  | { ok: true; payload: unknown }
  | { ok: false; errorCode: string; errorDescription: string };

const ok = (payload: unknown): HandlerResult => ({ ok: true, payload });
const notImplemented = (action: string): HandlerResult => ({
  ok: false,
  errorCode: OcppErrorCode.NotImplemented,
  errorDescription: `${action} is not handled by this server's OCPP 1.6 support yet.`,
});

/** 1.6's richer ChargePointStatus enum collapsed onto the shared internal ConnectorStatus registry.ts already writes for 2.0.1 chargers — same Firestore shape either way. */
const STATUS_16_TO_INTERNAL: Record<ChargePointStatus16, ConnectorStatus> = {
  Available: "Available",
  Preparing: "Occupied",
  Charging: "Occupied",
  SuspendedEVSE: "Occupied",
  SuspendedEV: "Occupied",
  Finishing: "Occupied",
  Reserved: "Reserved",
  Unavailable: "Unavailable",
  Faulted: "Faulted",
};

export async function handleCall16(
  chargePointId: string,
  action: string,
  payload: unknown,
): Promise<HandlerResult> {
  switch (action) {
    case "BootNotification": {
      const req = payload as BootNotification16Request;
      await markOnline(chargePointId, {
        vendorName: req.chargePointVendor,
        model: req.chargePointModel,
        serialNumber: req.chargePointSerialNumber,
        firmwareVersion: req.firmwareVersion,
      });
      const res: BootNotification16Response = { status: "Accepted", currentTime: new Date().toISOString(), interval: 300 };
      return ok(res);
    }

    case "Heartbeat": {
      await touchHeartbeat(chargePointId);
      const res: Heartbeat16Response = { currentTime: new Date().toISOString() };
      return ok(res);
    }

    case "StatusNotification": {
      const req = payload as StatusNotification16Request;
      const mapped = STATUS_16_TO_INTERNAL[req.status] ?? "Unavailable";
      await updateConnectorStatus(chargePointId, 1, req.connectorId, mapped, req.timestamp ?? new Date().toISOString());
      if (req.status === "Faulted") {
        await openTicket(chargePointId, "FAULT", `Connector ${req.connectorId} reported Faulted (${req.errorCode}).`);
      }
      return ok({});
    }

    case "Authorize": {
      const req = payload as Authorize16Request;
      const internalStatus = await checkIdToken(req.idTag, chargePointId);
      // 1.6's idTagInfo has no "Unknown" or "no credit" status — Invalid is the closest honest refusal for either.
      let status: Authorize16Response["idTagInfo"]["status"] = internalStatus === "Accepted" ? "Accepted" : internalStatus === "Blocked" ? "Blocked" : "Invalid";
      if (status === "Accepted" && !(await checkMonthlyCap(req.idTag))) {
        status = "Invalid";
      }
      const res: Authorize16Response = { idTagInfo: { status } };
      return ok(res);
    }

    case "StartTransaction": {
      const req = payload as StartTransaction16Request;
      const transactionId = await start16Transaction(chargePointId, req.connectorId, req.idTag, req.meterStart, req.timestamp);
      const res: StartTransaction16Response = { transactionId, idTagInfo: { status: "Accepted" } };
      return ok(res);
    }

    case "StopTransaction": {
      const req = payload as StopTransaction16Request;
      await stop16Transaction(chargePointId, req.transactionId, req.meterStop, req.timestamp, req.reason);
      const res: StopTransaction16Response = { idTagInfo: { status: "Accepted" } };
      return ok(res);
    }

    case "MeterValues": {
      const req = payload as MeterValues16Request;
      const energyWh = energyWhFrom16(req.meterValue);
      const soc = socFrom16(req.meterValue);
      if ((energyWh != null || soc != null) && req.transactionId != null) {
        await record16MeterValue(chargePointId, req.transactionId, energyWh, soc);
      }
      return ok({});
    }

    case "FirmwareStatusNotification": {
      const req = payload as { status: string };
      await recordFirmwareStatus(chargePointId, req.status);
      return ok({});
    }

    case "DataTransfer":
      return ok({ status: "UnknownVendorId" });

    default:
      return notImplemented(action);
  }
}
