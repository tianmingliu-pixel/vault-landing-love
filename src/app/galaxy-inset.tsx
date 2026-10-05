"use client";

import { useEffect, useRef, useState } from "react";

/* Where the whole solar system is going: a top-down sketch of the Milky Way with the Sun's orbit around the galactic
   centre, and an edge-on strip of its slow bob up and down through the disk.

   Every rate below is derived from measured values, so the orbit, the bob and the spiral arms keep consistent frequencies:
   - R₀ = 8.18 kpc to Sgr A* (GRAVITY Collaboration 2019); circular speed Θ₀ = 236 km/s (Reid et al. 2019)
     → angular speed Ω₀ = Θ₀/R₀ and one orbit = 2πR₀/Θ₀ ≈ 213 Myr.
   - Vertical oscillation ≈ 65 Myr period, amplitude ≈ 85 pc; today ≈ 20 pc north of the plane and moving north at
     W⊙ ≈ 7 km/s (Schönrich et al. 2010) — the phase below reproduces that velocity.
   - Spiral-arm pattern speed Ωp ≈ 28.2 km/s/kpc (Dias et al. 2019): the arms turn almost as fast as the Sun (it sits near
     corotation), so the Sun drifts only slowly relative to them.
   The arms are a schematic four-arm logarithmic spiral, not a survey map. */

const KPC_KM = 3.0857e16;
const MYR_S = 3.15576e13;
const R0 = 8.18; // kpc
const THETA0 = 236; // km/s
const OMEGA_SUN = (THETA0 / (R0 * KPC_KM)) * MYR_S; // rad per Myr
const OMEGA_ARMS = (28.2 / KPC_KM) * MYR_S; // rad per Myr
const ORBIT_MYR = (2 * Math.PI) / OMEGA_SUN; // ≈ 213
const BOB_MYR = 65;
const BOB_PC = 85;
const BOB_PHASE = Math.asin(20 / BOB_PC); // +20 pc now, rising
const SPAN = 15; // kpc from the centre to the edge of the map
const PITCH = (12.5 * Math.PI) / 180;
const ARMS = [
  { name: "Perseus", start: 0, color: "#38bdf8" },
  { name: "Scutum–Centaurus", start: Math.PI, color: "#38bdf8" },
  { name: "Sagittarius–Carina", start: Math.PI / 2, color: "#64748b" },
  { name: "Norma–Outer", start: (3 * Math.PI) / 2, color: "#64748b" },
];

/** Time-lapse rates in Myr of galactic time per real second. "Live" is real time. */
const RATES = [
  { label: "Live", myrPerSec: 1 / MYR_S },
  { label: "1 Myr/s", myrPerSec: 1 },
  { label: "5 Myr/s", myrPerSec: 5 },
  { label: "20 Myr/s", myrPerSec: 20 },
];

const z = (tMyr: number) => BOB_PC * Math.sin(BOB_PHASE + (tMyr / BOB_MYR) * Math.PI * 2);

function armPath(start: number, size: number) {
  const scale = size / 2 / SPAN;
  const c = size / 2;
  const pts: string[] = [];
  for (let t = 0; t <= 2.6 * Math.PI; t += 0.05) {
    const r = 3.2 * Math.exp(Math.tan(PITCH) * t);
    if (r > SPAN) break;
    const a = start + t;
    pts.push(`${(c + Math.cos(a) * r * scale).toFixed(1)},${(c + Math.sin(a) * r * scale).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}

function formatMyr(t: number) {
  if (t < 0.001) return `+${(t * 1e6).toFixed(0)} yr`;
  if (t < 1) return `+${(t * 1000).toFixed(1)} kyr`;
  if (t < 1000) return `+${t.toFixed(1)} Myr`;
  return `+${(t / 1000).toFixed(2)} Gyr`;
}

export default function GalaxyInset() {
  const [rate, setRate] = useState(2);
  const [paused, setPaused] = useState(false);
  const rateRef = useRef(RATES[2].myrPerSec);
  const pausedRef = useRef(false);
  const simRef = useRef(0); // galactic time since now, Myr; only ever moves forward
  const [view, setView] = useState({ t: 0, realSec: 0 });

  useEffect(() => {
    rateRef.current = RATES[rate].myrPerSec;
  }, [rate]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const opened = performance.now();
    let last = opened;
    let shown = 0;
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); // a hidden tab doesn't jump ahead
      last = now;
      if (!pausedRef.current) simRef.current += dt * rateRef.current;
      if (now - shown > 33) {
        shown = now;
        setView({ t: simRef.current, realSec: (now - opened) / 1000 });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const { t, realSec } = view;
  const size = 240;
  const c = size / 2;
  const scale = size / 2 / SPAN;
  // Seen from the north galactic pole everything turns clockwise; the Sun starts "below" the centre (usual orientation).
  const sunAngle = Math.PI / 2 - OMEGA_SUN * t;
  const armTurn = -OMEGA_ARMS * t;
  const sx = c + Math.cos(sunAngle) * R0 * scale;
  const sy = c + Math.sin(sunAngle) * R0 * scale;
  const orbits = Math.floor(t / ORBIT_MYR);
  const inOrbit = t - orbits * ORBIT_MYR;
  // Trail: the part of the current orbit already travelled.
  const steps = Math.max(2, Math.round((inOrbit / ORBIT_MYR) * 120));
  const trail = Array.from({ length: steps }, (_, k) => {
    const a = Math.PI / 2 - OMEGA_SUN * (orbits * ORBIT_MYR + (k / (steps - 1)) * inOrbit);
    return `${(c + Math.cos(a) * R0 * scale).toFixed(1)},${(c + Math.sin(a) * R0 * scale).toFixed(1)}`;
  }).join(" ");
  // Edge-on strip: the bob over the current orbit (it does not repeat orbit to orbit, ≈ 3.3 bobs per lap).
  const W = 300;
  const strip = Array.from({ length: 161 }, (_, k) => {
    const tk = orbits * ORBIT_MYR + (k / 160) * ORBIT_MYR;
    return `${((k / 160) * W).toFixed(1)},${(30 - (z(tk) / 100) * 24).toFixed(1)}`;
  }).join(" ");
  const travelledKm = THETA0 * realSec;
  const live = rate === 0;

  return (
    <div className="mt-3 rounded-lg border border-violet-900/60 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">The solar system&apos;s path through the Milky Way</p>
        <div className="ml-auto inline-flex border border-slate-700 p-0.5" aria-label="Galactic time speed">
          {RATES.map((r, i) => (
            <button key={r.label} type="button" aria-pressed={rate === i} onClick={() => setRate(i)} className={`px-1.5 py-0.5 font-mono text-[9px] ${rate === i ? "bg-violet-300 text-slate-950" : "text-slate-300 hover:text-white"}`}>
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPaused((p) => !p)} className="border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-300 hover:text-white">
          {paused ? "Play" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => {
            simRef.current = 0;
          }}
          className="border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-300 hover:text-white"
        >
          Now
        </button>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-[240px_1fr]">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[240px]" role="img" aria-label="Top-down view: the Sun's orbit around the centre of the Milky Way">
          <defs>
            <radialGradient id="galaxy-glow">
              <stop offset="0" stopColor="#fde68a" stopOpacity="0.55" />
              <stop offset="0.25" stopColor="#a78bfa" stopOpacity="0.18" />
              <stop offset="1" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={c} cy={c} r={c} fill="url(#galaxy-glow)" />
          <g transform={`rotate(${((armTurn * 180) / Math.PI).toFixed(3)} ${c} ${c})`}>
            {ARMS.map((arm) => (
              <path key={arm.name} d={armPath(arm.start, size)} fill="none" stroke={arm.color} strokeOpacity="0.55" strokeWidth={5} strokeLinecap="round" />
            ))}
            <ellipse cx={c} cy={c} rx={4.5 * scale} ry={1.4 * scale} transform={`rotate(-27 ${c} ${c})`} fill="#fde68a" fillOpacity="0.5" />
          </g>
          <circle cx={c} cy={c} r={2} fill="#fff" />
          <text x={c + 5} y={c - 5} fontSize="8" fill="#e2e8f0" style={{ fontFamily: "monospace" }}>Sgr A*</text>
          <circle cx={c} cy={c} r={R0 * scale} fill="none" stroke="#fbbf24" strokeOpacity="0.45" strokeDasharray="2 3" />
          <polyline points={trail} fill="none" stroke="#fbbf24" strokeWidth="1.6" />
          <circle cx={sx} cy={sy} r={4} fill="#fbbf24" stroke="#fff" strokeWidth="0.8" />
          <text x={sx + 6} y={sy + 3} fontSize="8" fill="#fde68a" style={{ fontFamily: "monospace" }}>Sun</text>
          <text x={4} y={size - 4} fontSize="7" fill="#64748b" style={{ fontFamily: "monospace" }}>seen from the north galactic pole · arms schematic</text>
        </svg>
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Edge-on · bobbing through the disk during orbit {orbits + 1}</p>
          <svg viewBox={`0 0 ${W} 60`} className="mt-1 w-full" style={{ height: 60 }} preserveAspectRatio="none" aria-label="Vertical oscillation of the Sun through the galactic plane">
            <line x1={0} x2={W} y1={30} y2={30} stroke="#475569" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <polyline points={strip} fill="none" stroke="#a78bfa" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <circle cx={(inOrbit / ORBIT_MYR) * W} cy={30 - (z(t) / 100) * 24} r={3} fill="#fbbf24" />
          </svg>
          <p className="flex justify-between font-mono text-[9px] text-slate-500">
            <span>{orbits === 0 ? "now" : `+${(orbits * ORBIT_MYR).toFixed(0)} Myr`}</span>
            <span>+{((orbits + 1) * ORBIT_MYR).toFixed(0)} Myr</span>
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
            <dt className="text-slate-500">Distance to centre</dt><dd className="font-mono text-slate-200">≈ 8.18 kpc (≈ 26,700 light years)</dd>
            <dt className="text-slate-500">Orbital speed</dt><dd className="font-mono text-slate-200">≈ {THETA0} km/s · {(OMEGA_SUN * (180 / Math.PI)).toFixed(2)}°/Myr</dd>
            <dt className="text-slate-500">One galactic orbit</dt><dd className="font-mono text-slate-200">≈ {ORBIT_MYR.toFixed(0)} million years</dd>
            <dt className="text-slate-500">Up–down bob</dt><dd className="font-mono text-slate-200">±{BOB_PC} pc every ≈ {BOB_MYR} Myr · now ≈ 20 pc north, rising</dd>
            <dt className="text-slate-500">Spiral arms</dt><dd className="font-mono text-slate-200">pattern turns once per ≈ {((2 * Math.PI) / OMEGA_ARMS).toFixed(0)} Myr</dd>
            <dt className="text-slate-500">Since you opened this</dt><dd className="font-mono text-emerald-300">Sun moved {Math.round(travelledKm).toLocaleString("en-US")} km around the galaxy</dd>
            <dt className="text-slate-500">{live ? "Galactic clock (live)" : "Time-lapse"}</dt>
            <dd className="font-mono text-amber-200">
              {formatMyr(t)} · orbit {orbits + 1} ({((inOrbit / ORBIT_MYR) * 100).toFixed(1)}%) · z {z(t) >= 0 ? "+" : ""}{z(t).toFixed(1)} pc{paused ? " · paused" : ""}
            </dd>
          </dl>
          <p className="mt-2 text-[9px] leading-snug text-slate-600">
            {live
              ? "Live runs at real speed: the Sun covers 236 km every second, far too little to see on a map 100,000 light years across — the counter above is the motion. Pick a time-lapse speed to watch the orbit."
              : `Time-lapse: ${RATES[rate].label} of galactic time per real second; Sun, bob and arms all advance on the same clock.`}{" "}
            Sources: GRAVITY Collaboration (2019), Reid et al. (2019), Schönrich et al. (2010), Dias et al. (2019).
          </p>
        </div>
      </div>
    </div>
  );
}
