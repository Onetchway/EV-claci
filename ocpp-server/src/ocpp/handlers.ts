/**
 * One handler per OCPP 2.0.1 action this Phase-1 server understands.
 * Unlisted actions get a clean NotImplemented CallError rather than being
 * silently dropped — a charge point should be able to tell the difference
 * between "ignored" and "not supported yet."
 */

import {
  markOnline, recordMeterValues, recordTransactionEvent, touchHeartbeat, updateConnectorStatus,
} from "../registry.js";
import { checkIdToken, checkMonthlyCap } from "../rfid.js";
import { openTicketIfNeeded } from "../tickets.js";
import { OcppErrorCode } from "./rpc.js";
import {
  energyWhFrom, type AuthorizeRequest, type AuthorizeResponse,
  type BootNotificationRequest, type BootNotificationResponse, type HeartbeatResponse,
  type MeterValuesRequest, type StatusNotificationRequest, type TransactionEventRequest,
  type TransactionEventResponse,
} from "./types.js";

export type HandlerResult =
  | { ok: true; payload: unknown }
  | { ok: false; errorCode: string; errorDescription: string };

const ok = (payload: unknown): HandlerResult => ({ ok: true, payload });
const notImplemented = (action: string): HandlerResult => ({
  ok: false,
  errorCode: OcppErrorCode.NotImplemented,
  errorDescription: `${action} is not handled by this Phase-1 server yet.`,
});

export async function handleCall(
  chargePointId: string,
  action: string,
  payload: unknown,
): Promise<HandlerResult> {
  switch (action) {
    case "BootNotification": {
      const req = payload as BootNotificationRequest;
      await markOnline(chargePointId, {
        vendorName: req.chargingStation?.vendorName,
        model: req.chargingStation?.model,
        serialNumber: req.chargingStation?.serialNumber,
        firmwareVersion: req.chargingStation?.firmwareVersion,
        reason: req.reason,
      });
      const res: BootNotificationResponse = {
        currentTime: new Date().toISOString(),
        interval: 300,
        status: "Accepted",
      };
      return ok(res);
    }

    case "Heartbeat": {
      await touchHeartbeat(chargePointId);
      const res: HeartbeatResponse = { currentTime: new Date().toISOString() };
      return ok(res);
    }

    case "StatusNotification": {
      const req = payload as StatusNotificationRequest;
      await updateConnectorStatus(chargePointId, req.evseId, req.connectorId, req.connectorStatus, req.timestamp);
      if (req.connectorStatus === "Faulted") {
        await openTicketIfNeeded(
          chargePointId, "FAULT",
          `EVSE ${req.evseId}/connector ${req.connectorId} reported Faulted.`,
        );
      }
      return ok({});
    }

    case "Authorize": {
      const req = payload as AuthorizeRequest;
      let status: AuthorizeResponse["idTokenInfo"]["status"] = await checkIdToken(req.idToken.idToken);
      if (status === "Accepted" && !(await checkMonthlyCap(req.idToken.idToken))) {
        status = "NoCredit";
      }
      const res: AuthorizeResponse = { idTokenInfo: { status } };
      return ok(res);
    }

    case "TransactionEvent": {
      const req = payload as TransactionEventRequest;
      await recordTransactionEvent(chargePointId, req);
      const res: TransactionEventResponse = {};
      return ok(res);
    }

    case "MeterValues": {
      const req = payload as MeterValuesRequest;
      await recordMeterValues(chargePointId, req.evseId, energyWhFrom(req.meterValue));
      return ok({});
    }

    default:
      return notImplemented(action);
  }
}
