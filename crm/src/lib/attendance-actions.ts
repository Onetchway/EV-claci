"use client";

import type { Role } from "./constants";
import { checkIn, checkOut } from "./db/attendance";
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
  const bypass = canBypassGeofence(role, profile);
  const { coords, nearest } = await resolveLocation(bypass, offices);
  if (!bypass && !nearest.withinGeofence) {
    throw new Error(
      nearest.officeName
        ? `You're ${nearest.distanceMeters}m from ${nearest.officeName} — check-in needs you on-site.`
        : "You're too far from any registered office to check in.",
    );
  }
  await checkIn(profile.uid, profile.name, coords, bypass ? { ...nearest, withinGeofence: true } : nearest, actor);
}

export async function performCheckOut(
  profile: AppUser, actor: Actor, offices: OfficeLocation[], role: Role | null,
): Promise<void> {
  const bypass = canBypassGeofence(role, profile);
  const { coords, nearest } = await resolveLocation(bypass, offices);
  await checkOut(profile.uid, coords, bypass ? { ...nearest, withinGeofence: true } : nearest, actor);
}
