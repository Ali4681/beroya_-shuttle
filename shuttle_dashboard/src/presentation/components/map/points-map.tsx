"use client";

import { useEffect, useRef, useState } from "react";
import type {
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
} from "leaflet";
import { cn } from "@/shared/lib/cn";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  /** Short text inside the marker (sequence number, initials…). */
  badge?: string;
  title?: string;
  variant?: "bus" | "bus-delayed" | "bus-stale" | "stop" | "institution";
};

type PointsMapProps = {
  points: MapPoint[];
  /** Draws a line through the points in order (route / trip stops). */
  path?: boolean;
  className?: string;
  onPointClick?: (id: string) => void;
  selectedId?: string | null;
};

const DEFAULT_CENTER: [number, number] = [36.19934, 37.15822];

function markerHtml(point: MapPoint, selected: boolean) {
  const variant = point.variant ?? "stop";
  const badge = (point.badge ?? "").replace(/[<>&"]/g, "");
  const ring = selected ? ' style="outline:3px solid var(--accent);outline-offset:2px"' : "";
  if (variant.startsWith("bus")) {
    const modifier =
      variant === "bus-delayed" ? " live-bus-marker-dot--delayed" : variant === "bus-stale" ? " live-bus-marker-dot--stale" : "";
    return `<span class="live-bus-marker-dot${modifier}"${ring}>${badge || "●"}</span>`;
  }
  const modifier = variant === "institution" ? " stop-marker-dot--institution" : "";
  return `<span class="stop-marker-dot${modifier}"${ring}>${badge}</span>`;
}

export function PointsMap({ points, path, className, onPointClick, selectedId }: PointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, LeafletMarker>());
  const lineRef = useRef<LeafletPolyline | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const fittedRef = useRef(false);
  const clickRef = useRef(onPointClick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clickRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const markers = markersRef.current;

    async function setup() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false }).setView(DEFAULT_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      setReady(true);
    }

    void setup();
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      lineRef.current = null;
      markers.clear();
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    const markers = markersRef.current;
    const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const seen = new Set<string>();

    for (const point of valid) {
      seen.add(point.id);
      const icon = L.divIcon({
        className: "live-bus-marker",
        html: markerHtml(point, point.id === selectedId),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const existing = markers.get(point.id);
      if (existing) {
        existing.setLatLng([point.lat, point.lng]);
        existing.setIcon(icon);
        if (point.title) existing.setTooltipContent(point.title);
      } else {
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(layer);
        if (point.title) marker.bindTooltip(point.title, { direction: "top", offset: [0, -14] });
        marker.on("click", () => clickRef.current?.(point.id));
        markers.set(point.id, marker);
      }
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    lineRef.current?.remove();
    lineRef.current = null;
    if (path && valid.length > 1) {
      lineRef.current = L.polyline(
        valid.map((point) => [point.lat, point.lng] as [number, number]),
        { color: "#1aa8b4", className: "points-map-line", weight: 4, opacity: 0.75 },
      ).addTo(layer);
    }

    if (!fittedRef.current && valid.length > 0) {
      fittedRef.current = true;
      if (valid.length === 1) {
        map.setView([valid[0].lat, valid[0].lng], 15);
      } else {
        map.fitBounds(L.latLngBounds(valid.map((point) => [point.lat, point.lng])), { padding: [40, 40] });
      }
    }
  }, [points, path, ready, selectedId]);

  return <div ref={containerRef} className={cn("live-map-shell h-[420px]", className)} />;
}
