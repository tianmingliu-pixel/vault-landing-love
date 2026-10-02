"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

/* Real geographic basemap: OpenStreetMap data via OpenFreeMap vector tiles (no API key), rendered with MapLibre GL. */

export type GeoPoint = { lon: number; lat: number; name: string; city: string; networks: number; approx: boolean };
type Props = { center: { lat: number; lon: number }; zoom: number; points: GeoPoint[]; label: string };

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";


function toFeatures(points: GeoPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
      properties: { name: point.name, city: point.city, networks: point.networks, approx: point.approx ? 1 : 0 },
    })),
  };
}

export default function GeoMap({ center, zoom, points, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({ center, zoom, points });

  useEffect(() => {
    latest.current = { center, zoom, points };
  }, [center, zoom, points]);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const initial = latest.current;
    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: [initial.center.lon, initial.center.lat],
      zoom: initial.zoom,
      cooperativeGestures: true, // Ctrl + scroll (or two fingers) to zoom, so the page still scrolls normally
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      map.addSource("facilities", { type: "geojson", data: toFeatures(latest.current.points) });
      map.addLayer({
        id: "facility-glow",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "networks"], 0, 7, 100, 14, 600, 26],
          "circle-color": "#f2b954",
          "circle-opacity": 0.18,
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: "facility-dots",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "networks"], 0, 3, 100, 6, 600, 10],
          // Facilities placed at city level (no exact coordinates in PeeringDB) are drawn grey.
          "circle-color": ["case", ["==", ["get", "approx"], 1], "#94a3b8", "#f2b954"],
          "circle-stroke-color": "#020617",
          "circle-stroke-width": 1.5,
        },
      });
      readyRef.current = true;
    });

    map.on("click", "facility-dots", (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const { name, city, networks, approx } = feature.properties as { name: string; city: string; networks: number; approx: number };
      const [lon, lat] = (feature.geometry as Point).coordinates;
      const body = document.createElement("div");
      body.style.cssText = "color:#0f172a;font:12px system-ui;max-width:220px";
      const title = document.createElement("strong");
      title.textContent = name;
      const meta = document.createElement("div");
      meta.textContent = `${city} · ${networks} networks${approx ? " · city-level location" : ""}`;
      body.append(title, meta);
      new maplibregl.Popup({ offset: 10 }).setLngLat([lon, lat]).setDOMContent(body).addTo(map);
    });
    map.on("mouseenter", "facility-dots", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "facility-dots", () => (map.getCanvas().style.cursor = ""));

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Follow the selected city.
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.lon, center.lat], zoom, essential: true, speed: 1.4 });
  }, [center.lat, center.lon, zoom]);

  // Refresh markers when the country changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("facilities") as GeoJSONSource | undefined)?.setData(toFeatures(points));
  }, [points]);

  return (
    <div className="relative h-[520px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="h-full w-full" role="region" aria-label={`Street map of ${label} with its data centres`} />
      <p className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-slate-950/80 px-2 py-1 font-mono text-[11px] text-slate-300">
        {label} · Ctrl + scroll to zoom to street level
      </p>
    </div>
  );
}
