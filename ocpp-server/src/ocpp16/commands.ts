/**
 * Translates the 2.0.1-shaped outbound actions every caller in this
 * codebase already sends (CRM API routes, OCPI Commands/ChargingProfiles
 * routes, the zone load balancer, depot scheduling) into OCPP 1.6J's
 * action names and payload shapes, for the one case that actually needs
 * it: ocpp/commands.ts's sendCommand, when the target charger negotiated
 * "ocpp1.6" instead of "ocpp2.0.1".
 *
 * Deliberately not exhaustive — GetVariables/SetVariables/GetLog have no
 * clean 1:1 1.6 equivalent (1.6 uses GetConfiguration/ChangeConfiguration/
 * GetDiagnostics, different enough to be its own scoped piece of work) and
 * are left unsupported here rather than half-translated. Callers get a
 * clear UnsupportedFor16Error instead of a malformed Call.
 */

import type {
  ChangeAvailabilityRequest, RequestStartTransactionRequest, RequestStopTransactionRequest,
  ResetRequest, UnlockConnectorRequest,
} from "../ocpp/types.js";

export class UnsupportedFor16Error extends Error {
  constructor(action: string) {
    super(`${action} has no OCPP 1.6 translation in this server yet.`);
    this.name = "UnsupportedFor16Error";
  }
}

export function translateForOcpp16(action: string, payload: unknown): { action: string; payload: unknown } {
  switch (action) {
    case "RequestStartTransaction": {
      const p = payload as RequestStartTransactionRequest;
      return { action: "RemoteStartTransaction", payload: { connectorId: p.evseId ?? 1, idTag: p.idToken.idToken } };
    }

    case "RequestStopTransaction": {
      const p = payload as RequestStopTransactionRequest;
      return { action: "RemoteStopTransaction", payload: { transactionId: Number(p.transactionId) } };
    }

    case "Reset": {
      const p = payload as ResetRequest;
      return { action: "Reset", payload: { type: p.type } };
    }

    case "UnlockConnector": {
      const p = payload as UnlockConnectorRequest;
      return { action: "UnlockConnector", payload: { connectorId: p.connectorId } };
    }

    case "ChangeAvailability": {
      const p = payload as ChangeAvailabilityRequest;
      return {
        action: "ChangeAvailability",
        payload: { connectorId: p.evse?.id ?? 0, type: p.operationalStatus },
      };
    }

    case "ClearCache":
      return { action: "ClearCache", payload: {} };

    case "UpdateFirmware": {
      const p = payload as { firmware?: { location?: string; retrieveDateTime?: string } };
      return {
        action: "UpdateFirmware",
        payload: { location: p.firmware?.location, retrieveDate: p.firmware?.retrieveDateTime },
      };
    }

    case "SetChargingProfile": {
      const p = payload as {
        evseId?: number;
        chargingProfile: {
          id: number;
          stackLevel: number;
          chargingProfilePurpose: string;
          chargingProfileKind: string;
          chargingSchedule: Array<Record<string, unknown>>;
        };
      };
      const schedule = p.chargingProfile.chargingSchedule[0] ?? {};
      return {
        action: "SetChargingProfile",
        payload: {
          connectorId: p.evseId ?? 0,
          csChargingProfiles: {
            chargingProfileId: p.chargingProfile.id,
            stackLevel: p.chargingProfile.stackLevel,
            chargingProfilePurpose: p.chargingProfile.chargingProfilePurpose,
            chargingProfileKind: p.chargingProfile.chargingProfileKind,
            chargingSchedule: schedule,
          },
        },
      };
    }

    case "ClearChargingProfile": {
      const p = payload as { chargingProfileId?: number };
      return { action: "ClearChargingProfile", payload: { id: p.chargingProfileId } };
    }

    default:
      throw new UnsupportedFor16Error(action);
  }
}
