/**
 * OCPI 2.2.1 payload shapes this app sends or accepts. Covers Credentials,
 * Locations/Tariffs/Sessions/CDRs (SENDER, we're the CPO), Commands and
 * ChargingProfiles (RECEIVER), roaming Sessions/CDRs (RECEIVER, we're an
 * eMSP client of a partner CPO), Tokens (RECEIVER, a partner eMSP pushes
 * their whitelist to us) and HubClientInfo (RECEIVER only — we don't
 * operate as a hub). Not implemented: the Payments/PTP module (2.2.1's
 * physical card-terminal integration surface — a different hardware
 * integration than anything this app otherwise does).
 */

export interface OcpiResponse<T> {
  data: T;
  status_code: number;
  status_message: string;
  timestamp: string;
}

export interface OcpiCredentialsRole {
  role: "CPO" | "EMSP" | "HUB" | "NSP" | "OTHER" | "SCSP";
  business_details: { name: string };
  party_id: string;
  country_code: string;
}

export interface OcpiCredentials {
  token: string;
  url: string;
  roles: OcpiCredentialsRole[];
}

export interface OcpiVersion {
  version: string;
  url: string;
}

export interface OcpiEndpoint {
  identifier: string;
  role: "SENDER" | "RECEIVER";
  url: string;
}

export interface OcpiConnector {
  id: string;
  standard: string;
  format: "SOCKET" | "CABLE";
  power_type: "AC_1_PHASE" | "AC_3_PHASE" | "DC";
  max_voltage: number;
  max_amperage: number;
  max_electric_power: number;
  last_updated: string;
}

export interface OcpiEvse {
  uid: string;
  evse_id: string;
  status: "AVAILABLE" | "BLOCKED" | "CHARGING" | "INOPERATIVE" | "OUTOFORDER" | "PLANNED" | "REMOVED" | "RESERVED" | "UNKNOWN";
  connectors: OcpiConnector[];
  last_updated: string;
}

export interface OcpiLocation {
  country_code: string;
  party_id: string;
  id: string;
  publish: boolean;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates: { latitude: string; longitude: string };
  evses: OcpiEvse[];
  last_updated: string;
}

export interface OcpiTariff {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  elements: Array<{ price_components: Array<{ type: "ENERGY" | "TIME" | "FLAT"; price: number; vat: number; step_size: number }> }>;
  last_updated: string;
}

export interface OcpiSession {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time?: string;
  kwh: number;
  currency: string;
  status: "ACTIVE" | "COMPLETED" | "INVALID" | "PENDING" | "RESERVATION";
  last_updated: string;
}

export type OcpiCommandType = "START_SESSION" | "STOP_SESSION" | "RESERVE_NOW" | "CANCEL_RESERVATION" | "UNLOCK_CONNECTOR";

export interface OcpiCommandResponse {
  result: "ACCEPTED" | "REJECTED" | "NOT_SUPPORTED" | "UNKNOWN_SESSION" | "UNKNOWN_LOCATION";
  timeout: number;
  message?: { language: string; text: string };
}

/** Posted async to the partner's response_url once the command actually resolves — collapsed into the same request/response cycle here rather than fired from background code (see commands route comment for why). */
export interface OcpiCommandResult {
  result: "ACCEPTED" | "FAILED" | "REJECTED" | "TIMEOUT";
  message?: { language: string; text: string };
}

export interface OcpiStartSessionRequest {
  response_url: string;
  token: { uid: string; contract_id?: string };
  location_id: string;
  evse_uid?: string;
}

export interface OcpiStopSessionRequest {
  response_url: string;
  session_id: string;
}

export interface OcpiUnlockConnectorRequest {
  response_url: string;
  location_id: string;
  evse_uid: string;
  connector_id: string;
}

/**
 * OCPI 2.2.1 Charging Profiles module (RECEIVER side — an eMSP pushes a
 * profile onto one of our active sessions). Maps onto the OCPP 2.0.1
 * SetChargingProfile/ClearChargingProfile commands the load balancer
 * (ocpp-server/src/load-balancer.ts) already sends for zone capping — same
 * OCPP mechanism, just driven by a roaming partner instead of our own
 * automation. GET (retrieve the currently-active profile) isn't
 * implemented: reading it back would mean waiting on an OCPP
 * GetChargingProfiles round-trip synchronously, and nothing here currently
 * tracks "what profile is this charger running" as queryable state.
 */
export interface OcpiChargingProfilePeriod {
  start_period: number;
  limit: number;
}

export interface OcpiChargingProfile {
  start_date_time?: string;
  duration?: number;
  charging_rate_unit: "W" | "A";
  min_charging_power?: number;
  charging_profile_period: OcpiChargingProfilePeriod[];
}

export interface OcpiSetChargingProfileRequest {
  response_url: string;
  charging_profile: OcpiChargingProfile;
}

export interface OcpiChargingProfileResponse {
  result: "ACCEPTED" | "REJECTED" | "UNKNOWN_SESSION" | "NOT_SUPPORTED";
  timeout: number;
}

export interface OcpiChargingProfileResult {
  result: "ACCEPTED" | "FAILED" | "REJECTED" | "UNKNOWN_SESSION";
}

export interface OcpiCdr {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time: string;
  total_energy: number;
  total_cost: { excl_vat: number; incl_vat: number };
  currency: string;
  last_updated: string;
}

/** Tokens module — pushed to us (RECEIVER, we're the CPO) by a roaming eMSP partner via PUT/PATCH/DELETE on cpo/tokens/[country_code]/[party_id]/[token_uid]. */
export interface OcpiToken {
  country_code: string;
  party_id: string;
  uid: string;
  type: "AD_HOC_USER" | "APP_USER" | "OTHER" | "RFID";
  contract_id: string;
  visual_number?: string;
  issuer: string;
  group_id?: string;
  valid: boolean;
  whitelist: "ALWAYS" | "ALLOWED" | "ALLOWED_OFFLINE" | "NEVER";
  language?: string;
  default_profile_type?: string;
  energy_contract?: { supplier_name: string; contract_id?: string };
  last_updated: string;
}

/** HubClientInfo module — a connected hub pushes each connected party's live status here so every party can see who else is reachable through the hub. We only implement RECEIVER (accepting the push); we don't operate as a hub ourselves. */
export interface OcpiHubClientInfo {
  country_code: string;
  party_id: string;
  role: "CPO" | "EMSP" | "HUB" | "NSP" | "OTHER" | "SCSP";
  status: "CONNECTED" | "OFFLINE" | "PLANNED" | "SUSPENDED";
  last_updated: string;
}
