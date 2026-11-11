"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Location } from "iconsax-react-v2";
import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib/cn";
import "leaflet/dist/leaflet.css";

export type MapCoords = {
  lat: number;
  lng: number;
};

type LocationPickerMapProps = {
  lat: number;
  lng: number;
  onChange: (coords: MapCoords) => void;
  compact?: boolean;
  className?: string;
};

const DEFAULT_CENTER: MapCoords = { lat: 36.19934, lng: 37.15822 };

export function LocationPickerMap({
  lat,
  lng,
  onChange,
  compact = false,
  className,
}: LocationPickerMapProps) {
  const t = useTranslations("Map");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hint, setHint] = useState(t("mapHint"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function setupMap() {
      const L = (await import("leaflet")).default;

      if (cancelled || !containerRef.current || mapRef.current) return;

      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const center =
        hasCoords && !(lat === 0 && lng === 0) ? { lat, lng } : DEFAULT_CENTER;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([center.lat, center.lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomleft" }).addTo(map);

      const markerIcon = L.divIcon({
        className: "branch-map-marker",
        html: `<span class="branch-map-marker-pin"></span>`,
        iconSize: [28, 36],
        iconAnchor: [14, 34],
      });

      const marker = L.marker([center.lat, center.lng], {
        icon: markerIcon,
        draggable: true,
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        onChangeRef.current({
          lat: Number(position.lat.toFixed(5)),
          lng: Number(position.lng.toFixed(5)),
        });
        setHint(t("draggedHint"));
      });

      map.on("click", (event) => {
        const next = {
          lat: Number(event.latlng.lat.toFixed(5)),
          lng: Number(event.latlng.lng.toFixed(5)),
        };
        marker.setLatLng(next);
        onChangeRef.current(next);
        setHint(t("clickedHint"));
      });

      mapRef.current = map;
      markerRef.current = marker;
      setReady(true);

      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
      requestAnimationFrame(() => map.invalidateSize());
    }

    void setupMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Initialize once; later updates sync via the coords effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!ready || !map || !marker) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const current = marker.getLatLng();
    if (
      Math.abs(current.lat - lat) < 0.00001 &&
      Math.abs(current.lng - lng) < 0.00001
    ) {
      return;
    }

    marker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }, [lat, lng, ready]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setHint(t("geoUnsupported"));
      return;
    }

    setHint(t("locating"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        };
        onChange(next);
        mapRef.current?.setView([next.lat, next.lng], 16);
        markerRef.current?.setLatLng([next.lat, next.lng]);
        setHint(t("locatedHint"));
      },
      () => {
        setHint(t("geoFailed"));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function searchLocation() {
    const value = query.trim();
    if (!value) return;

    setSearching(true);
    setHint(t("searching"));

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(value)}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );
      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
      }>;

      if (!results.length) {
        setHint(t("notFound"));
        return;
      }

      const next = {
        lat: Number(Number(results[0].lat).toFixed(5)),
        lng: Number(Number(results[0].lon).toFixed(5)),
      };
      onChange(next);
      mapRef.current?.setView([next.lat, next.lng], 16);
      markerRef.current?.setLatLng([next.lat, next.lng]);
      setHint(results[0].display_name ?? t("searchFound"));
    } catch {
      setHint(t("searchFailed"));
    } finally {
      setSearching(false);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void searchLocation();
    }
  }

  return (
    <div
      className={cn(
        "branch-map-shell",
        compact && "branch-map-shell--compact",
        className,
      )}
    >
      <div className="branch-map-controls">
        <button
          type="button"
          onClick={useCurrentLocation}
          className="branch-map-locate-btn"
        >
          <Location
            size={compact ? 16 : 18}
            color="currentColor"
            variant="Bold"
          />
          <span>{t("useCurrentLocation")}</span>
        </button>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={t("enterLocation")}
          className="branch-map-search-input"
          aria-label={t("enterLocation")}
          disabled={searching}
        />
      </div>

      <div ref={containerRef} className="branch-map-canvas" />
      <p className="branch-map-hint">{hint}</p>
    </div>
  );
}
