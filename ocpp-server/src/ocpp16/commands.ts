/**
 * Translates the 2.0.1-shaped outbound actions every caller in this
 * codebase already sends (CRM API routes, OCPI Commands/ChargingProfiles
 * routes, the zone load balancer, depot scheduling) into OCPP 1.6J's
 * action names and payload shapes, for the one case that actually needs
 * it: ocpp/commands.ts's sendCommand, when the target charger negotiated
 * "ocpp1.6" instead of "ocpp2.0.1".
 *
 * GetVariables/SetVariables/GetLog are translated to their nearest 1.6
 * equivalent (GetConfiguration/ChangeConfiguration/GetDiagnostics) below.
 * The mapping is lossy in both directions — 2.0.1's component/variable
 * model has no real 1.6 counterpart, so only the single common case (one
 * config key by name) is translated; anything with more than one
 * component/variable in the request throws rather than silently dropping
 * entries.
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

    case "GetVariables": {
      const p = payload as { getVariableData?: Array<{ variable?: { name?: string } }> };
      const items = p.getVariableData ?? [];
      if (items.length !== 1) throw new UnsupportedFor16Error("GetVariables (only single-key lookups translate to 1.6 GetConfiguration)");
      const key = items[0]?.variable?.name;
      return { action: "GetConfiguration", payload: key ? { key: [key] } : {} };
    }

    case "SetVariables": {
      const p = payload as { setVariableData?: Array<{ variable?: { name?: string }; attributeValue?: string }> };
      const items = p.setVariableData ?? [];
      if (items.length !== 1) throw new UnsupportedFor16Error("SetVariables (only single-key writes translate to 1.6 ChangeConfiguration)");
      const [item] = items;
      const key = item?.variable?.name;
      if (!key) throw new UnsupportedFor16Error("SetVariables (missing variable name)");
      return { action: "ChangeConfiguration", payload: { key, value: item?.attributeValue ?? "" } };
    }

    case "GetLog": {
      const p = payload as { requestId?: number; log?: { remoteLocation?: string } };
      return {
        action: "GetDiagnostics",
        payload: { location: p.log?.remoteLocation, requestId: p.requestId },
      };
    }

    default:
      throw new UnsupportedFor16Error(action);
  }
}
