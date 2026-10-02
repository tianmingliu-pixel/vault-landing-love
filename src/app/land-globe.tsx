"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CAMERA_DISTANCE, MAX_DISTANCE, MAX_PULSES, MIN_DISTANCE, RADIUS, ZoomControls, clamp, segmentPositions, toVector,
  useFullscreen, usePanZoom, useReducedMotion, zoomView,
} from "./network-globe";

/* ---------- data (PeeringDB, pre-aggregated into public/data/peering-interconnect.json) ---------- */

// approx = 1 when PeeringDB had no coordinates and the facility was placed at its city's location.
export type Facility = [lon: number, lat: number, country: string, networks: number, name: string, city: string, approx?: number];
export type CountryStats = { lat: number; lon: number; facilities: number; ixps: number; networks: number; topIx: [name: string, city: string, networks: number][] };
export type LandLink = [a: string, b: string, sharedNetworks: number, km: number];
export type LandData = { source: string; retrieved: string; facilities: Facility[]; countries: Record<string, CountryStats>; links: LandLink[] };
export type LinkScope = "regional" | "all";

export const REGIONAL_KM = 2500;
const ALL_LINK_LIMIT = 450; // the strongest links only, so the global view stays legible

export function useLandData() {
  const [data, setData] = useState<LandData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/data/peering-interconnect.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((json: LandData) => alive && setData(json))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  return { data, failed };
}

export function visibleLinks(data: LandData, scope: LinkScope) {
  return scope === "regional" ? data.links.filter((link) => link[3] <= REGIONAL_KM) : data.links.slice(0, ALL_LINK_LIMIT);
}

type ViewProps = { data: LandData; scope: LinkScope; selected: string | null; onSelect: (country: string) => void };

const LINK_COLOR = new THREE.Color(0x8fe3bc);
const ACTIVE_COLOR = new THREE.Color(0xf2b954);

// Great-circle arc between two points, raised gently so overlapping regional links stay distinguishable.
function landArc(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const start = toVector(a.lon, a.lat, 1);
  const end = toVector(b.lon, b.lat, 1);
  const angle = start.angleTo(end);
  const steps = Math.max(8, Math.ceil(angle / 0.03));
  const lift = 0.02 + angle * 0.12;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return start.clone().lerp(end, t).normalize().multiplyScalar(RADIUS * 1.004 + lift * Math.sin(Math.PI * t));
  });
}

/* ---------- 3D globe ---------- */

export function LandGlobe3D({ data, scope, selected, onSelect }: ViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ select: (country: string | null) => void; zoom: (factor: number) => void; reset: () => void } | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const { ref: frameRef, full, toggle: toggleFullscreen } = useFullscreen();

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.copy(toVector(10, 40, CAMERA_DISTANCE));
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T) => (disposables.push(item), item);

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

    // Country-to-country links, one object each so they can be highlighted independently.
    const links = visibleLinks(data, scope);
    const strongest = Math.max(1, ...links.map((link) => link[2]));
    const linkObjects = links.flatMap(([a, b, shared]) => {
      const from = data.countries[a];
      const to = data.countries[b];
      if (!from || !to) return [];
      const points = landArc(from, to);
      const geometry = track(new THREE.BufferGeometry());
      geometry.setAttribute("position", segmentPositions([points]));
      const baseOpacity = 0.12 + 0.7 * Math.sqrt(shared / strongest);
      const material = track(new THREE.LineBasicMaterial({ color: LINK_COLOR.clone(), transparent: true, opacity: baseOpacity }));
      scene.add(new THREE.LineSegments(geometry, material));
      return [{ a, b, shared, points, material, baseOpacity }];
    });

    // Facilities: brightness grows with the number of networks inside.
    const positions: number[] = [];
    data.facilities.forEach(([lon, lat]) => {
      const point = toVector(lon, lat, RADIUS * 1.006);
      positions.push(point.x, point.y, point.z);
    });
    const facilityGeometry = track(new THREE.BufferGeometry());
    facilityGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const colors = new Float32Array(data.facilities.length * 3);
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    facilityGeometry.setAttribute("color", colorAttribute);
    const facilityPoints = new THREE.Points(facilityGeometry, track(new THREE.PointsMaterial({ size: 0.024, vertexColors: true })));
    scene.add(facilityPoints);

    const pulseGeometry = track(new THREE.SphereGeometry(0.02, 8, 8));
    const pulseMaterial = track(new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
    const pulses = Array.from({ length: MAX_PULSES }, () => {
      const mesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, points: [] as THREE.Vector3[], reverse: false };
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    const stopAutoRotate = () => (controls.autoRotate = false);
    controls.addEventListener("start", stopAutoRotate);

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
      linkObjects.forEach((link) => {
        const involved = country !== null && (link.a === country || link.b === country);
        link.material.color.copy(involved ? ACTIVE_COLOR : LINK_COLOR);
        link.material.opacity = country === null ? link.baseOpacity : involved ? 0.95 : 0.03;
      });
      data.facilities.forEach(([, , owner, networks], index) => {
        const glow = 0.45 + 0.55 * Math.min(1, Math.log10(1 + networks) / 2.5);
        const rgb = country === null ? [glow * 0.8, glow, glow] : owner === country ? [0.95, 0.73, 0.33] : [0.25, 0.3, 0.35];
        colors.set(rgb, index * 3);
      });
      colorAttribute.needsUpdate = true;

      const active = country === null ? [] : linkObjects.filter((link) => link.a === country || link.b === country).sort((x, y) => y.shared - x.shared);
      pulses.forEach((pulse, index) => {
        const link = active[index];
        pulse.mesh.visible = Boolean(link);
        pulse.points = link?.points ?? [];
        pulse.reverse = link ? link.b === country : false; // signals always leave the selected country
      });
      const stats = country ? data.countries[country] : undefined;
      if (stats) {
        flyTarget = toVector(stats.lon, stats.lat, camera.position.length());
        controls.autoRotate = false;
      }
    };
    select(selectedRef.current);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
    const onUp = (event: PointerEvent) => {
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const view = camera.position.clone().normalize();
      const hit = raycaster.intersectObject(facilityPoints).find((item) => item.index !== undefined && item.point.clone().normalize().dot(view) > 0.1);
      if (hit?.index !== undefined) onSelectRef.current(data.facilities[hit.index][2]);
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

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
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
        if (!pulse.mesh.visible || pulse.points.length < 2) return;
        const t = still ? 0.5 : (elapsed * 0.45 + index * 0.137) % 1;
        const at = pulse.reverse ? 1 - t : t;
        pulse.mesh.position.copy(pulse.points[Math.round(at * (pulse.points.length - 1))]);
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
      renderer.domElement.remove();
    };
  }, [data, scope]);

  useEffect(() => {
    selectedRef.current = selected;
    apiRef.current?.select(selected);
  }, [selected]);

  return (
    <div
      ref={frameRef}
      className={`relative w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#0f2a22_0%,#020617_70%)] ${
        full ? "h-screen" : "h-[460px] rounded-xl border border-slate-800 sm:h-[560px]"
      }`}
    >
      <div
        ref={containerRef}
        role="img"
        aria-label="Interactive 3D globe of data centres and cross-border interconnection between countries; click a data centre to select its country"
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
        Drag to rotate · click the globe then scroll (or pinch) to zoom · click a data centre to select its country
      </p>
    </div>
  );
}

/* ---------- 2D world map ---------- */

function arcPath(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  let ax = a.lon + 180;
  let bx = b.lon + 180;
  if (bx - ax > 180) ax += 360; // take the short way round the antimeridian
  else if (ax - bx > 180) bx += 360;
  const ay = 90 - a.lat;
  const by = 90 - b.lat;
  const bend = Math.hypot(bx - ax, by - ay) * 0.15;
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}Q${((ax + bx) / 2).toFixed(2)} ${((ay + by) / 2 - bend).toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`;
}

export function LandMap2D({ data, scope, selected, onSelect }: ViewProps) {
  const reduced = useReducedMotion();
  const { ref: frameRef, full, toggle: toggleFullscreen } = useFullscreen();
  const { svgRef, view, setView, startDrag, draggedRef, disengage } = usePanZoom();
  const scale = view.w / 360;

  const links = useMemo(() => visibleLinks(data, scope), [data, scope]);
  const strongest = Math.max(1, ...links.map((link) => link[2]));
  const paths = useMemo(
    () => links.map(([a, b]) => (data.countries[a] && data.countries[b] ? arcPath(data.countries[a], data.countries[b]) : "")),
    [data, links],
  );

  const order = links
    .map((link, index) => ({ link, index, involved: selected !== null && (link[0] === selected || link[1] === selected) }))
    .sort((x, y) => Number(x.involved) - Number(y.involved));
  const active = order.filter((item) => item.involved).sort((x, y) => y.link[2] - x.link[2]);
  const zoomLevel = 360 / view.w;

  return (
    <div ref={frameRef} onPointerLeave={disengage} className={`relative bg-slate-950 ${full ? "flex h-screen items-center" : "rounded-xl border border-slate-800"}`}>
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

            {order.map(({ link, index, involved }) => (
              <path
                key={`${link[0]}-${link[1]}`}
                d={paths[index]}
                fill="none"
                stroke={involved ? "#f2b954" : "#8fe3bc"}
                strokeWidth={0.6 + 2.6 * Math.sqrt(link[2] / strongest)}
                strokeOpacity={selected === null ? 0.15 + 0.6 * Math.sqrt(link[2] / strongest) : involved ? 0.95 : 0.04}
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${link[0]} ↔ ${link[1]} · ${link[2]} shared networks`}</title>
              </path>
            ))}

            {!reduced &&
              active.slice(0, MAX_PULSES).map(({ link, index }, rank) => (
                <circle key={`pulse-${link[0]}-${link[1]}`} r={0.9 * scale} fill="#fff1d6">
                  <animateMotion
                    dur={`${2.4 + (rank % 4) * 0.4}s`}
                    begin={`${(rank * 0.29) % 2}s`}
                    repeatCount="indefinite"
                    path={paths[index]}
                    keyPoints={link[1] === selected ? "1;0" : "0;1"}
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
              ))}

            {data.facilities.map(([lon, lat, country, networks, name, city, approx], index) => {
              const mine = country === selected;
              return (
                <circle
                  key={index}
                  cx={lon + 180}
                  cy={90 - lat}
                  r={(mine ? 0.8 : 0.45 + Math.min(0.5, networks / 600)) * Math.max(scale, 0.25)}
                  fill={selected === null ? "#d1fae5" : mine ? "#f2b954" : "#334155"}
                  fillOpacity={selected === null ? 0.75 : 1}
                  stroke="transparent"
                  strokeWidth={1.6 * scale}
                  className="cursor-pointer"
                  onClick={() => {
                    if (!draggedRef.current) onSelect(country);
                  }}
                >
                  <title>{`${name} — ${city} · ${networks} networks${approx ? " · city-level location" : ""}`}</title>
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
        {selected && <span className="text-amber-300">{selected} · {active.length} cross-border links</span>}
      </p>
      <p className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        Click the map then scroll to zoom · drag to pan · click a data centre to select its country
      </p>
    </div>
  );
}
