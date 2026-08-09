const env = require('../config/env');

/**
 * Reverse-geocodes lat/lng into a human-readable address via OpenStreetMap Nominatim.
 * Best-effort: on any failure (offline site, rate limit, etc.) falls back to a
 * coordinate-only string so photo stamping/PDF generation never blocks on this.
 */
async function reverseGeocode(lat, lng) {
  const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`;
    const res = await fetch(url, {
      headers: { 'User-Agent': env.nominatimUserAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data?.display_name || fallback;
  } catch (err) {
    return fallback;
  }
}

module.exports = { reverseGeocode };
