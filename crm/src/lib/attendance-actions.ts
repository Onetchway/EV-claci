"use client";

import type { Role } from "./constants";
import { checkIn, checkOut } from "./db/attendance";
import { getCurrentCoords, nearestOffice } from "./geo";
import { isAdmin } from "./permissions";
import type { Actor, AppUser, OfficeLocation } from "./types";

/** Admin/Super Admin are always exempt from the office geofence; anyone else needs the flag explicitly granted from Team & Roles. */
export function canBypassGeofence(role: Role | null | undefined, profile: Pick<AppUser, "bypassGeofence"> | null | undefined): boolean {
  return (role ? isAdmin(role) : false) || Boolean(profile?.bypassGeofence);
}

/** Shared by the Attendance page and the header quick-toggle so geofence enforcement can't drift between the two. */
export async function performCheckIn(
  profile: AppUser, actor: Actor, offices: OfficeLocation[], role: Role | null,
): Promise<void> {
  const coords = await getCurrentCoords();
  const nearest = nearestOffice(coords, offices);
  const bypass = canBypassGeofence(role, profile);
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
  const coords = await getCurrentCoords();
  const nearest = nearestOffice(coords, offices);
  const bypass = canBypassGeofence(role, profile);
  await checkOut(profile.uid, coords, bypass ? { ...nearest, withinGeofence: true } : nearest, actor);
}
