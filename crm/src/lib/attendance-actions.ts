"use client";

import { evaluateCheckIn } from "./attendance-rules";
import type { Role } from "./constants";
import { checkIn, checkOut } from "./db/attendance";
import { hasApprovedWfhToday } from "./db/attendance-requests";
import { getRosterWeek } from "./db/roster";
import { getSettingsOnce } from "./db/settings";
import { mondayOf, ymd } from "./dates";
import { getCurrentCoords, nearestOffice, type Coords, type NearestOffice } from "./geo";
import { isAdmin } from "./permissions";
import type { Actor, AppUser, OfficeLocation } from "./types";

/** Admin/Super Admin are always exempt from the office geofence; anyone else needs the flag explicitly granted from Team & Roles. */
export function canBypassGeofence(role: Role | null | undefined, profile: Pick<AppUser, "bypassGeofence"> | null | undefined): boolean {
  return (role ? isAdmin(role) : false) || Boolean(profile?.bypassGeofence);
}

const NO_LOCATION: NearestOffice = { officeId: null, officeName: null, distanceMeters: null, withinGeofence: true };

/**
 * A geofence-exempt person (an admin, or anyone else granted the flag) can
 * check in even when the browser has no location at all — permission
 * denied, GPS off, whatever. Location is only mandatory for someone the
 * geofence actually has to check. Everyone else still gets their real
 * coordinates recorded when the browser will give them.
 */
async function resolveLocation(bypass: boolean, offices: OfficeLocation[]): Promise<{ coords: Coords | null; nearest: NearestOffice }> {
  try {
    const coords = await getCurrentCoords();
    return { coords, nearest: nearestOffice(coords, offices) };
  } catch (e) {
    if (!bypass) throw e;
    return { coords: null, nearest: NO_LOCATION };
  }
}

/** Shared by the Attendance page and the header quick-toggle so geofence enforcement can't drift between the two. */
export async function performCheckIn(
  profile: AppUser, actor: Actor, offices: OfficeLocation[], role: Role | null,
): Promise<void> {
  const wfhToday = await hasApprovedWfhToday(profile.uid, ymd(new Date()));
  const bypass = canBypassGeofence(role, profile) || wfhToday;
  const { coords, nearest } = await resolveLocation(bypass, offices);
  if (!bypass && !nearest.withinGeofence) {
    const accuracyNote = coords?.accuracyMeters
      ? ` (your device's location is only accurate to about ±${coords.accuracyMeters}m — on a laptop without GPS this can be off; try a phone if you're actually on-site)`
      : "";
    throw new Error(
      nearest.officeName
        ? `You're ${nearest.distanceMeters}m from ${nearest.officeName} — check-in needs you on-site${accuracyNote}.`
        : `You're too far from any registered office to check in${accuracyNote}.`,
    );
  }
  const now = new Date();
  const rules = await getSettingsOnce().then((s) => s.attendance);
  const roster = await getRosterWeek(profile.uid, mondayOf(now));
  const evaluated = evaluateCheckIn(now, profile.scheduleMode, roster, rules);
  // An approved WFH day is a full paid day regardless of check-in time —
  // the office lateness rules don't apply to someone who was never expected
  // at the office in the first place.
  const computed = wfhToday ? { status: "WFH" as const, lateMinutes: 0 } : (evaluated ?? { status: "PRESENT" as const, lateMinutes: 0 });
  await checkIn(
    profile.uid, profile.name, coords, bypass ? { ...nearest, withinGeofence: true } : nearest, actor,
    computed,
  );
}

export async function performCheckOut(
  profile: AppUser, actor: Actor, offices: OfficeLocation[], role: Role | null,
): Promise<void> {
  const bypass = canBypassGeofence(role, profile);
  const { coords, nearest } = await resolveLocation(bypass, offices);
  await checkOut(profile.uid, coords, bypass ? { ...nearest, withinGeofence: true } : nearest, actor);
}
