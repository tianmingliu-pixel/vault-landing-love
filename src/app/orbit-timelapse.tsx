"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Pause, Play } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { addModelLights, buildSatelliteModel, disposeModel, poseModel, type SatMarker } from "./satellite-model";

/* 24-hour time-lapse of the Earth from geostationary weather satellites, built from NASA GIBS frames
   (one frame every 30 minutes). Also an always-on "Orbit TV" channel that rotates through the disks
   and refreshes itself, so it never goes dark — unlike crewed-station video, which drops out on every
   loss of signal. */

const GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

export type Disk = { id: string; label: string; layer: string; bbox: string; centerLon: number; credit: string };

export const DISKS: Disk[] = [
  { id: "goes-east", label: "GOES-East (GOES-19) · 75.2°W", layer: "GOES-East_ABI_GeoColor", bbox: "-70,-145,70,-5", centerLon: -75.2, credit: "NOAA GOES-19 ABI GeoColor via NASA GIBS" },
  { id: "goes-west", label: "GOES-West (GOES-18) · 137.2°W", layer: "GOES-West_ABI_GeoColor", bbox: "-70,-180,70,-67", centerLon: -137.2, credit: "NOAA GOES-18 ABI GeoColor via NASA GIBS" },
  { id: "himawari", label: "Himawari-9 · 140.7°E", layer: "Himawari_AHI_Band13_Clean_Infrared", bbox: "-70,70,70,180", centerLon: 140.7, credit: "JMA Himawari-9 AHI infrared via NASA GIBS" },
];

/** The geostationary disk that best covers a longitude. Meteosat (Europe/Africa) is not in GIBS, so 0–70°E falls back to the nearest. */
export function diskFor(lon: number) {
  const gap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  return DISKS.reduce((best, disk) => (gap(lon, disk.centerLon) < gap(lon, best.centerLon) ? disk : best), DISKS[0]);
}

/** NASA's two official 24/7 ISS streams on YouTube (IDs as listed on youtube.com/@NASA/streams). */
export const ISS_STREAMS = [
  { id: "M3HKLzjvKPc", label: "Station cameras" },
  { id: "awQzjn72bI0", label: "HD Earth views" },
];

const STEP_MIN = 30;
const SPEEDS = [0.25, 0.5, 1, 2, 4];
const LAG_MIN = 40; // GIBS publishes geostationary frames with a short delay

function frameTimes(hours: number, now: number) {
  const latest = new Date(now - LAG_MIN * 60000);
  latest.setUTCMinutes(Math.floor(latest.getUTCMinutes() / STEP_MIN) * STEP_MIN, 0, 0);
  const step = hours > 24 ? 60 : STEP_MIN; // 3-day loops use hourly frames (72) to stay light
  const count = Math.round((hours * 60) / step);
  return Array.from({ length: count }, (_, i) => new Date(latest.getTime() - (count - 1 - i) * step * 60000).toISOString().slice(0, 19) + "Z");
}

const frameUrl = (disk: Disk, time: string, size: number) =>
  `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${disk.layer}&CRS=EPSG:4326&BBOX=${disk.bbox}&WIDTH=${size}&HEIGHT=${size}&FORMAT=image/jpeg&TIME=${time}`;

/** Preloads frames in order and reports which ones are ready. */
function useFrames(disk: Disk, hours: number, size: number, refreshKey: number) {
  // refreshKey = index of the current 10-minute block; the frame list is anchored to the end of that block.
  const times = useMemo(() => frameTimes(hours, (refreshKey + 1) * 600000), [hours, refreshKey]);
  const [ready, setReady] = useState<{ key: string; urls: string[] }>({ key: "", urls: [] });
  const key = `${disk.id}|${times[times.length - 1]}|${size}`;

  useEffect(() => {
    let alive = true;
    const urls: (string | null)[] = times.map(() => null);
    let index = 0;
    const loadNext = () => {
      if (!alive || index >= times.length) return;
      const i = index++;
      const url = frameUrl(disk, times[i], size);
      const image = new Image();
      image.onload = () => {
        if (!alive) return;
        urls[i] = url;
        setReady({ key, urls: urls.filter((u): u is string => Boolean(u)) });
        loadNext();
      };
      image.onerror = () => loadNext();
      image.src = url;
    };
    // Four parallel loaders keep it quick without hammering the server.
    for (let n = 0; n < 4; n++) loadNext();
    return () => {
      alive = false;
    };
  }, [disk, times, size, key]);

  const urls = ready.key === key ? ready.urls : [];
  return { urls, times, total: times.length };
}

function timeOf(url: string) {
  const match = url.match(/TIME=([^&]+)/);
  return match ? match[1].replace("T", " ").slice(0, 16) + " UTC" : "";
}

/** Drapes the current frame over a 3D Earth, seen from the satellite's own geostationary slot (6.6 Earth radii). */
function GlobeFrame({ disk, url, satellite }: { disk: Disk; url: string | null; satellite?: SatMarker }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const satelliteRef = useRef(satellite);
  useEffect(() => {
    satelliteRef.current = satellite;
  }, [satellite]);
  const modelKey = satellite ? `${satellite.kind}|${satellite.color}` : "";
  const setUrlRef = useRef<(url: string | null) => void>(() => undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
    const rad = Math.PI / 180;
    const view = (lon: number, distance: number) => new THREE.Vector3(distance * Math.sin(lon * rad), 0, distance * Math.cos(lon * rad));
    camera.position.copy(view(disk.centerLon, 6.6));
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    // Dark planet, then the image patch on a partial sphere matching the frame's lat/lon box, then an atmosphere rim.
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0b1220 }));
    const [south, west, north, east] = disk.bbox.split(",").map(Number);
    const patchGeometry = new THREE.SphereGeometry(1, 96, 72, (west + 90) * rad, (east - west) * rad, (90 - north) * rad, (north - south) * rad);
    const patchMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const patch = new THREE.Mesh(patchGeometry, patchMaterial);
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: "varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "varying vec3 vNormal; void main(){ float i = pow(0.75 - dot(vNormal, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.35,0.65,1.0,1.0) * i; }",
      }),
    );
    scene.add(base, patch, rim);

    // The selected satellite flying over, as a schematic spacecraft, with the next 40 minutes of its path.
    const at = (lat: number, lon: number, r: number) =>
      new THREE.Vector3(r * Math.cos(lat * rad) * Math.sin(lon * rad), r * Math.sin(lat * rad), r * Math.cos(lat * rad) * Math.cos(lon * rad));
    const sat = satelliteRef.current;
    const craft = sat ? buildSatelliteModel(sat.kind, sat.color) : null;
    const trailGeometry = new THREE.BufferGeometry();
    const trail = new THREE.Line(trailGeometry, new THREE.LineDashedMaterial({ color: 0xfde68a, dashSize: 0.03, gapSize: 0.02, transparent: true, opacity: 0.85 }));
    if (craft) {
      addModelLights(scene);
      craft.scale.setScalar(0.15);
      scene.add(craft, trail);
    }
    let trailAt = 0;
    const updateCraft = (now: number) => {
      const current = satelliteRef.current;
      if (!craft || !current) return;
      const date = new Date();
      const here = current.locate(date);
      const ahead = current.locate(new Date(date.getTime() + 30000));
      if (!here || !ahead) return;
      const p = at(here.lat, here.lon, 1 + here.altKm / 6371);
      poseModel(craft, p, at(ahead.lat, ahead.lon, 1 + ahead.altKm / 6371));
      if (now - trailAt > 10000) {
        trailAt = now;
        const points: THREE.Vector3[] = [];
        for (let m = 0; m <= 40; m += 1) {
          const g = current.locate(new Date(date.getTime() + m * 60000));
          if (g) points.push(at(g.lat, g.lon, 1 + g.altKm / 6371));
        }
        trailGeometry.setFromPoints(points);
        trail.computeLineDistances();
      }
    };

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const cache = new Map<string, THREE.Texture>();
    setUrlRef.current = (next) => {
      if (!next) return;
      const apply = (texture: THREE.Texture) => {
        patchMaterial.map = texture;
        patchMaterial.opacity = 1;
        patchMaterial.needsUpdate = true;
      };
      const cached = cache.get(next);
      if (cached) apply(cached);
      else
        loader.load(next, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          cache.set(next, texture);
          apply(texture);
        });
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 1.6;
    controls.maxDistance = 9;
    controls.enableZoom = false; // keep page scroll; use the buttons-free pinch/drag to rotate
    const resize = () => {
      const size = host.clientWidth || 1;
      renderer.setSize(size, size, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const loop = (now: number) => {
      updateCraft(now);
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      cache.forEach((texture) => texture.dispose());
      if (craft) disposeModel(craft);
      trailGeometry.dispose();
      (trail.material as THREE.Material).dispose();
      [base, patch, rim].forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [disk, modelKey]);

  useEffect(() => {
    setUrlRef.current(url);
  }, [url, disk, modelKey]);

  return <div ref={hostRef} className="h-full w-full cursor-grab active:cursor-grabbing" role="img" aria-label={`${disk.label}: frame draped on a 3D globe; drag to rotate`} />;
}

export function TimeLapse({ disk, hours = 24, size = 640, autoPlay = true, refreshKey, speed: speedProp, onSpeedChange, satellite }: {
  disk: Disk; hours?: number; size?: number; autoPlay?: boolean; refreshKey?: number; speed?: number; onSpeedChange?: (speed: number) => void;
  /** Optional satellite to fly over the 3D view in real time. */
  satellite?: SatMarker;
}) {
  const [ownKey] = useState(() => Math.floor(Date.now() / 600000));
  const { urls, total } = useFrames(disk, hours, size, refreshKey ?? ownKey);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [ownSpeed, setOwnSpeed] = useState(1);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  // Controlled when the parent passes a speed (Orbit TV keeps it across satellite switches).
  const speed = speedProp ?? ownSpeed;
  const setSpeed = onSpeedChange ?? setOwnSpeed;
  const loadedRef = useRef(0);
  loadedRef.current = urls.length;

  useEffect(() => {
    if (!playing) return;
    // 1× = 6 frames per second, i.e. 24 hours in about 8 seconds.
    const id = window.setInterval(() => setFrame((f) => (loadedRef.current ? (f + 1) % loadedRef.current : 0)), 160 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  const current = urls.length ? urls[Math.min(frame, urls.length - 1)] : null;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
        {mode === "3d" ? (
          <GlobeFrame disk={disk} url={current} satellite={satellite} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          current && <img src={current} alt={`${disk.label}, ${timeOf(current)}`} className="h-full w-full object-cover" />
        )}
        {!current && <div className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-xs text-slate-500">Loading frames…</div>}
        <div className="absolute bottom-2 right-2 inline-flex border border-slate-700 bg-black/70 p-0.5" aria-label="View">
          {(["3d", "2d"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`px-1.5 py-0.5 font-mono text-[10px] ${mode === option ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-slate-200">{current ? timeOf(current) : ""}</span>
        {urls.length < total && (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            {urls.length}/{total} frames
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause time-lapse" : "Play time-lapse"}
          className="grid h-7 w-7 place-items-center rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, urls.length - 1)}
          value={Math.min(frame, Math.max(0, urls.length - 1))}
          onChange={(event) => {
            setPlaying(false);
            setFrame(Number(event.target.value));
          }}
          aria-label="Time-lapse position"
          className="min-w-0 flex-1 accent-emerald-300"
        />
        <div className="inline-flex border border-slate-700 p-0.5" aria-label="Playback speed">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
              className={`px-1.5 py-0.5 font-mono text-[10px] ${speed === value ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


/** NASA ISS stream without YouTube's own chrome: no captions, titles or buttons over the picture.
    Hovering shows only a timeline (scrub back through the live window) and a full-screen button. */
export function IssPlayer({ streamId, title }: { streamId: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState({ current: 0, duration: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  // For live streams YouTube's duration runs ahead of the playable edge; the gap seen at start-up (playing live) is the baseline.
  const [liveGap, setLiveGap] = useState<number | null>(null);
  const origin = "https://www.youtube-nocookie.com";

  const send = (func: string, args: unknown[] = []) =>
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), origin);

  useEffect(() => {
    // Ask the player to stream its state to us, and drop the captions module once it is ready.
    const listen = () => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: streamId, channel: "widget" }), origin);
    const poll = window.setInterval(listen, 1000);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data) as { event?: string; info?: { currentTime?: number; duration?: number } };
        if (data.event === "onReady") send("unloadModule", ["captions"]);
        const current = data.info?.currentTime;
        const duration = data.info?.duration;
        if (typeof current === "number" || typeof duration === "number") {
          setInfo((prev) => {
            const next = { current: current ?? prev.current, duration: duration ?? prev.duration };
            if (next.current > 0 && next.duration > 0) setLiveGap((gap) => gap ?? Math.max(0, next.duration - next.current));
            return next;
          });
        }
      } catch {
        /* not a player message */
      }
    };
    window.addEventListener("message", onMessage);
    const dropCaptions = window.setTimeout(() => send("unloadModule", ["captions"]), 3000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(dropCaptions);
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  const params = "autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0&playsinline=1&enablejsapi=1&vq=hd1080";
  // Load the player with location.replace (not a src attribute) so it never adds entries to the browser history:
  // the Back button then always returns to the previous page instead of stepping through the video frame.
  useEffect(() => {
    frameRef.current?.contentWindow?.location.replace(`${origin}/embed/${streamId}?${params}`);
  }, [streamId]);
  const behind = info.duration ? Math.max(0, info.duration - info.current - (liveGap ?? 0)) : 0;
  const fmt = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

  return (
    <div ref={boxRef} className="group relative aspect-video overflow-hidden rounded-md border border-slate-800 bg-black">
      <iframe
        ref={frameRef}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        className="pointer-events-none h-[calc(100%+120px)] w-full -translate-y-[60px]"
      />
      {/* Transparent shield: keeps YouTube's hover UI from appearing over the video. */}
      <div className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <input
          type="range"
          min={0}
          max={Math.max(1, info.duration - (liveGap ?? 0))}
          step={1}
          value={scrub ?? info.current}
          onChange={(event) => setScrub(Number(event.target.value))}
          onPointerUp={() => {
            if (scrub !== null) send("seekTo", [scrub, true]);
            setScrub(null);
          }}
          onKeyUp={() => {
            if (scrub !== null) send("seekTo", [scrub, true]);
            setScrub(null);
          }}
          aria-label="Live timeline"
          className="min-w-0 flex-1 accent-rose-500"
        />
        <button
          type="button"
          onClick={() => send("seekTo", [info.duration, true])}
          className={`font-mono text-[10px] ${behind < 30 ? "text-rose-400" : "text-slate-300 hover:text-white"}`}
          title="Jump to live"
        >
          {behind < 30 ? "● LIVE" : `−${fmt(behind)}`}
        </button>
        <button
          type="button"
          aria-label="Full screen"
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void boxRef.current?.requestFullscreen?.())}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 hover:bg-white/10"
        >
          <Maximize2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Always-on channel: rotates GOES-East → GOES-West → Himawari, 24 h each loop, re-anchored to "now" every 10 minutes. */
export function OrbitTV() {
  const [channel, setChannel] = useState<"geo" | "iss">("geo");
  const [stream, setStream] = useState(1); // HD Earth views by default
  const [speed, setSpeed] = useState(1);
  const [diskIndex, setDiskIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(() => Math.floor(Date.now() / 600000));

  useEffect(() => {
    const id = window.setInterval(() => setRefreshKey(Math.floor(Date.now() / 600000)), 60000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (channel !== "geo") return;
    const id = window.setInterval(() => setDiskIndex((i) => (i + 1) % DISKS.length), 45000);
    return () => window.clearInterval(id);
  }, [channel]);

  const disk = DISKS[diskIndex];
  return (
    <section aria-labelledby="orbit-tv-title" className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p id="orbit-tv-title" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
          Orbit TV · 24/7
        </p>
        <div className="inline-flex border border-slate-700 p-0.5" aria-label="Channel">
          {(["geo", "iss"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={channel === option}
              onClick={() => setChannel(option)}
              className={`px-2 py-0.5 text-[10px] font-semibold ${channel === option ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              {option === "geo" ? "Earth · 24 h" : "ISS live"}
            </button>
          ))}
        </div>
      </div>

      {channel === "geo" ? (
        <>
          <div className="mt-3">
            <TimeLapse key={`${disk.id}-${refreshKey}`} disk={disk} hours={24} size={520} refreshKey={refreshKey} speed={speed} onSpeedChange={setSpeed} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {DISKS.map((d, i) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={i === diskIndex}
                onClick={() => setDiskIndex(i)}
                className={`rounded border px-1.5 py-0.5 text-[10px] ${i === diskIndex ? "border-emerald-300 text-emerald-200" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Never goes dark: the last 24 hours seen from geostationary orbit, one frame every 30 min, switching satellite every 45 s and refreshed every 10 min. {disk.credit}.
          </p>
        </>
      ) : (
        <>
          <div className="mt-3">
            <IssPlayer key={ISS_STREAMS[stream].id} streamId={ISS_STREAMS[stream].id} title="NASA live video from the International Space Station" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {ISS_STREAMS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={i === stream}
                onClick={() => setStream(i)}
                className={`rounded border px-1.5 py-0.5 text-[10px] ${i === stream ? "border-emerald-300 text-emerald-200" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
              >
                {s.label}
              </button>
            ))}
            <a href="https://www.youtube.com/@NASA/streams" rel="noreferrer" className="ml-auto text-[10px] text-emerald-300 hover:underline">All NASA streams</a>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">NASA&apos;s official stream from the ISS. It pauses during loss of signal and crew activities; the Earth channel does not.</p>
        </>
      )}
    </section>
  );
}
