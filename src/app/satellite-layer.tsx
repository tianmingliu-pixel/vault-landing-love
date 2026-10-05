"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as satellite from "satellite.js";
import { OrbitTV } from "./orbit-timelapse";
import { createSimClock, type SimClock } from "./sim-clock";
import { addModelLights, buildSatelliteModel, disposeModel, poseModel, type SatMarker } from "./satellite-model";
import SatelliteFunction, { COMM_KINDS, hasEarthImagery, type FunctionKind } from "./satellite-function";
import { RADIUS, ZoomControls, clamp, segmentPositions, spherePolyline, toVector, useFullscreen, useReducedMotion } from "./network-globe";

/* ---------- data ---------- */

type OperatorKind = FunctionKind;
type Operator = [name: string, country: string, kind: OperatorKind];
// [name, norad, operator, epoch, meanMotion, ecc, inc, raan, argPerigee, meanAnomaly, bstar, meanMotionDot, launchDate, owner, cosparId]
type SatRow = [string, number, number, string, number, number, number, number, number, number, number, number, string, string, string];
type SatData = { source: string; retrieved: string; operators: Operator[]; sats: SatRow[] };
type WorldCity = [name: string, country: string, lat: number, lon: number, millions: number];

const EARTH_KM = 6371;

/** Families shown as filters; everything else is grouped by orbit. */
const FAMILIES: { id: string; label: string; color: string; match: (op: Operator) => boolean }[] = [
  { id: "starlink", label: "Starlink", color: "#e2e8f0", match: (op) => op[2] === "starlink" },
  { id: "oneweb", label: "OneWeb", color: "#f87171", match: (op) => op[2] === "oneweb" },
  { id: "kuiper", label: "Kuiper", color: "#fb923c", match: (op) => op[2] === "kuiper" },
  { id: "qianfan", label: "Qianfan", color: "#facc15", match: (op) => op[2] === "qianfan" },
  { id: "guowang", label: "Guowang", color: "#f472b6", match: (op) => op[2] === "guowang" },
  { id: "iridium", label: "Iridium", color: "#22d3ee", match: (op) => op[2] === "iridium" },
  { id: "leo", label: "Other LEO", color: "#a3e635", match: (op) => op[2] === "leo" },
  { id: "meo", label: "MEO (O3b)", color: "#c084fc", match: (op) => op[2] === "meo" },
  { id: "geo", label: "GEO comms", color: "#60a5fa", match: (op) => op[2] === "geo" },
  { id: "station", label: "Space stations", color: "#fde047", match: (op) => op[2] === "station" },
  { id: "weather", label: "Weather", color: "#38bdf8", match: (op) => op[2] === "weather" },
  { id: "eo", label: "Earth observation", color: "#34d399", match: (op) => op[2] === "eo" },
  { id: "nav", label: "Navigation", color: "#f59e0b", match: (op) => op[2] === "nav" },
  { id: "science", label: "Science & amateur", color: "#94a3b8", match: (op) => op[2] === "science" },
];

/** Lowest elevation angle at which a ground terminal is assumed to use the satellite (public filings / typical values). */
const MIN_ELEVATION: Record<OperatorKind, number> = { starlink: 25, oneweb: 25, kuiper: 25, qianfan: 25, guowang: 25, iridium: 8.2, leo: 10, meo: 10, geo: 5, station: 10, weather: 5, eo: 10, nav: 5, science: 10 };

function useSatelliteData() {
  const [data, setData] = useState<SatData | null>(null);
  const [cities, setCities] = useState<WorldCity[]>([]);
  const [caps, setCaps] = useState<{ radio: Record<string, string[]>; photo: number[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/data/satellites.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((json: SatData) => alive && setData(json))
      .catch(() => alive && setFailed(true));
    fetch("/data/satnogs-capabilities.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => alive && json && setCaps(json))
      .catch(() => undefined);
    fetch("/data/world-cities.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { cities: WorldCity[] } | null) => alive && json && setCities(json.cities))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return { data, cities, caps, failed };
}

function toSatrec(row: SatRow) {
  const [name, norad, , epoch, meanMotion, ecc, inc, raan, argp, ma, bstar, ndot] = row;
  const omm = {
    OBJECT_NAME: name,
    OBJECT_ID: row[14],
    EPOCH: epoch,
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: ecc,
    INCLINATION: inc,
    RA_OF_ASC_NODE: raan,
    ARG_OF_PERICENTER: argp,
    MEAN_ANOMALY: ma,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: "U",
    NORAD_CAT_ID: norad,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 0,
    BSTAR: bstar,
    MEAN_MOTION_DOT: ndot,
    MEAN_MOTION_DDOT: 0,
  };
  return satellite.json2satrec(omm as unknown as Parameters<typeof satellite.json2satrec>[0]);
}

type Geo = { lat: number; lon: number; altKm: number; speedKms: number };

function locate(satrec: satellite.SatRec, date: Date): Geo | null {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
  const geo = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
  const { x, y, z } = pv.velocity;
  return { lat: satellite.degreesLat(geo.latitude), lon: satellite.degreesLong(geo.longitude), altKm: geo.height, speedKms: Math.hypot(x, y, z) };
}

/** Ground radius (km) of the area that sees the satellite above the minimum elevation angle. */
function footprintKm(altKm: number, minElevationDeg: number) {
  const e = (minElevationDeg * Math.PI) / 180;
  const lambda = Math.acos((EARTH_KM / (EARTH_KM + altKm)) * Math.cos(e)) - e;
  return EARTH_KM * lambda;
}

function surfaceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

const scaled = (altKm: number) => RADIUS * (1 + altKm / EARTH_KM);
const orbitClass = (altKm: number) => (altKm < 2000 ? "LEO" : altKm < 30000 ? "MEO" : "GEO");

/* ---------- schematic drawings (generic, not to scale) ---------- */

function SatelliteIllustration({ kind, color }: { kind: OperatorKind; color: string }) {
  const panel = (x: number, y: number, w: number, h: number, cells = 6) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#1e3a8a" stroke="#93c5fd" strokeWidth={1} />
      {Array.from({ length: cells - 1 }, (_, i) => (
        <line key={i} x1={x + ((i + 1) * w) / cells} y1={y} x2={x + ((i + 1) * w) / cells} y2={y + h} stroke="#60a5fa" strokeWidth={0.6} />
      ))}
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#60a5fa" strokeWidth={0.6} />
    </g>
  );
  const body = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx={2} fill="#cbd5e1" stroke={color} strokeWidth={1.5} />;
  const dish = (cx: number, cy: number, r: number, flip = 1) => (
    <path d={`M${cx - r} ${cy} Q${cx} ${cy + flip * r * 1.1} ${cx + r} ${cy}`} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
  );
  let art;
  switch (kind) {
    case "starlink":
    case "kuiper":
      // flat-packed bus with a single long solar array
      art = (
        <>
          {panel(96, 52, 150, 36, 10)}
          <line x1={76} y1={70} x2={96} y2={70} stroke="#94a3b8" strokeWidth={2} />
          {body(26, 58, 52, 24)}
          {[34, 48, 62].map((x) => <rect key={x} x={x} y={62} width={10} height={16} fill="#475569" />)}
        </>
      );
      break;
    case "qianfan":
    case "guowang":
    case "oneweb":
      // compact bus with two wings
      art = (
        <>
          {panel(20, 56, 90, 28, 6)}
          {panel(190, 56, 90, 28, 6)}
          <line x1={110} y1={70} x2={124} y2={70} stroke="#94a3b8" strokeWidth={2} />
          <line x1={176} y1={70} x2={190} y2={70} stroke="#94a3b8" strokeWidth={2} />
          {body(124, 48, 52, 44)}
          {dish(150, 92, 12)}
        </>
      );
      break;
    case "iridium":
      // triangular-prism bus, two wings, three main mission antenna panels
      art = (
        <>
          {panel(20, 60, 80, 22, 5)}
          {panel(200, 60, 80, 22, 5)}
          <polygon points="150,30 182,104 118,104" fill="#cbd5e1" stroke={color} strokeWidth={1.5} />
          <line x1={100} y1={71} x2={128} y2={71} stroke="#94a3b8" strokeWidth={2} />
          <line x1={172} y1={71} x2={200} y2={71} stroke="#94a3b8" strokeWidth={2} />
          <rect x={138} y={104} width={24} height={14} fill="#e2e8f0" stroke="#94a3b8" />
        </>
      );
      break;
    case "station":
      // long truss carrying several pairs of arrays, modules in the middle
      art = (
        <>
          <rect x={20} y={62} width={260} height={6} fill="#94a3b8" />
          {[30, 70, 194, 234].map((x) => <g key={x}>{panel(x, 20, 36, 40, 3)}{panel(x, 70, 36, 40, 3)}</g>)}
          <rect x={126} y={48} width={48} height={34} rx={6} fill="#e2e8f0" stroke={color} strokeWidth={1.5} />
          <rect x={136} y={82} width={28} height={30} rx={5} fill="#cbd5e1" stroke="#94a3b8" />
        </>
      );
      break;
    case "nav":
      // box bus, two wings, nadir antenna array
      art = (
        <>
          {panel(20, 50, 90, 30, 6)}
          {panel(190, 50, 90, 30, 6)}
          <line x1={110} y1={65} x2={124} y2={65} stroke="#94a3b8" strokeWidth={2} />
          <line x1={176} y1={65} x2={190} y2={65} stroke="#94a3b8" strokeWidth={2} />
          {body(124, 40, 52, 50)}
          {[132, 146, 160].map((x) => <rect key={x} x={x} y={92} width={8} height={18} fill="#e2e8f0" stroke="#94a3b8" />)}
        </>
      );
      break;
    case "weather":
    case "eo":
      // bus with one wing and an Earth-pointing instrument
      art = (
        <>
          {panel(150, 40, 130, 34, 8)}
          <line x1={134} y1={57} x2={150} y2={57} stroke="#94a3b8" strokeWidth={2} />
          {body(70, 36, 64, 52)}
          <rect x={86} y={88} width={32} height={20} fill="#475569" stroke={color} />
          <circle cx={102} cy={112} r={6} fill="#0ea5e9" stroke="#e2e8f0" />
        </>
      );
      break;
    case "science":
      // CubeSat: stacked units, deployable panels, whip antennas
      art = (
        <>
          {panel(40, 46, 70, 40, 4)}
          {panel(190, 46, 70, 40, 4)}
          <rect x={120} y={30} width={60} height={72} fill="#cbd5e1" stroke={color} strokeWidth={1.5} />
          <line x1={120} y1={54} x2={180} y2={54} stroke="#94a3b8" />
          <line x1={120} y1={78} x2={180} y2={78} stroke="#94a3b8" />
          <line x1={150} y1={30} x2={150} y2={8} stroke="#e2e8f0" strokeWidth={1.5} />
          <line x1={150} y1={102} x2={150} y2={124} stroke="#e2e8f0" strokeWidth={1.5} />
        </>
      );
      break;
    case "meo":
    case "geo":
    default:
      // large box bus, long wings, reflector dishes
      art = (
        <>
          {panel(10, 60, 105, 24, 7)}
          {panel(185, 60, 105, 24, 7)}
          <line x1={115} y1={72} x2={128} y2={72} stroke="#94a3b8" strokeWidth={2} />
          <line x1={172} y1={72} x2={185} y2={72} stroke="#94a3b8" strokeWidth={2} />
          {body(128, 42, 44, 60)}
          {dish(122, 46, 16, -1)}
          {dish(178, 46, 16, -1)}
          <line x1={150} y1={42} x2={150} y2={28} stroke="#94a3b8" strokeWidth={2} />
          <circle cx={150} cy={26} r={4} fill="#e2e8f0" />
        </>
      );
  }
  return (
    <svg viewBox="0 0 300 130" className="h-auto w-full" role="img" aria-label={`Schematic drawing of a ${kind} satellite`}>
      <rect x={0} y={0} width={300} height={130} fill="#020617" />
      {art}
    </svg>
  );
}

/* ---------- 3D view ---------- */

type Selected = { index: number; row: SatRow; op: Operator; geo: Geo };

function SatelliteGlobe({
  data, borders, enabled, selected, onSelect, speed, focus, clock,
}: {
  data: SatData; borders: number[][] | null; enabled: Set<string>; selected: number | null; onSelect: (index: number | null) => void; speed: number;
  /** When set, only these satellites are drawn bright (capability filter). */
  focus: Uint8Array | null;
  /** Shared simulated clock (also drives the ground-station view). */
  clock: SimClock;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: frameRef, full, toggle } = useFullscreen();
  const apiRef = useRef<{ zoom: (f: number) => void; reset: () => void } | null>(null);
  const stateRef = useRef({ enabled, selected, speed, onSelect, focus });
  const reduced = useReducedMotion();
  const [glEpoch, setGlEpoch] = useState(0);

  useEffect(() => {
    stateRef.current = { enabled, selected, speed: reduced ? 0 : speed, onSelect, focus };
  }, [enabled, selected, speed, onSelect, reduced, focus]);

  const familyOf = useMemo(() => data.operators.map((op) => FAMILIES.findIndex((family) => family.match(op))), [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sats = data.sats.map(toSatrec);
    const count = sats.length;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    camera.position.copy(toVector(10, 25, 7.5));
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // If the browser drops this GL context anyway (too many 3D views, GPU reset), rebuild the scene instead of leaving it blank.
    const onContextLost = (event: Event) => {
      event.preventDefault();
      window.setTimeout(() => setGlEpoch((n) => n + 1), 250);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T) => (disposables.push(item), item);

    scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(RADIUS - 0.01, 64, 40)), track(new THREE.MeshBasicMaterial({ color: 0x05121a }))));
    if (borders) {
      const geometry = track(new THREE.BufferGeometry());
      geometry.setAttribute("position", segmentPositions(borders.map((arc) => spherePolyline(arc, RADIUS * 1.001))));
      scene.add(new THREE.LineSegments(geometry, track(new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.6 }))));
    }

    // All satellites in one point cloud.
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const geometry = track(new THREE.BufferGeometry());
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute("position", positionAttr);
    geometry.setAttribute("color", colorAttr);
    const points = new THREE.Points(geometry, track(new THREE.PointsMaterial({ size: 0.022, vertexColors: true, sizeAttenuation: true })));
    scene.add(points);
    const palette = FAMILIES.map((family) => new THREE.Color(family.color));

    // Selection: a schematic spacecraft model, footprint ring and ground track.
    addModelLights(scene);
    const marker = new THREE.Group();
    marker.visible = false;
    scene.add(marker);
    let model: THREE.Group | null = null;
    let modelFor: number | null = null;
    const ringGeometry = track(new THREE.BufferGeometry());
    const ring = new THREE.LineLoop(ringGeometry, track(new THREE.LineBasicMaterial({ color: 0xfacc15 })));
    ring.visible = false;
    scene.add(ring);
    const nadirGeometry = track(new THREE.BufferGeometry());
    const nadir = new THREE.Line(nadirGeometry, track(new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.5 })));
    scene.add(nadir);
    const trackGeometry = track(new THREE.BufferGeometry());
    const groundTrack = new THREE.Line(trackGeometry, track(new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.8 })));
    scene.add(groundTrack);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = RADIUS + 0.2;
    controls.maxDistance = 40;
    controls.rotateSpeed = 0.5;
    let engaged = false;
    const engage = () => (engaged = true);
    const disengage = () => (engaged = false);
    const gateWheel = (event: WheelEvent) => {
      if (!engaged && !event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    container.addEventListener("pointerdown", engage);
    container.addEventListener("pointerleave", disengage);
    container.addEventListener("wheel", gateWheel, { capture: true });

    // Click picks the nearest visible satellite.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
    const onUp = (event: PointerEvent) => {
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      raycaster.params.Points = { threshold: 0.03 * Math.max(0.3, camera.position.length() / 7.5) };
      const hit = raycaster.intersectObject(points).find((item) => item.index !== undefined && visible[item.index]);
      stateRef.current.onSelect(hit?.index ?? null);
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

    apiRef.current = {
      zoom: (factor) => camera.position.setLength(clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance)),
      reset: () => camera.position.copy(toVector(10, 25, 7.5)),
    };

    // Propagation is spread across frames: a slice of the constellation per frame keeps the page smooth.
    const visible = new Uint8Array(count);
    let cursor = 0;
    let lastSelected: number | null = null;
    let trackAt = 0;
    const SLICE = 1800;
    let flyTarget: THREE.Vector3 | null = null;
    controls.addEventListener("start", () => (flyTarget = null));

    const drawSelection = (index: number, date: Date) => {
      const geo = locate(sats[index], date);
      if (!geo) return;
      const op = data.operators[data.sats[index][2]];
      const sat = toVector(geo.lon, geo.lat, scaled(geo.altKm));
      if (modelFor !== index) {
        if (model) {
          marker.remove(model);
          disposeModel(model);
        }
        const family = FAMILIES.find((item) => item.match(op));
        model = buildSatelliteModel(op[2], family?.color ?? "#facc15");
        marker.add(model);
        modelFor = index;
      }
      const next = locate(sats[index], new Date(date.getTime() + 20000));
      poseModel(marker, sat, next ? toVector(next.lon, next.lat, scaled(next.altKm)) : sat.clone().multiplyScalar(1.01));
      // Exaggerated size so the craft stays visible; grows a little as the camera pulls back.
      marker.scale.setScalar(clamp(camera.position.distanceTo(sat) * 0.05, 0.05, 0.6));
      marker.visible = true;
      nadirGeometry.setFromPoints([sat, toVector(geo.lon, geo.lat, RADIUS * 1.002)]);
      // Footprint ring: points at the ground radius around the sub-satellite point.
      const radiusRad = footprintKm(geo.altKm, MIN_ELEVATION[op[2]]) / EARTH_KM;
      const la = (geo.lat * Math.PI) / 180;
      const lo = (geo.lon * Math.PI) / 180;
      const ringPoints: THREE.Vector3[] = [];
      for (let k = 0; k < 96; k++) {
        const bearing = (k / 96) * 2 * Math.PI;
        const lat2 = Math.asin(Math.sin(la) * Math.cos(radiusRad) + Math.cos(la) * Math.sin(radiusRad) * Math.cos(bearing));
        const lon2 = lo + Math.atan2(Math.sin(bearing) * Math.sin(radiusRad) * Math.cos(la), Math.cos(radiusRad) - Math.sin(la) * Math.sin(lat2));
        ringPoints.push(toVector((lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI, RADIUS * 1.003));
      }
      ringGeometry.setFromPoints(ringPoints);
      ring.visible = true;
    };

    const drawTrack = (index: number, date: Date) => {
      const period = (24 * 60) / data.sats[index][4]; // minutes
      const span = Math.min(period, 180);
      const pointsOnTrack: THREE.Vector3[] = [];
      for (let m = 0; m <= span; m += span / 180) {
        const geo = locate(sats[index], new Date(date.getTime() + m * 60000));
        if (geo) pointsOnTrack.push(toVector(geo.lon, geo.lat, RADIUS * 1.004));
      }
      trackGeometry.setFromPoints(pointsOnTrack);
      groundTrack.visible = true;
    };

    let frame = 0;
    const animate = (now: number) => {
      const { enabled: on, selected: chosen, focus: only } = stateRef.current;
      const date = clock.now();
      const gmst = satellite.gstime(date);

      const end = Math.min(count, cursor + SLICE);
      for (let i = cursor; i < end; i++) {
        const family = familyOf[data.sats[i][2]];
        const show = family >= 0 && on.has(FAMILIES[family].id);
        visible[i] = show ? 1 : 0;
        if (!show) {
          positions[i * 3] = positions[i * 3 + 1] = positions[i * 3 + 2] = 0;
          continue;
        }
        const pv = satellite.propagate(sats[i], date);
        if (!pv || !pv.position || typeof pv.position === "boolean") {
          visible[i] = 0;
          continue;
        }
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        const v = toVector(satellite.degreesLong(geo.longitude), satellite.degreesLat(geo.latitude), scaled(geo.height));
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
        const c = palette[family];
        const dim = only && !only[i] ? 0.12 : chosen !== null && chosen !== i ? 0.55 : 1;
        colors[i * 3] = c.r * dim;
        colors[i * 3 + 1] = c.g * dim;
        colors[i * 3 + 2] = c.b * dim;
      }
      cursor = end >= count ? 0 : end;
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      if (chosen !== null && chosen !== lastSelected) {
        const geo = locate(sats[chosen], date);
        // Look from slightly behind and to the side so the spacecraft is seen at an angle, not straight down.
        if (geo) flyTarget = toVector(geo.lon + 18, clamp(geo.lat - 14, -80, 80), Math.min(controls.maxDistance, Math.max(camera.position.length(), scaled(geo.altKm) * 1.6 + 1)));
      }
      if (flyTarget) {
        const distance = camera.position.length() + (flyTarget.length() - camera.position.length()) * 0.08;
        camera.position.lerp(flyTarget, 0.08).setLength(distance);
        if (camera.position.distanceTo(flyTarget) < 0.02) flyTarget = null;
      }
      if (chosen !== null) {
        drawSelection(chosen, date);
        if (chosen !== lastSelected || now - trackAt > 5000) {
          drawTrack(chosen, date);
          trackAt = now;
        }
      } else {
        marker.visible = ring.visible = groundTrack.visible = false;
        nadirGeometry.setFromPoints([]);
      }
      lastSelected = chosen;

      controls.update();
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
      controls.dispose();
      apiRef.current = null;
      disposables.forEach((item) => item.dispose());
      if (model) disposeModel(model);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.dispose();
      // Release the GL context now: browsers allow only ~16 at once and evict the oldest (the big scenes) when it runs out.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [data, borders, familyOf, glEpoch]);

  return (
    <div
      ref={frameRef}
      className={`relative w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#0d2530_0%,#020617_70%)] ${full ? "h-screen" : "h-[480px] rounded-xl border border-slate-800 sm:h-[600px]"}`}
    >
      <div ref={containerRef} role="img" aria-label="3D globe of communication satellites at their current positions; click a satellite to inspect it" className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <ZoomControls onZoomIn={() => apiRef.current?.zoom(0.75)} onZoomOut={() => apiRef.current?.zoom(1 / 0.75)} onReset={() => apiRef.current?.reset()} full={full} onFullscreen={toggle} />
      <p className="pointer-events-none absolute bottom-3 left-4 right-16 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        True altitude scale · zoom out to see the GEO ring · click a satellite for its footprint and ground track
      </p>
    </div>
  );
}

/* ---------- panel ---------- */

export default function SatelliteLayer({ borders, countryName }: { borders: number[][] | null; countryName: (code: string) => string }) {
  const { data, cities, caps, failed } = useSatelliteData();
  const [capability, setCapability] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(FAMILIES.map((family) => family.id)));
  const [selected, setSelected] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [clock] = useState(createSimClock);
  useEffect(() => {
    clock.setSpeed(speed);
  }, [clock, speed]);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");

  // Refresh the readout once a second.
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const result: Record<string, number> = {};
    for (const row of data.sats) {
      const family = FAMILIES.find((item) => item.match(data.operators[row[2]]));
      if (family) result[family.id] = (result[family.id] ?? 0) + 1;
    }
    return result;
  }, [data]);

  const satrec = useMemo(() => (data && selected !== null ? toSatrec(data.sats[selected]) : null), [data, selected]);
  const marker = useMemo<SatMarker | undefined>(() => {
    if (!data || selected === null || !satrec) return undefined;
    const op = data.operators[data.sats[selected][2]];
    const color = FAMILIES.find((family) => family.match(op))?.color ?? "#facc15";
    return { kind: op[2], color, locate: (date: Date) => locate(satrec, date) };
  }, [data, selected, satrec]);

  // Readout for the selected satellite. The globe animates in simulated time; the readout uses wall-clock time.
  const detail = useMemo(() => {
    void tick;
    if (!data || selected === null || !satrec) return null;
    const row = data.sats[selected];
    const op = data.operators[row[2]];
    const geo = locate(satrec, clock.now());
    if (!geo) return null;
    const radius = footprintKm(geo.altKm, MIN_ELEVATION[op[2]]);
    const under = cities.filter((city) => surfaceKm(geo.lat, geo.lon, city[2], city[3]) <= radius);
    const countries = [...new Set(under.map((city) => city[1]))];
    return { row, op, geo, radius, under, countries };
  }, [data, selected, satrec, cities, tick, clock]);

  // Countries and cities the satellite will serve during its next pass (one orbit, max 3 h).
  const pass = useMemo(() => {
    if (!data || selected === null || !satrec || !cities.length) return null;
    const row = data.sats[selected];
    const op = data.operators[row[2]];
    const period = (24 * 60) / row[4];
    const span = Math.min(period, 180);
    const served = new Map<string, number>();
    const cityHits = new Set<number>();
    const start = clock.now().getTime();
    for (let m = 0; m <= span; m += 2) {
      const geo = locate(satrec, new Date(start + m * 60000));
      if (!geo) continue;
      const radius = footprintKm(geo.altKm, MIN_ELEVATION[op[2]]);
      cities.forEach((city, index) => {
        if (surfaceKm(geo.lat, geo.lon, city[2], city[3]) <= radius) {
          cityHits.add(index);
          served.set(city[1], (served.get(city[1]) ?? 0) + 1);
        }
      });
    }
    return { minutes: Math.round(span), countries: [...served.keys()], cities: [...cityHits].map((index) => cities[index]) };
  }, [data, selected, satrec, cities, clock]);

  // Name list: all satellites sorted by name; typing narrows it (prefix matches first, then contains, NORAD, COSPAR, operator).
  const sortedIndex = useMemo(() => (data ? data.sats.map((_, i) => i).sort((a, b) => data.sats[a][0].localeCompare(data.sats[b][0], "en", { numeric: true })) : []), [data]);
  // Capability filters: what a satellite openly offers, so all of one kind can be found at once.
  const capabilityTests = useMemo(() => {
    if (!data) return [];
    const photo = new Set(caps?.photo ?? []);
    const kindOf = (i: number) => data.operators[data.sats[i][2]][2];
    return [
      { id: "radio", label: "Radio frequencies", hint: "Active transmitters listed in SatNOGS", test: (i: number) => Boolean(caps?.radio[String(data.sats[i][1])]) },
      { id: "earth", label: "Earth imagery", hint: "Own sensor images of Earth (NASA GIBS, NOAA)", test: (i: number) => hasEarthImagery(data.sats[i][0]) },
      { id: "video", label: "Live video", hint: "NASA live stream", test: (i: number) => data.sats[i][1] === 25544 },
      { id: "photo", label: "Real photo", hint: "Photo in SatNOGS DB", test: (i: number) => photo.has(data.sats[i][1]) },
      { id: "nav", label: "Navigation signal", hint: "GPS, BeiDou, Galileo, GLONASS, QZSS, NavIC", test: (i: number) => kindOf(i) === "nav" },
      { id: "bands", label: "Comms bands", hint: "Broadband / phone frequency plans", test: (i: number) => COMM_KINDS.includes(kindOf(i)) },
    ];
  }, [data, caps]);
  const capabilityCounts = useMemo(() => Object.fromEntries(capabilityTests.map((c) => [c.id, data ? data.sats.reduce((n, _, i) => n + (c.test(i) ? 1 : 0), 0) : 0])), [capabilityTests, data]);

  const focus = useMemo(() => {
    const cap = capabilityTests.find((c) => c.id === capability);
    if (!cap || !data) return null;
    const mask = new Uint8Array(data.sats.length);
    data.sats.forEach((_, i) => (mask[i] = cap.test(i) ? 1 : 0));
    return mask;
  }, [capability, capabilityTests, data]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cap = capabilityTests.find((c) => c.id === capability);
    const pool = cap ? sortedIndex.filter(cap.test) : sortedIndex;
    if (!data || !q) return pool;
    const prefix: number[] = [];
    const rest: number[] = [];
    for (const i of pool) {
      const row = data.sats[i];
      const name = row[0].toLowerCase();
      if (name.startsWith(q)) prefix.push(i);
      else if (name.includes(q) || String(row[1]) === q || row[14].toLowerCase() === q || data.operators[row[2]][0].toLowerCase().includes(q)) rest.push(i);
    }
    return prefix.concat(rest);
  }, [data, query, sortedIndex, capability, capabilityTests]);
  const [cursor, setCursor] = useState(0);
  const LIST_LIMIT = 400;

  const choose = (index: number) => {
    if (!data) return;
    const family = FAMILIES.find((item) => item.match(data.operators[data.sats[index][2]]));
    if (family) setEnabled((current) => (current.has(family.id) ? current : new Set([...current, family.id])));
    setSelected(index);
  };

  const toggleFamily = (id: string) =>
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (failed) return <p className="rounded-xl border border-rose-900 bg-rose-950/40 p-6 text-sm text-rose-200">Could not load /data/satellites.json.</p>;
  if (!data) return <div className="grid h-[480px] place-items-center rounded-xl border border-slate-800 font-mono text-xs text-slate-500">Loading orbital elements…</div>;

  const familyColor = (op: Operator) => FAMILIES.find((family) => family.match(op))?.color ?? "#94a3b8";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FAMILIES.map((family) => (
          <button
            key={family.id}
            type="button"
            aria-pressed={enabled.has(family.id)}
            onClick={() => toggleFamily(family.id)}
            className={`inline-flex min-h-9 items-center gap-2 border px-3 text-xs font-semibold ${enabled.has(family.id) ? "border-slate-500 text-slate-100" : "border-slate-800 text-slate-500"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: family.color, opacity: enabled.has(family.id) ? 1 : 0.3 }} />
            {family.label}
            <span className="font-mono text-slate-400">{(counts[family.id] ?? 0).toLocaleString("en-US")}</span>
          </button>
        ))}
        <div aria-label="Simulation speed" className="ml-auto inline-flex border border-slate-700 p-1">
          {[1, 60, 600].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
              className={`min-h-8 px-3 font-mono text-xs ${speed === value ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              {value === 1 ? "real time" : `×${value}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        {/* Name list with type-ahead: press a letter anywhere in the list and it narrows to names starting with it. */}
        <div className="flex h-[480px] flex-col rounded-xl border border-slate-800 bg-slate-950/60 sm:h-[600px]">
          <label htmlFor="sat-search" className="sr-only">Search satellites</label>
          <input
            id="sat-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setCursor((c) => Math.min(c + 1, Math.min(matches.length, LIST_LIMIT) - 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (event.key === "Enter" && matches[cursor] !== undefined) choose(matches[cursor]);
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Type a name, e.g. b → BEIDOU…"
            autoComplete="off"
            className="m-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none"
          />
          <div role="group" aria-label="Filter by capability" className="flex flex-wrap gap-1 px-2 pb-2">
            {capabilityTests.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.hint}
                aria-pressed={capability === c.id}
                onClick={() => { setCapability((current) => (current === c.id ? null : c.id)); setCursor(0); }}
                className={`rounded border px-1.5 py-0.5 text-[10px] ${capability === c.id ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
              >
                {c.label} <span className="font-mono opacity-70">{capabilityCounts[c.id]?.toLocaleString("en-US")}</span>
              </button>
            ))}
          </div>
          <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
            {matches.length.toLocaleString("en-US")} {query || capability ? "matches" : "satellites"}{matches.length > LIST_LIMIT ? ` · first ${LIST_LIMIT} shown, keep typing` : ""}
          </p>
          <ul
            role="listbox"
            aria-label="Satellite names"
            tabIndex={0}
            onKeyDown={(event) => {
              // Type-ahead: a printable key typed while the list has focus goes into the search box.
              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                setQuery((current) => current + event.key);
                setCursor(0);
                document.getElementById("sat-search")?.focus();
              }
              if (event.key === "Backspace") setQuery((current) => current.slice(0, -1));
            }}
            className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800 text-sm focus:outline-none"
          >
            {matches.slice(0, LIST_LIMIT).map((index, position) => {
              const row = data.sats[index];
              const op = data.operators[row[2]];
              const q = query.trim();
              const hit = q && row[0].toLowerCase().startsWith(q.toLowerCase());
              return (
                <li key={row[1]} role="option" aria-selected={selected === index}>
                  <button
                    type="button"
                    onClick={() => choose(index)}
                    title={`${op[0]} · NORAD ${row[1]}`}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${selected === index ? "bg-amber-300/15 text-amber-200" : position === cursor && q ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900"}`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: familyColor(op) }} />
                    <span className="min-w-0 flex-1 truncate">
                      {hit ? (<><mark className="bg-transparent font-semibold text-emerald-300">{row[0].slice(0, q.length)}</mark>{row[0].slice(q.length)}</>) : row[0]}
                    </span>
                    {caps?.radio[String(row[1])] && (capability === "radio" || q) && (
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">{caps.radio[String(row[1])][0].split(" ")[0]}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <SatelliteGlobe data={data} borders={borders} enabled={enabled} selected={selected} onSelect={setSelected} speed={speed} focus={focus} clock={clock} />

        <div className="flex flex-col gap-6 xl:col-start-3 xl:row-span-2 xl:row-start-1">
        <aside className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          {!detail ? (
            <div className="text-sm text-slate-400">
              <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">Select a satellite</p>
              <p className="mt-3">
                {data.sats.length.toLocaleString("en-US")} satellites — communication, space stations, weather, Earth observation, navigation, science and amateur — propagated live with SGP4 from public orbital elements.
                Click any dot (or pick a name on the left) to see its craft, operator, orbit, coverage, and whatever it openly publishes: its own imagery, live video, radio transmitters and the latest signal received on the ground.
              </p>
            </div>
          ) : (
            <div>
              <SatelliteIllustration kind={detail.op[2]} color={familyColor(detail.op)} />
              <p className="mt-1 text-[10px] text-slate-500">Schematic of the bus type, not an image of this spacecraft.</p>
              <h3 className="mt-3 text-lg font-semibold text-slate-100">{detail.row[0]}</h3>
              <p className="text-sm" style={{ color: familyColor(detail.op) }}>
                {detail.op[0]}
                {detail.op[1] && <span className="text-slate-400"> · {countryName(detail.op[1])}</span>}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {[
                  ["NORAD / COSPAR", `${detail.row[1]} · ${detail.row[14]}`],
                  ["Launched", detail.row[12] || "—"],
                  ["Orbit", `${orbitClass(detail.geo.altKm)} · ${detail.row[6].toFixed(1)}° incl.`],
                  ["Altitude", `${Math.round(detail.geo.altKm).toLocaleString("en-US")} km`],
                  ["Speed", `${detail.geo.speedKms.toFixed(2)} km/s`],
                  ["Period", `${((24 * 60) / detail.row[4]).toFixed(1)} min`],
                  ["Sub-satellite point", `${detail.geo.lat.toFixed(1)}°, ${detail.geo.lon.toFixed(1)}°`],
                  ["Footprint radius", `${Math.round(detail.radius).toLocaleString("en-US")} km (≥ ${MIN_ELEVATION[detail.op[2]]}° elev.)`],
                  ["One-way delay to ground", `≥ ${((detail.geo.altKm / 299792.458) * 1000).toFixed(1)} ms`],
                  ["Elements epoch", detail.row[3].slice(0, 16).replace("T", " ")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-mono text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>


              <p className="mt-5 font-mono text-xs uppercase tracking-widest text-slate-400">In view now</p>
              <p className="mt-1 text-sm text-slate-300">
                {detail.countries.length ? `${detail.countries.slice(0, 30).map(countryName).join(", ")}${detail.countries.length > 30 ? ` … +${detail.countries.length - 30} more (${detail.countries.length} countries)` : ""}` : "Open ocean or polar region — no large city in the footprint."}
              </p>
              {detail.under.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {detail.under.length} cities ≥ 300k: {detail.under.slice(0, 12).map((city) => city[0]).join(", ")}
                  {detail.under.length > 12 ? "…" : ""}
                </p>
              )}

              {pass && (
                <>
                  <p className="mt-4 font-mono text-xs uppercase tracking-widest text-slate-400">Next {pass.minutes} min of ground track</p>
                  <p className="mt-1 text-sm text-slate-300">{pass.countries.length ? `${pass.countries.slice(0, 30).map(countryName).join(", ")}${pass.countries.length > 30 ? ` … +${pass.countries.length - 30} more` : ""}` : "No large cities under this pass."}</p>
                  {pass.cities.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {pass.cities.length} cities, largest: {pass.cities.slice(0, 10).map((city) => city[0]).join(", ")}
                    </p>
                  )}
                </>
              )}
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                &ldquo;Can serve&rdquo; is geometric: the area that sees the satellite above the minimum elevation angle. Actual service also needs a licence in that country and a gateway within reach.
              </p>
              <button type="button" onClick={() => setSelected(null)} className="mt-4 text-xs text-emerald-300 hover:text-emerald-200">
                Clear selection
              </button>
            </div>
          )}
        </aside>
        <OrbitTV />
        </div>

        {/* What the selected satellite openly publishes: fills the space under the list and the globe. */}
        {detail && (
          <div className="xl:col-span-2 xl:col-start-1 xl:row-start-2">
            <SatelliteFunction
              key={detail.row[1]}
              name={detail.row[0]}
              norad={detail.row[1]}
              kind={detail.op[2]}
              lat={detail.geo.lat}
              lon={detail.geo.lon}
              altKm={detail.geo.altKm}
              visibleCities={detail.under.length}
              totalCities={cities.length}
              marker={marker}
              clock={clock}
            />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Orbital elements and SATCAT launch data: CelesTrak ({data.retrieved.slice(0, 10)}). Propagation: SGP4 via satellite.js. Operators are assigned from satellite name families.
        Cities: GeoNames (CC BY 4.0). Borders: Natural Earth.
      </p>
    </div>
  );
}
