"use client";

/**
 * Turns one spreadsheet row into a lead draft, or an error message explaining
 * why it cannot be imported.
 *
 * Labels are matched as well as codes, so a file exported from this app
 * re-imports cleanly, and a hand-written sheet saying "Direct Call" or
 * "Highway, Ring Road" also works without anyone learning our internal names.
 */

import {
  FUNDING_MODES, FUNDING_MODE_LABEL, LAND_TYPES, LAND_TYPE_LABEL, LEAD_TYPES,
  LEAD_TYPE_LABEL,
  LOCATION_TYPES, LOCATION_TYPE_LABEL, OWNERSHIP_LABEL, OWNERSHIP_TYPES,
  OWNER_TYPES, OWNER_TYPE_LABEL, POWER_LOADS, POWER_LOAD_LABEL, SOURCES,
  SOURCE_LABEL, type FundingMode, type LandType, type LeadType, type LocationType,
  type Ownership, type OwnerType, type PowerLoad, type Source,
} from "./constants";
import { DEFAULT_FINANCING, type LeadDraft } from "./db/leads";
import { parseSheetDate, parseSheetNumber } from "./spreadsheet";
import type { Actor } from "./types";
import { isValidEmail, isValidPhone, normalisePhone } from "./utils";

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Matches a cell against both the internal code and the human label. */
function matchEnum<T extends string>(
  value: string,
  options: readonly T[],
  labels: Record<T, string>,
): T | null {
  if (!value.trim()) return null;
  const v = key(value);
  return (
    options.find((o) => key(o) === v) ??
    options.find((o) => key(labels[o]) === v) ??
    null
  );
}

/** "Highway, Ring Road" → ["HIGHWAY", "RING_ROAD"], unknown entries dropped. */
function matchMulti<T extends string>(
  value: string,
  options: readonly T[],
  labels: Record<T, string>,
): T[] {
  return value
    .split(/[,;/|]/)
    .map((part) => matchEnum(part, options, labels))
    .filter((x): x is T => x !== null);
}

const YES = new Set(["yes", "y", "true", "1", "haan", "ha"]);

export function buildLeadDraft(
  get: (column: string) => string,
  actor: Actor,
): LeadDraft | string {
  const name = get("Client Name").trim();
  if (!name) return "Client name is missing.";

  const phone = normalisePhone(get("Phone"));
  if (!phone) return "Phone number is missing.";
  if (!isValidPhone(phone)) return `“${get("Phone")}” is not a valid 10-digit Indian mobile number.`;

  const city = get("City").trim();
  if (!city) return "City is missing.";

  const email = get("Email").trim();
  if (email && !isValidEmail(email)) return `“${email}” is not a valid email address.`;

  const typeRaw = get("Type").trim();
  const type: LeadType =
    matchEnum(typeRaw, LEAD_TYPES, LEAD_TYPE_LABEL) ??
    (typeRaw.toLowerCase().includes("site") ? "SITE" : "FRANCHISE");

  const source: Source = matchEnum(get("Source"), SOURCES, SOURCE_LABEL) ?? "OTHER";

  const locationName = get("Location Name").trim();
  if (type === "SITE" && !locationName) {
    return "A site enquiry needs a location name.";
  }

  const altPhoneRaw = get("Alternate Phone").trim();
  const altPhone = altPhoneRaw ? normalisePhone(altPhoneRaw) : "";
  if (altPhone && !isValidPhone(altPhone)) {
    return `Alternate phone “${altPhoneRaw}” is not a valid 10-digit number.`;
  }

  const fundingMode: FundingMode =
    matchEnum(get("Funding Mode"), FUNDING_MODES, FUNDING_MODE_LABEL) ?? "SELF";
  const bank = get("Bank").trim();

  const followUp = parseSheetDate(get("Next Follow-up"));

  return {
    type,
    client: {
      name,
      phone,
      altPhone,
      email,
      company: get("Company").trim(),
      city,
      state: get("State").trim(),
      address: get("Address").trim(),
      pan: get("PAN").trim().toUpperCase(),
      gstin: get("GSTIN").trim().toUpperCase(),
    },
    source,
    sourceDetail: get("Source Detail").trim(),
    config: [],
    extras: [],
    discount: 0,
    financing: {
      ...DEFAULT_FINANCING,
      mode: fundingMode,
      bank,
      stage: fundingMode === "SELF" ? "NOT_APPLICABLE" : "ENQUIRY",
    },
    site: {
      locationName,
      mapsLink: get("Google Maps Link").trim(),
      lat: null,
      lng: null,
      locationTypes: matchMulti<LocationType>(get("Location Type"), LOCATION_TYPES, LOCATION_TYPE_LABEL),
      landType: matchEnum<LandType>(get("Land Type"), LAND_TYPES, LAND_TYPE_LABEL),
      ownerType: matchEnum<OwnerType>(get("Owner Type"), OWNER_TYPES, OWNER_TYPE_LABEL),
      ownership: matchEnum<Ownership>(get("Property Owner"), OWNERSHIP_TYPES, OWNERSHIP_LABEL),
      commercialModelInterested: YES.has(get("Commercial Model").trim().toLowerCase()),
      powerLoad: matchEnum<PowerLoad>(get("Power Load"), POWER_LOADS, POWER_LOAD_LABEL),
      sanctionedLoadKva: parseSheetNumber(get("Sanctioned Load (kVA)")),
      spaceAvailableSqft: parseSheetNumber(get("Space (sq.ft)")),
      remarks: get("Remarks").trim(),
    },
    tags: ["imported"],
    nextFollowUpAt: followUp,
    expectedCloseAt: null,
    // Imported leads land with the importer, who can reassign in bulk after.
    ownerId: actor.uid,
    ownerName: actor.name,
  };
}
