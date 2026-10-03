"use client";

import { useEffect, useRef, useState } from "react";

/* Where the whole solar system is going: a top-down sketch of the Milky Way with the Sun's ~230-million-year orbit
   around the galactic centre, and an edge-on strip showing its slow bob up and down through the galactic disk.
   Values: R⊙ ≈ 8.2 kpc (GRAVITY 2019), v ≈ 230 km/s, period ≈ 225–250 Myr, vertical oscillation ≈ ±70–100 pc
   every ≈ 60–70 Myr, today ≈ 20 pc north of the plane; peculiar motion ≈ 20 km/s toward the solar apex (near Vega).
   The arms are a schematic four-arm logarithmic spiral, not a survey map. */

const R_SUN = 8.2; // kpc
const SPAN = 15; // kpc shown from the centre to the edge
const ORBIT_MYR = 230;
const BOB_MYR = 65;
const PLAY_SECONDS = 40; // one galactic orbit per 40 s in the animation

const ARMS = [
  { name: "Perseus", start: 0, color: "#38bdf8" },
  { name: "Scutum–Centaurus", start: Math.PI, color: "#38bdf8" },
  { name: "Sagittarius–Carina", start: Math.PI / 2, color: "#64748b" },
  { name: "Norma–Outer", start: (3 * Math.PI) / 2, color: "#64748b" },
];
const PITCH = (12.5 * Math.PI) / 180;

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

export default function GalaxyInset() {
  const [phase, setPhase] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    start.current = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setPhase(((now - start.current) / 1000 / PLAY_SECONDS) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const size = 240;
  const c = size / 2;
  const scale = size / 2 / SPAN;
  // Sun starts "below" the centre (the usual map orientation) and goes round clockwise, as seen from the north galactic pole.
  const angle = Math.PI / 2 - phase * Math.PI * 2;
  const sx = c + Math.cos(angle) * R_SUN * scale;
  const sy = c + Math.sin(angle) * R_SUN * scale;
  const myr = phase * ORBIT_MYR;
  // Vertical bob: about +20 pc today, amplitude ~85 pc.
  const z = (t: number) => 85 * Math.sin(Math.asin(20 / 85) + (t / BOB_MYR) * Math.PI * 2);
  const W = 300;
  const strip = Array.from({ length: 121 }, (_, k) => `${((k / 120) * W).toFixed(1)},${(30 - (z((k / 120) * ORBIT_MYR) / 100) * 24).toFixed(1)}`).join(" ");
  // The trail already travelled in this orbit.
  const steps = Math.max(2, Math.round(phase * 120));
  const trail = Array.from({ length: steps }, (_, k) => {
    const a = Math.PI / 2 - (k / (steps - 1)) * phase * Math.PI * 2;
    return `${(c + Math.cos(a) * R_SUN * scale).toFixed(1)},${(c + Math.sin(a) * R_SUN * scale).toFixed(1)}`;
  }).join(" ");

  return (
    <div className="mt-3 rounded-lg border border-violet-900/60 bg-slate-900/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-violet-300">The solar system&apos;s path through the Milky Way</p>
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
          {ARMS.map((arm) => (
            <path key={arm.name} d={armPath(arm.start, size)} fill="none" stroke={arm.color} strokeOpacity="0.55" strokeWidth={5} strokeLinecap="round" />
          ))}
          <ellipse cx={c} cy={c} rx={4.5 * scale} ry={1.4 * scale} transform={`rotate(-27 ${c} ${c})`} fill="#fde68a" fillOpacity="0.5" />
          <circle cx={c} cy={c} r={2} fill="#fff" />
          <text x={c + 5} y={c - 5} fontSize="8" fill="#e2e8f0" style={{ fontFamily: "monospace" }}>Sgr A*</text>
          <circle cx={c} cy={c} r={R_SUN * scale} fill="none" stroke="#fbbf24" strokeOpacity="0.45" strokeDasharray="2 3" />
          <polyline points={trail} fill="none" stroke="#fbbf24" strokeWidth="1.6" />
          <circle cx={sx} cy={sy} r={4} fill="#fbbf24" stroke="#fff" strokeWidth="0.8" />
          <text x={sx + 6} y={sy + 3} fontSize="8" fill="#fde68a" style={{ fontFamily: "monospace" }}>Sun</text>
          <text x={4} y={size - 4} fontSize="7" fill="#64748b" style={{ fontFamily: "monospace" }}>seen from the north galactic pole · arms schematic</text>
        </svg>
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Edge-on · bobbing through the disk over one orbit</p>
          <svg viewBox={`0 0 ${W} 60`} className="mt-1 w-full" style={{ height: 60 }} preserveAspectRatio="none" aria-label="Vertical oscillation of the Sun through the galactic plane">
            <line x1={0} x2={W} y1={30} y2={30} stroke="#475569" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <polyline points={strip} fill="none" stroke="#a78bfa" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <circle cx={phase * W} cy={30 - (z(myr) / 100) * 24} r={3} fill="#fbbf24" />
          </svg>
          <p className="flex justify-between font-mono text-[9px] text-slate-500">
            <span>now</span>
            <span>+{ORBIT_MYR} Myr</span>
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
            <dt className="text-slate-500">Distance to centre</dt><dd className="font-mono text-slate-200">≈ 8.2 kpc (≈ 26,700 light years)</dd>
            <dt className="text-slate-500">Orbital speed</dt><dd className="font-mono text-slate-200">≈ 230 km/s</dd>
            <dt className="text-slate-500">One galactic orbit</dt><dd className="font-mono text-slate-200">≈ 230 million years</dd>
            <dt className="text-slate-500">Up–down bob</dt><dd className="font-mono text-slate-200">±85 pc every ≈ 65 Myr · now ≈ 20 pc north</dd>
            <dt className="text-slate-500">Local drift</dt><dd className="font-mono text-slate-200">≈ 20 km/s toward the solar apex (near Vega)</dd>
            <dt className="text-slate-500">Animation</dt><dd className="font-mono text-amber-200">+{myr.toFixed(0)} Myr · z {z(myr) >= 0 ? "+" : ""}{z(myr).toFixed(0)} pc</dd>
          </dl>
          <p className="mt-2 text-[9px] leading-snug text-slate-600">One orbit is compressed into {PLAY_SECONDS} s. Sources: GRAVITY Collaboration (2019) for the distance; Reid &amp; Brunthaler (2020) for the speed.</p>
        </div>
      </div>
    </div>
  );
}
