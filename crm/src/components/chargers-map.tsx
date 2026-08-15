"use client";

/**
 * Live charger locations. Uses Leaflet + OpenStreetMap tiles rather than
 * Google Maps deliberately — no API key/billing account needed, so this
 * works immediately without asking for credentials we don't have.
 * Coordinates are entered manually on the charger's edit form (no
 * geocoding dependency either); chargers without lat/lng just don't
 * appear here, shown as a count instead.
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export interface MapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  online: boolean;
}

const ICON_ONLINE = new L.DivIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const ICON_OFFLINE = new L.DivIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#9ca3af;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function ChargersMap({ pins }: { pins: MapPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = pins.map((p) => L.marker([p.lat, p.lng], { icon: p.online ? ICON_ONLINE : ICON_OFFLINE }).bindTooltip(p.label));
    markers.forEach((m) => m.addTo(map));
    if (pins.length > 0) {
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 14 });
    }
    return () => { markers.forEach((m) => m.remove()); };
  }, [pins]);

  return <div ref={containerRef} className="h-[360px] w-full rounded-xl" />;
}
