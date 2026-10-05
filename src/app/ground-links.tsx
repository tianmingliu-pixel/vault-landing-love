"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { realClock, type SimClock } from "./sim-clock";
import { addModelLights, buildSatelliteModel, disposeModel, poseModel, type SatMarker } from "./satellite-model";

/* Space-to-ground radio links for one satellite, on a 3D globe:
   - every online SatNOGS ground station (open, volunteer-run receivers)
   - stations inside the satellite's radio horizon right now, with the downlink drawn as beams and moving packets
   - stations that actually recorded this satellite recently (from SatNOGS observations) */

type Station = [id: number, name: string, lat: number, lon: number, online: number, bands: string];
export type Reception = { id: number; start: string; station_name: string; station_lat: number; station_lng: number };

const EARTH_KM = 6371;
const MIN_ELEVATION = 5; // degrees: typical horizon mask for amateur ground stations
const MAX_BEAMS = 24;

const rad = Math.PI / 180;
const at = (lat: number, lon: number, r = 1) =>
  new THREE.Vector3(r * Math.cos(lat * rad) * Math.sin(lon * rad), r * Math.sin(lat * rad), r * Math.cos(lat * rad) * Math.cos(lon * rad));

function horizonKm(altKm: number) {
  const e = MIN_ELEVATION * rad;
  return EARTH_KM * (Math.acos((EARTH_KM / (EARTH_KM + altKm)) * Math.cos(e)) - e);
}
function surfaceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

type Topology = { transform?: { scale: [number, number]; translate: [number, number] }; arcs: [number, number][][] };
function decodeArcs(topology: Topology): number[][] {
  const scale = topology.transform?.scale ?? [1, 1];
  const translate = topology.transform?.translate ?? [0, 0];
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const flat: number[] = [];
    for (const [a, b] of arc) {
      x += a;
      y += b;
      flat.push(x * scale[0] + translate[0], y * scale[1] + translate[1]);
    }
    return flat;
  });
}

let stationCache: Promise<Station[]> | null = null;
let borderCache: Promise<number[][]> | null = null;
const loadStations = () => (stationCache ??= fetch("/data/ground-stations.json").then((r) => r.json()).then((j: { stations: Station[] }) => j.stations).catch(() => []));
const loadBorders = () => (borderCache ??= fetch("/data/countries-110m.json").then((r) => r.json()).then(decodeArcs).catch(() => []));

export default function GroundLinks({ marker, receptions, frequency, name, clock = realClock }: { marker: SatMarker; receptions: Reception[]; frequency: string | null; name: string; clock?: SimClock }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef(marker);
  const clockRef = useRef(clock);
  const [simLabel, setSimLabel] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [borders, setBorders] = useState<number[][]>([]);
  const [inRange, setInRange] = useState<Station[]>([]);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);

  useEffect(() => {
    markerRef.current = marker;
  }, [marker]);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);
  useEffect(() => {
    let alive = true;
    loadStations().then((s) => alive && setStations(s));
    loadBorders().then((b) => alive && setBorders(b));
    return () => {
      alive = false;
    };
  }, []);

  const modelKey = `${marker.kind}|${marker.color}`;
  const receptionKey = useMemo(() => receptions.map((r) => r.id).join(","), [receptions]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !stations.length) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 50);
    camera.position.set(0, 0.8, 3.4);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);
    const owned: { dispose: () => void }[] = [];
    const own = <T extends { dispose: () => void }>(item: T) => (owned.push(item), item);

    scene.add(new THREE.Mesh(own(new THREE.SphereGeometry(0.995, 64, 48)), own(new THREE.MeshBasicMaterial({ color: 0x07131c }))));
    if (borders.length) {
      const positions: number[] = [];
      for (const arc of borders) {
        for (let i = 2; i < arc.length; i += 2) {
          const a = at(arc[i - 1], arc[i - 2], 1.001);
          const b = at(arc[i + 1], arc[i], 1.001);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      scene.add(new THREE.LineSegments(geometry, own(new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.7 }))));
    }

    // Stations: one point cloud; colours updated as the satellite moves.
    const stationPositions = new Float32Array(stations.length * 3);
    const stationColors = new Float32Array(stations.length * 3);
    stations.forEach((s, i) => {
      const p = at(s[2], s[3], 1.004);
      stationPositions.set([p.x, p.y, p.z], i * 3);
    });
    const stationGeometry = own(new THREE.BufferGeometry());
    stationGeometry.setAttribute("position", new THREE.BufferAttribute(stationPositions, 3));
    const colorAttr = new THREE.BufferAttribute(stationColors, 3);
    stationGeometry.setAttribute("color", colorAttr);
    scene.add(new THREE.Points(stationGeometry, own(new THREE.PointsMaterial({ size: 0.032, vertexColors: true }))));

    // Recent receptions: amber rings at the stations that recorded this satellite.
    const ringGeometry = own(new THREE.RingGeometry(0.018, 0.026, 24));
    const ringMaterial = own(new THREE.MeshBasicMaterial({ color: 0xf2b954, side: THREE.DoubleSide }));
    for (const r of receptions) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      const p = at(r.station_lat, r.station_lng, 1.006);
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2));
      scene.add(ring);
    }

    // Satellite.
    addModelLights(scene);
    const craft = buildSatelliteModel(markerRef.current.kind, markerRef.current.color);
    craft.scale.setScalar(0.06);
    scene.add(craft);
    const trailGeometry = own(new THREE.BufferGeometry());
    const trail = new THREE.Line(trailGeometry, own(new THREE.LineDashedMaterial({ color: 0xfde68a, dashSize: 0.02, gapSize: 0.015 })));
    scene.add(trail);
    const coverageGeometry = own(new THREE.BufferGeometry());
    scene.add(new THREE.LineLoop(coverageGeometry, own(new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 }))));

    // Beams (satellite → station) with travelling packets = the downlink.
    const beamGeometry = own(new THREE.BufferGeometry());
    const beamPositions = new Float32Array(MAX_BEAMS * 6);
    beamGeometry.setAttribute("position", new THREE.BufferAttribute(beamPositions, 3));
    scene.add(new THREE.LineSegments(beamGeometry, own(new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.55 }))));
    const packetGeometry = own(new THREE.SphereGeometry(0.008, 8, 8));
    const packetMaterial = own(new THREE.MeshBasicMaterial({ color: 0xd1fae5 }));
    const packets = Array.from({ length: MAX_BEAMS * 2 }, () => {
      const mesh = new THREE.Mesh(packetGeometry, packetMaterial);
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.addEventListener("start", () => setFollow(false));

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let lastScan = 0;
    let lastTrailSim = -Infinity;
    let linked: number[] = [];
    let satPos = new THREE.Vector3();
    const cyan = new THREE.Color(0x22d3ee).multiplyScalar(0.8);
    const green = new THREE.Color(0x34d399);

    let frame = 0;
    const loop = (now: number) => {
      const current = markerRef.current;
      const date = clockRef.current.now();
      const here = current.locate(date);
      const ahead = current.locate(new Date(date.getTime() + 30000));
      if (here && ahead) {
        satPos = at(here.lat, here.lon, 1 + here.altKm / EARTH_KM);
        poseModel(craft, satPos, at(ahead.lat, ahead.lon, 1 + ahead.altKm / EARTH_KM));

        // Rescan more often when time runs fast, so beams keep up with the satellite.
        if (now - lastScan > (clockRef.current.speed() > 1 ? 250 : 1000)) {
          lastScan = now;
          setSimLabel(`${date.toISOString().slice(11, 19)} UTC · ${clockRef.current.speed() === 1 ? "real time" : `×${clockRef.current.speed()}`}`);
          const reach = horizonKm(here.altKm);
          const hits: number[] = [];
          stations.forEach((s, i) => {
            const inside = surfaceKm(here.lat, here.lon, s[2], s[3]) <= reach;
            if (inside) hits.push(i);
            stationColors.set(inside ? [green.r, green.g, green.b] : [cyan.r, cyan.g, cyan.b], i * 3);
          });
          colorAttr.needsUpdate = true;
          linked = hits.slice(0, MAX_BEAMS);
          setInRange(hits.map((i) => stations[i]));
          // Coverage circle on the ground.
          const lambda = reach / EARTH_KM;
          const ring: THREE.Vector3[] = [];
          const la = here.lat * rad;
          const lo = here.lon * rad;
          for (let k = 0; k < 96; k++) {
            const b = (k / 96) * 2 * Math.PI;
            const lat2 = Math.asin(Math.sin(la) * Math.cos(lambda) + Math.cos(la) * Math.sin(lambda) * Math.cos(b));
            const lon2 = lo + Math.atan2(Math.sin(b) * Math.sin(lambda) * Math.cos(la), Math.cos(lambda) - Math.sin(la) * Math.sin(lat2));
            ring.push(at(lat2 / rad, lon2 / rad, 1.002));
          }
          coverageGeometry.setFromPoints(ring);
        }
        if (Math.abs(date.getTime() - lastTrailSim) > 60000) {
          lastTrailSim = date.getTime();
          const points: THREE.Vector3[] = [];
          for (let m = -20; m <= 40; m += 1) {
            const g = current.locate(new Date(date.getTime() + m * 60000));
            if (g) points.push(at(g.lat, g.lon, 1 + g.altKm / EARTH_KM));
          }
          trailGeometry.setFromPoints(points);
          trail.computeLineDistances();
        }

        beamPositions.fill(0);
        linked.forEach((stationIndex, k) => {
          beamPositions.set([satPos.x, satPos.y, satPos.z], k * 6);
          beamPositions.set(stationPositions.subarray(stationIndex * 3, stationIndex * 3 + 3), k * 6 + 3);
        });
        beamGeometry.attributes.position.needsUpdate = true;
        beamGeometry.setDrawRange(0, linked.length * 2);
        packets.forEach((packet, p) => {
          const k = p % MAX_BEAMS;
          if (k >= linked.length) {
            packet.visible = false;
            return;
          }
          const t = ((now / (1400 / Math.min(4, Math.max(1, Math.log10(clockRef.current.speed() + 1) * 2))) + p * 0.37 + (p >= MAX_BEAMS ? 0.5 : 0)) % 1);
          const target = new THREE.Vector3().fromArray(stationPositions, linked[k] * 3);
          packet.position.lerpVectors(satPos, target, t);
          packet.visible = true;
        });

        if (followRef.current) {
          const want = satPos.clone().normalize().multiplyScalar(3.1).add(new THREE.Vector3(0, 0.35, 0));
          camera.position.lerp(want, 0.05);
        }
      }
      controls.target.set(0, 0, 0);
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeModel(craft);
      owned.forEach((item) => item.dispose());
      renderer.dispose();
      // Release the GL context now: browsers allow only ~16 at once and evict the oldest (the big scenes) when it runs out.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // receptionKey stands in for `receptions` (new array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, borders, modelKey, receptionKey]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="relative aspect-video overflow-hidden rounded-md border border-slate-800 bg-[radial-gradient(circle_at_50%_45%,#0d2530_0%,#020617_70%)]">
        <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" role="img" aria-label={`${name} and the ground stations in its radio range, with the downlink drawn as beams`} />
        {!stations.length && <div className="absolute inset-0 grid place-items-center font-mono text-xs text-slate-500">Loading ground stations…</div>}
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-slate-300">{simLabel}</span>
        {!follow && (
          <button type="button" onClick={() => setFollow(true)} className="absolute bottom-2 right-2 rounded border border-slate-700 bg-black/70 px-2 py-0.5 text-[10px] text-emerald-300">
            Follow satellite
          </button>
        )}
        <div className="pointer-events-none absolute left-2 top-2 space-y-1 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-slate-300">
          <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />in radio range now</p>
          <p><span className="mr-1 inline-block h-2 w-2 rounded-full border border-amber-300" />recorded this satellite</p>
          <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-700" />other SatNOGS stations</p>
        </div>
      </div>
      <div className="text-xs">
        <p className="text-slate-400">
          Downlink{frequency ? <> <span className="font-mono text-slate-200">{frequency}</span></> : null} · horizon ≥ {MIN_ELEVATION}° · {stations.length} open stations worldwide
        </p>
        <p className="mt-3 font-mono uppercase tracking-widest text-emerald-300">In range now · {inRange.length}</p>
        <ul className="mt-1 max-h-32 overflow-y-auto text-slate-300">
          {inRange.length === 0 && <li className="text-slate-500">No open station under it at this moment.</li>}
          {inRange.slice(0, 40).map((s) => (
            <li key={s[0]} className="truncate">{s[1]}{s[5] ? <span className="text-slate-500"> · {s[5]}</span> : null}</li>
          ))}
        </ul>
        <p className="mt-3 font-mono uppercase tracking-widest text-amber-300">Recent receptions</p>
        <ul className="mt-1 space-y-0.5 text-slate-300">
          {receptions.length === 0 && <li className="text-slate-500">None published recently.</li>}
          {receptions.map((r) => (
            <li key={r.id} className="truncate">
              <a href={`https://network.satnogs.org/observations/${r.id}/`} rel="noreferrer" className="hover:text-emerald-300">
                {r.station_name || "Unnamed station"}
              </a>
              <span className="text-slate-500"> · {r.start.slice(5, 16).replace("T", " ")} UTC</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Beams show which receivers can hear the satellite now (geometry). Rings mark stations that actually logged it. Stations: SatNOGS Network, CC BY-SA 4.0.
        </p>
      </div>
    </div>
  );
}
