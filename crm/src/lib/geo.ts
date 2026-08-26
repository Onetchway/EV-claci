/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface Coords {
  lat: number;
  lng: number;
}

/** Wraps the browser Geolocation API in a promise with a sane timeout — rejects with a message safe to show the user directly. */
export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location isn't available on this device/browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Location permission was denied — allow location access to check in/out."));
        } else {
          reject(new Error("Couldn't get your location. Check your GPS/network and try again."));
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

export interface NearestOffice {
  officeId: string | null;
  officeName: string | null;
  distanceMeters: number | null;
  withinGeofence: boolean;
}

/** Finds the closest active office to a point and whether it's within that office's own radius. No active offices at all means geofencing isn't configured yet, so the punch is allowed through unchecked. */
export function nearestOffice(
  coords: Coords,
  offices: { id: string; name: string; lat: number; lng: number; radiusMeters: number; active: boolean }[],
): NearestOffice {
  const active = offices.filter((o) => o.active);
  if (active.length === 0) return { officeId: null, officeName: null, distanceMeters: null, withinGeofence: true };

  let best: { office: (typeof active)[number]; distance: number } | null = null;
  for (const office of active) {
    const distance = haversineMeters(coords.lat, coords.lng, office.lat, office.lng);
    if (!best || distance < best.distance) best = { office, distance };
  }
  if (!best) return { officeId: null, officeName: null, distanceMeters: null, withinGeofence: true };
  return {
    officeId: best.office.id,
    officeName: best.office.name,
    distanceMeters: Math.round(best.distance),
    withinGeofence: best.distance <= best.office.radiusMeters,
  };
}
