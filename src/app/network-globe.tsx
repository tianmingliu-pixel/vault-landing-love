"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/* ---------- zoom / fullscreen chrome shared by both views ---------- */

export function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const update = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };
  return { ref, full, toggle };
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset, full, onFullscreen }: {
  onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; full: boolean; onFullscreen: () => void;
}) {
  const buttons = [
    { label: "Zoom in", icon: Plus, action: onZoomIn },
    { label: "Zoom out", icon: Minus, action: onZoomOut },
    { label: "Reset view", icon: RotateCcw, action: onReset },
    { label: full ? "Exit full screen" : "Full screen", icon: full ? Minimize2 : Maximize2, action: onFullscreen },
  ];
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-950/85">
      {buttons.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          onClick={action}
          className="grid h-9 w-9 place-items-center border-b border-slate-800 text-slate-300 last:border-b-0 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400"
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/* ---------- data ---------- */

export type Landing = [name: string, country: string, lon: number, lat: number];
export type Cable = { id: string; name: string; color: string; countries: string[]; landings: number[]; paths: number[][] };
export type CableData = { source: string; license: string; landings: Landing[]; cables: Cable[] };

type Topology = { transform?: { scale: [number, number]; translate: [number, number] }; arcs: [number, number][][] };

// TopoJSON arcs are shared borders, so drawing every arc once renders all coastlines and borders without duplicates.
function decodeArcs(topology: Topology): number[][] {
  const scale = topology.transform?.scale ?? [1, 1];
  const translate = topology.transform?.translate ?? [0, 0];
  const quantized = Boolean(topology.transform);
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const flat: number[] = [];
    for (const [a, b] of arc) {
      x = quantized ? x + a : a;
      y = quantized ? y + b : b;
      flat.push(x * scale[0] + translate[0], y * scale[1] + translate[1]);
    }
    return flat;
  });
}

/** Loads the cable dataset, plus optional country borders if /data/countries-110m.json is present. */
export function useCableData() {
  const [data, setData] = useState<CableData | null>(null);
  const [borders, setBorders] = useState<number[][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/data/submarine-cables.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((json: CableData) => alive && setData(json))
      .catch(() => alive && setFailed(true));
    fetch("/data/countries-110m.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((topology: Topology | null) => {
        if (alive && topology?.arcs) setBorders(decodeArcs(topology));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return { data, borders, failed };
}

/** Mean position of a country's landing stations (a proxy for its coastal gateway, not its capital). */
export function landingCentroid(data: CableData, country: string) {
  const sum = new THREE.Vector3();
  let count = 0;
  for (const [, owner, lon, lat] of data.landings) {
    if (owner !== country) continue;
    sum.add(toVector(lon, lat, 1));
    count++;
  }
  if (!count) return null;
  sum.normalize();
  return { lat: (Math.asin(sum.y) * 180) / Math.PI, lon: (Math.atan2(sum.x, sum.z) * 180) / Math.PI };
}

/* ---------- shared helpers ---------- */

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(MOTION_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}

type ViewProps = { data: CableData; borders: number[][] | null; selected: string | null; onSelect: (country: string) => void };

export const RADIUS = 1.6;
export const CAMERA_DISTANCE = 5.2;
export const MIN_DISTANCE = RADIUS + 0.3;
export const MAX_DISTANCE = 8;
export const MAX_PULSES = 40;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function toVector(lon: number, lat: number, distance = RADIUS) {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(distance * Math.cos(la) * Math.sin(lo), distance * Math.sin(la), distance * Math.cos(la) * Math.cos(lo));
}

// Converts a flat [lon, lat, ...] polyline into points on the sphere, densified so long spans follow the curvature.
export function spherePolyline(flat: number[], distance: number) {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < flat.length; index += 2) {
    const next = toVector(flat[index], flat[index + 1], distance);
    const previous = points[points.length - 1];
    if (previous) {
      const steps = Math.ceil(previous.angleTo(next) / 0.035);
      for (let step = 1; step < steps; step++) points.push(previous.clone().lerp(next, step / steps).setLength(distance));
    }
    points.push(next);
  }
  return points;
}

export function segmentPositions(lines: THREE.Vector3[][]) {
  const positions: number[] = [];
  for (const line of lines) {
    for (let index = 1; index < line.length; index++) {
      const a = line[index - 1];
      const b = line[index];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  return new THREE.Float32BufferAttribute(positions, 3);
}

/* ---------- 3D globe ---------- */

export function CableGlobe3D({ data, borders, selected, onSelect }: ViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ select: (country: string | null) => void; zoom: (factor: number) => void; reset: () => void } | null>(null);
  const selectedRef = useRef(selected);
  const { ref: frameRef, full, toggle: toggleFullscreen } = useFullscreen();
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.copy(toVector(20, 20, CAMERA_DISTANCE));

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T) => (disposables.push(item), item);

    // Planet body and faint dot shell.
    scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(RADIUS - 0.01, 64, 40)), track(new THREE.MeshBasicMaterial({ color: 0x05121a }))));
    const dots: number[] = [];
    for (let index = 0; index < 2400; index++) {
      const y = 1 - (index / 2399) * 2;
      const ring = Math.sqrt(1 - y * y);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      dots.push(RADIUS * ring * Math.cos(angle), RADIUS * y, RADIUS * ring * Math.sin(angle));
    }
    const dotGeometry = track(new THREE.BufferGeometry());
    dotGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dots, 3));
    scene.add(new THREE.Points(dotGeometry, track(new THREE.PointsMaterial({ color: 0x2a8f99, size: 0.012, transparent: true, opacity: 0.35 }))));

    // Optional country borders / coastlines.
    if (borders) {
      const geometry = track(new THREE.BufferGeometry());
      geometry.setAttribute("position", segmentPositions(borders.map((arc) => spherePolyline(arc, RADIUS * 1.001))));
      scene.add(new THREE.LineSegments(geometry, track(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 }))));
    }

    // One line object per cable so each can be highlighted independently.
    const cables = data.cables.map((cable) => {
      const lines = cable.paths.map((path) => spherePolyline(path, RADIUS * 1.004));
      const geometry = track(new THREE.BufferGeometry());
      geometry.setAttribute("position", segmentPositions(lines));
      const material = track(new THREE.LineBasicMaterial({ color: new THREE.Color(cable.color), transparent: true, opacity: 0.45 }));
      scene.add(new THREE.LineSegments(geometry, material));
      const longest = lines.reduce((best, line) => (line.length > best.length ? line : best), lines[0] ?? []);
      return { cable, material, longest };
    });

    // Landing stations as a single point cloud with per-point colours.
    const landingPositions: number[] = [];
    data.landings.forEach(([, , lon, lat]) => {
      const point = toVector(lon, lat, RADIUS * 1.006);
      landingPositions.push(point.x, point.y, point.z);
    });
    const landingGeometry = track(new THREE.BufferGeometry());
    landingGeometry.setAttribute("position", new THREE.Float32BufferAttribute(landingPositions, 3));
    const colors = new Float32Array(data.landings.length * 3);
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    landingGeometry.setAttribute("color", colorAttribute);
    const landingPoints = new THREE.Points(landingGeometry, track(new THREE.PointsMaterial({ size: 0.028, vertexColors: true })));
    scene.add(landingPoints);

    // Pulse pool: signals travelling along the selected country's cables.
    const pulseGeometry = track(new THREE.SphereGeometry(0.022, 8, 8));
    const pulses = Array.from({ length: MAX_PULSES }, () => {
      const material = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const mesh = new THREE.Mesh(pulseGeometry, material);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, material, points: [] as THREE.Vector3[] };
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = true; // wheel and pinch; the wheel is gated below so page scrolling still works
    controls.zoomSpeed = 0.8;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.rotateSpeed = 0.55;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    const stopAutoRotate = () => (controls.autoRotate = false);
    controls.addEventListener("start", stopAutoRotate);

    // The wheel only zooms after the user clicks into the globe (or holds Ctrl / Cmd);
    // otherwise it is stopped before OrbitControls sees it, so the page scrolls normally.
    let engaged = false;
    const engage = () => (engaged = true);
    const disengage = () => (engaged = false);
    const gateWheel = (event: WheelEvent) => {
      if (!engaged && !event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    container.addEventListener("pointerdown", engage);
    container.addEventListener("pointerleave", disengage);
    container.addEventListener("wheel", gateWheel, { capture: true });

    let flyTarget: THREE.Vector3 | null = null;

    const select = (country: string | null) => {
      cables.forEach(({ cable, material }) => {
        const involved = country !== null && cable.countries.includes(country);
        material.opacity = country === null ? 0.45 : involved ? 1 : 0.05;
      });
      data.landings.forEach(([, owner], index) => {
        const [r, g, b] = country === null ? [0.86, 0.92, 0.95] : owner === country ? [0.95, 0.73, 0.33] : [0.3, 0.36, 0.42];
        colors.set([r, g, b], index * 3);
      });
      colorAttribute.needsUpdate = true;

      const involved = country === null ? [] : cables.filter(({ cable }) => cable.countries.includes(country));
      pulses.forEach((pulse, index) => {
        const source = involved[index];
        pulse.mesh.visible = Boolean(source && source.longest.length > 1);
        pulse.points = source?.longest ?? [];
        if (source) pulse.material.color.set(source.cable.color).lerp(new THREE.Color(0xffffff), 0.4);
      });

      if (country) {
        const centroid = landingCentroid(data, country);
        if (centroid) {
          flyTarget = toVector(centroid.lon, centroid.lat, camera.position.length());
          controls.autoRotate = false;
        }
      }
    };
    select(selectedRef.current);

    // Click (not drag) on a landing station selects its country.
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.04 };
    const pointer = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
    const onUp = (event: PointerEvent) => {
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const view = camera.position.clone().normalize();
      const hit = raycaster
        .intersectObject(landingPoints)
        .find((item) => item.index !== undefined && item.point.clone().normalize().dot(view) > 0.1);
      if (hit?.index !== undefined) onSelectRef.current(data.landings[hit.index][1]);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const media = window.matchMedia(MOTION_QUERY);

    const setDistance = (distance: number) => {
      camera.position.setLength(clamp(distance, MIN_DISTANCE, MAX_DISTANCE));
      flyTarget?.setLength(camera.position.length());
    };
    apiRef.current = {
      select,
      zoom: (factor) => setDistance(camera.position.length() * factor),
      reset: () => {
        setDistance(CAMERA_DISTANCE);
        controls.autoRotate = !media.matches;
      },
    };

    let frame = 0;
    let startTime = 0;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const still = media.matches;
      const elapsed = still ? 0 : (time - startTime) / 1000;
      if (still) controls.autoRotate = false;

      // Closer in → slower rotation and a tighter pick radius, so small islands stay selectable.
      const nearness = clamp((camera.position.length() - RADIUS) / (CAMERA_DISTANCE - RADIUS), 0.12, 1);
      controls.rotateSpeed = 0.55 * nearness;
      raycaster.params.Points = { threshold: 0.04 * Math.max(nearness, 0.2) };

      if (flyTarget) {
        const distance = camera.position.length();
        camera.position.lerp(flyTarget, still ? 1 : 0.07).setLength(distance);
        if (camera.position.distanceTo(flyTarget) < 0.01) flyTarget = null;
      }
      controls.update();

      pulses.forEach((pulse, index) => {
        if (!pulse.mesh.visible) return;
        const t = still ? 0.5 : (elapsed * 0.22 + index * 0.137) % 1;
        pulse.mesh.position.copy(pulse.points[Math.floor(t * (pulse.points.length - 1))]);
      });

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointerdown", engage);
      container.removeEventListener("pointerleave", disengage);
      container.removeEventListener("wheel", gateWheel, { capture: true });
      controls.removeEventListener("start", stopAutoRotate);
      controls.dispose();
      apiRef.current = null;
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      // Release the GL context now: browsers allow only ~16 at once and evict the oldest (the big scenes) when it runs out.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [data, borders]);

  useEffect(() => {
    selectedRef.current = selected;
    apiRef.current?.select(selected);
  }, [selected]);

  return (
    <div
      ref={frameRef}
      className={`relative w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#0d2530_0%,#020617_70%)] ${
        full ? "h-screen" : "h-[460px] rounded-xl border border-slate-800 sm:h-[560px]"
      }`}
    >
      <div
        ref={containerRef}
        role="img"
        aria-label="Interactive 3D globe of every submarine cable and landing station; click a landing station to select its country"
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />
      <ZoomControls
        onZoomIn={() => apiRef.current?.zoom(0.75)}
        onZoomOut={() => apiRef.current?.zoom(1 / 0.75)}
        onReset={() => apiRef.current?.reset()}
        full={full}
        onFullscreen={toggleFullscreen}
      />
      <p className="pointer-events-none absolute bottom-3 left-4 right-16 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        Drag to rotate · click the globe then scroll (or pinch) to zoom · click a landing station to select its country
      </p>
    </div>
  );
}

/* ---------- 2D world map (equirectangular projection) ---------- */

// Builds an SVG path in a 360 x 180 box, starting a new sub-path wherever the line crosses the antimeridian.
export function svgPath(flat: number[]) {
  let d = "";
  for (let index = 0; index < flat.length; index += 2) {
    const x = flat[index] + 180;
    const y = 90 - flat[index + 1];
    const jump = index === 0 || Math.abs(flat[index] - flat[index - 2]) > 180;
    d += `${jump ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

const MIN_VIEW_WIDTH = 22.5; // 16x zoom

export type MapView = { x: number; y: number; w: number };
function clampView(x: number, y: number, w: number): MapView {
  const width = clamp(w, MIN_VIEW_WIDTH, 360);
  return { x: clamp(x, 0, 360 - width), y: clamp(y, 0, 180 - width / 2), w: width };
}
// Zoom by `factor` while keeping the point at fractional position (fx, fy) of the view fixed under the cursor.
export function zoomView(view: MapView, factor: number, fx = 0.5, fy = 0.5): MapView {
  const width = clamp(view.w * factor, MIN_VIEW_WIDTH, 360);
  const px = view.x + fx * view.w;
  const py = view.y + (fy * view.w) / 2;
  return clampView(px - fx * width, py - (fy * width) / 2, width);
}

/** Wheel zoom (only once engaged, so page scrolling is never hijacked) and drag-to-pan for an SVG world map. */
export function usePanZoom() {
  const svgRef = useRef<SVGSVGElement>(null);
  const engagedRef = useRef(false);
  const draggedRef = useRef(false);
  const [view, setView] = useState<MapView>({ x: 0, y: 0, w: 360 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!engagedRef.current && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const fx = (event.clientX - rect.left) / rect.width;
      const fy = (event.clientY - rect.top) / rect.height;
      setView((current) => zoomView(current, event.deltaY > 0 ? 1.15 : 1 / 1.15, fx, fy));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    engagedRef.current = true;
    draggedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, view };
    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - origin.x;
      const dy = moveEvent.clientY - origin.y;
      if (Math.hypot(dx, dy) > 4) draggedRef.current = true;
      setView(clampView(origin.view.x - (dx / rect.width) * origin.view.w, origin.view.y - (dy / rect.height) * (origin.view.w / 2), origin.view.w));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const disengage = () => {
    engagedRef.current = false;
  };

  return { svgRef, view, setView, startDrag, draggedRef, disengage };
}

export function CableMap2D({ data, borders, selected, onSelect }: ViewProps) {
  const reduced = useReducedMotion();
  const { ref: frameRef, full, toggle: toggleFullscreen } = useFullscreen();
  const { svgRef, view, setView, startDrag, draggedRef, disengage } = usePanZoom();
  const scale = view.w / 360; // keeps dots the same on-screen size at any zoom

  const cablePaths = useMemo(() => data.cables.map((cable) => cable.paths.map(svgPath).join("")), [data]);
  const pulsePaths = useMemo(
    () => data.cables.map((cable) => svgPath(cable.paths.reduce((best, path) => (path.length > best.length ? path : best), cable.paths[0] ?? []))),
    [data],
  );
  const borderPath = useMemo(() => (borders ? borders.map(svgPath).join("") : null), [borders]);

  const order = data.cables
    .map((cable, index) => ({ cable, index, involved: selected !== null && cable.countries.includes(selected) }))
    .sort((a, b) => Number(a.involved) - Number(b.involved));
  const involvedCount = order.filter((item) => item.involved).length;
  const zoomLevel = 360 / view.w;

  return (
    <div
      ref={frameRef}
      onPointerLeave={disengage}
      className={`relative bg-slate-950 ${full ? "flex h-screen items-center" : "rounded-xl border border-slate-800"}`}
    >
      <div className={full ? "w-full" : "overflow-x-auto"}>
        <div className={`relative aspect-[2/1] ${full ? "mx-auto max-h-screen w-full" : "min-w-[960px]"}`}>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.w / 2}`}
            onPointerDown={startDrag}
            className="absolute inset-0 h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          >
            {Array.from({ length: 13 }, (_, index) => (
              <line key={`lon-${index}`} x1={index * 30} y1={0} x2={index * 30} y2={180} stroke="#0f172a" vectorEffect="non-scaling-stroke" />
            ))}
            {Array.from({ length: 7 }, (_, index) => (
              <line key={`lat-${index}`} x1={0} y1={index * 30} x2={360} y2={index * 30} stroke={index === 3 ? "#1e293b" : "#0f172a"} vectorEffect="non-scaling-stroke" />
            ))}
            {borderPath && <path d={borderPath} fill="none" stroke="#475569" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />}

            {order.map(({ cable, index, involved }) => (
              <path
                key={cable.id}
                d={cablePaths[index]}
                fill="none"
                stroke={cable.color}
                strokeWidth={involved ? 2 : 1}
                strokeOpacity={selected === null ? 0.55 : involved ? 1 : 0.07}
                vectorEffect="non-scaling-stroke"
              >
                <title>{cable.name}</title>
              </path>
            ))}

            {!reduced &&
              order
                .filter((item) => item.involved)
                .slice(0, MAX_PULSES)
                .map(({ cable, index }, rank) => (
                  <circle key={`pulse-${cable.id}`} r={0.9 * scale} fill="#f8fafc">
                    <animateMotion dur={`${5 + (rank % 4)}s`} begin={`${(rank * 0.37) % 3}s`} repeatCount="indefinite" path={pulsePaths[index]} />
                  </circle>
                ))}

            {data.landings.map(([name, country, lon, lat], index) => {
              const mine = country === selected;
              return (
                <circle
                  key={index}
                  cx={lon + 180}
                  cy={90 - lat}
                  r={(mine ? 0.9 : 0.55) * Math.max(scale, 0.25)}
                  fill={selected === null ? "#dbeafe" : mine ? "#f2b954" : "#475569"}
                  stroke="transparent"
                  strokeWidth={1.6 * scale}
                  className="cursor-pointer"
                  onClick={() => {
                    if (!draggedRef.current) onSelect(country);
                  }}
                >
                  <title>{name}</title>
                </circle>
              );
            })}
          </svg>
        </div>
      </div>

      <ZoomControls
        onZoomIn={() => setView((current) => zoomView(current, 1 / 1.6))}
        onZoomOut={() => setView((current) => zoomView(current, 1.6))}
        onReset={() => setView({ x: 0, y: 0, w: 360 })}
        full={full}
        onFullscreen={toggleFullscreen}
      />
      <p className="pointer-events-none absolute left-4 top-3 font-mono text-[11px] text-slate-400">
        {zoomLevel > 1.01 && <span className="mr-3 text-cyan-300">{zoomLevel.toFixed(1)}×</span>}
        {selected && <span className="text-amber-300">{selected} · {involvedCount} cables</span>}
      </p>
      <p className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        Click the map then scroll to zoom · drag to pan · click a landing station to select its country
      </p>
    </div>
  );
}
