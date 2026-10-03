import type { DiagramName, Post } from "./posts-types";

/* Original artwork for the articles: generative covers and explanatory diagrams, drawn as inline SVG
   (so they're crisp at any size, free of licensing questions, and themed with each article's accent). */

const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

export function Cover({ motif, accent, className = "" }: { motif: Post["motif"]; accent: string; className?: string }) {
  const id = `g-${motif}`;
  return (
    <svg viewBox="0 0 800 420" className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${id}-glow`} cx="70%" cy="40%" r="70%">
          <stop offset="0" stopColor={accent} stopOpacity="0.45" />
          <stop offset="0.5" stopColor={accent} stopOpacity="0.08" />
          <stop offset="1" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-grid`} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#1e293b" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="800" height="420" fill="#020617" />
      <rect width="800" height="420" fill={`url(#${id}-grid)`} />
      <rect width="800" height="420" fill={`url(#${id}-glow)`} />
      {motif === "lattice" &&
        Array.from({ length: 7 }, (_, r) =>
          Array.from({ length: 9 }, (_, c) => {
            const x = 380 + c * 48 + (r % 2) * 24;
            const y = 60 + r * 46;
            const hot = (r * 9 + c) % 11 === 3;
            return (
              <g key={`${r}-${c}`}>
                <rect x={x - 10} y={y - 10} width="20" height="20" rx="4" fill={hot ? accent : "#0f172a"} stroke={accent} strokeOpacity={hot ? 1 : 0.35} />
                {c < 8 && <line x1={x + 10} y1={y} x2={x + 38} y2={y} stroke={accent} strokeOpacity="0.25" />}
              </g>
            );
          }),
        )}
      {motif === "neurons" &&
        [4, 6, 6, 3].map((n, layer, layers) =>
          Array.from({ length: n }, (_, i) => {
            const x = 420 + layer * 110;
            const y = 210 + (i - (n - 1) / 2) * 52;
            const next = layers[layer + 1];
            return (
              <g key={`${layer}-${i}`}>
                {next &&
                  Array.from({ length: next }, (_, j) => (
                    <line key={j} x1={x} y1={y} x2={x + 110} y2={210 + (j - (next - 1) / 2) * 52} stroke={accent} strokeOpacity="0.18" />
                  ))}
                <circle cx={x} cy={y} r="11" fill="#0f172a" stroke={accent} strokeWidth="2" />
              </g>
            );
          }),
        )}
      {motif === "orbit-agent" && (
        <g transform="translate(560 210)">
          {[60, 110, 160].map((r, k) => (
            <ellipse key={r} rx={r * 1.4} ry={r * 0.55} fill="none" stroke={accent} strokeOpacity={0.5 - k * 0.12} strokeDasharray={k === 2 ? "4 6" : undefined} transform={`rotate(${-18 + k * 14})`} />
          ))}
          <circle r="34" fill="#0f172a" stroke={accent} strokeWidth="2" />
          <text textAnchor="middle" y="6" fontSize="18" fill={accent} style={mono}>LLM</text>
          {[0, 1.6, 3.3, 4.6].map((a, k) => (
            <rect key={k} x={Math.cos(a) * 150 * 1.1 - 9} y={Math.sin(a) * 70 - 9} width="18" height="18" rx="4" fill={k === 2 ? "#f43f5e" : accent} opacity="0.9" />
          ))}
        </g>
      )}
      {motif === "columns" &&
        Array.from({ length: 10 }, (_, k) => {
          const h = 60 + ((k * 37) % 200);
          return <rect key={k} x={400 + k * 36} y={350 - h} width="24" height={h} rx="3" fill={accent} fillOpacity={0.25 + (k % 3) * 0.2} />;
        })}
      {motif === "sky" && (
        <g>
          {Array.from({ length: 90 }, (_, k) => (
            <circle key={k} cx={(k * 97) % 800} cy={(k * 53) % 420} r={k % 7 === 0 ? 1.6 : 0.8} fill="#e2e8f0" opacity={0.3 + (k % 5) * 0.12} />
          ))}
          <circle cx="600" cy="200" r="70" fill={accent} opacity="0.9" />
          <circle cx="600" cy="200" r="100" fill="none" stroke={accent} strokeOpacity="0.3" />
          {[150, 210, 270].map((r) => (
            <ellipse key={r} cx="600" cy="200" rx={r} ry={r * 0.32} fill="none" stroke="#94a3b8" strokeOpacity="0.25" />
          ))}
          <circle cx="390" cy="230" r="9" fill="#60a5fa" />
          <path d="M390 230 Q 470 120 560 175" fill="none" stroke="#34d399" strokeDasharray="5 5" />
        </g>
      )}
    </svg>
  );
}

const box = (x: number, y: number, w: number, h: number, label: string, color: string, sub?: string) => (
  <g key={label}>
    <rect x={x} y={y} width={w} height={h} rx="8" fill="#0f172a" stroke={color} />
    <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} textAnchor="middle" fontSize="13" fill="#e2e8f0" style={mono}>{label}</text>
    {sub && <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fontSize="10" fill="#94a3b8" style={mono}>{sub}</text>}
  </g>
);
const arrow = (x1: number, y1: number, x2: number, y2: number, color = "#64748b", label?: string) => (
  <g key={`${x1}-${y1}-${x2}-${y2}`}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" markerEnd="url(#arrowhead)" />
    {label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="10" fill="#94a3b8" style={mono}>{label}</text>}
  </g>
);

export function Diagram({ name, accent }: { name: DiagramName; accent: string }) {
  return (
    <svg viewBox="0 0 720 260" className="w-full" role="img" aria-label={name.replace("-", " ") + " diagram"}>
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#64748b" />
        </marker>
      </defs>
      <rect width="720" height="260" rx="12" fill="#020617" />
      {name === "trust-boundary" && (
        <g>
          <rect x="190" y="30" width="500" height="200" rx="12" fill="none" stroke={accent} strokeDasharray="6 6" />
          <text x="200" y="50" fontSize="11" fill={accent} style={mono}>trust boundary: our service</text>
          <rect x="460" y="90" width="210" height="120" rx="10" fill="none" stroke="#f59e0b" strokeDasharray="4 5" />
          <text x="470" y="108" fontSize="10" fill="#f59e0b" style={mono}>data store boundary</text>
          {box(30, 110, 130, 50, "Browser", "#94a3b8", "user A or B")}
          {box(230, 110, 150, 50, "API /notes/:id", accent, "authz check here")}
          {box(490, 125, 150, 50, "PostgreSQL", "#f59e0b", "WHERE owner_id = $1")}
          {arrow(160, 135, 230, 135, "#64748b", "HTTPS + cookie")}
          {arrow(380, 150, 490, 150, "#64748b", "SQL")}
          {arrow(490, 140, 380, 140)}
          <text x="230" y="200" fontSize="11" fill="#f43f5e" style={mono}>BOLA: id from URL used without owner check</text>
        </g>
      )}
      {name === "training-loop" && (
        <g>
          {box(40, 100, 120, 56, "Batch x, y", "#94a3b8")}
          {box(210, 40, 140, 56, "Forward", accent, "ŷ = model(x)")}
          {box(400, 100, 140, 56, "Loss", accent, "L(ŷ, y)")}
          {box(210, 170, 140, 56, "Backward", accent, "∂L/∂w")}
          {box(580, 100, 110, 56, "Step", "#34d399", "w ← w − η∇")}
          {arrow(160, 120, 210, 75)}
          {arrow(350, 75, 400, 115)}
          {arrow(400, 145, 350, 190)}
          {arrow(470, 156, 600, 156)}
          {arrow(580, 120, 540, 120)}
          <path d="M635 100 Q 635 10 280 30" fill="none" stroke="#64748b" strokeDasharray="4 4" markerEnd="url(#arrowhead)" />
          <text x="470" y="22" fontSize="10" fill="#94a3b8" style={mono}>repeat for every batch, every epoch</text>
        </g>
      )}
      {name === "agent-boundary" && (
        <g>
          <rect x="20" y="30" width="190" height="200" rx="12" fill="none" stroke="#f43f5e" strokeDasharray="6 6" />
          <text x="30" y="50" fontSize="11" fill="#f43f5e" style={mono}>untrusted input</text>
          {box(40, 70, 150, 40, "web pages", "#f43f5e")}
          {box(40, 125, 150, 40, "emails, files", "#f43f5e")}
          {box(40, 180, 150, 40, "tool results", "#f43f5e")}
          {box(270, 105, 130, 56, "Model", accent, "proposes calls")}
          {box(450, 105, 120, 56, "Policy", "#34d399", "schema · scope")}
          {box(615, 60, 90, 40, "read", "#64748b")}
          {box(615, 115, 90, 40, "write", "#f59e0b")}
          {box(615, 170, 90, 40, "human ok", "#34d399")}
          {arrow(190, 133, 270, 133)}
          {arrow(400, 133, 450, 133, "#64748b", "tool call")}
          {arrow(570, 120, 615, 80)}
          {arrow(570, 133, 615, 135)}
          {arrow(570, 148, 615, 190)}
        </g>
      )}
      {name === "data-pipeline" && (
        <g>
          <rect x="20" y="20" width="680" height="220" rx="12" fill="none" stroke="#38bdf8" strokeDasharray="6 6" />
          <text x="32" y="40" fontSize="11" fill="#38bdf8" style={mono}>docker compose — pinned versions</text>
          {box(40, 100, 120, 56, "Raw JSON", "#94a3b8", "landed as-is")}
          {box(200, 100, 130, 56, "Loader", accent, "upsert, idempotent")}
          {box(370, 100, 130, 56, "PostgreSQL", accent, "constraints")}
          {box(540, 60, 140, 56, "Spark", "#f59e0b", "when it outgrows 1 box")}
          {box(540, 150, 140, 56, "Parquet", "#34d399", "partitioned")}
          {arrow(160, 128, 200, 128)}
          {arrow(330, 128, 370, 128)}
          {arrow(500, 118, 540, 92)}
          {arrow(610, 116, 610, 150)}
        </g>
      )}
      {name === "space-data-path" && (
        <g>
          {box(30, 40, 140, 50, "Instrument", accent, "SUVI · SDO · EPIC")}
          {box(30, 160, 140, 50, "Ground station", "#94a3b8", "DSN · NOAA · NASA")}
          {box(230, 100, 150, 56, "Agency pipeline", "#f59e0b", "calibrate, publish")}
          {box(430, 100, 130, 56, "Our server", "#34d399", "fetch · cache · trim")}
          {box(600, 100, 100, 56, "Browser", "#e2e8f0", "3D + charts")}
          {arrow(100, 90, 100, 160, "#64748b", "radio")}
          {arrow(170, 185, 230, 140)}
          {arrow(380, 128, 430, 128, "#64748b", "JSON/PNG")}
          {arrow(560, 128, 600, 128)}
          <text x="430" y="200" fontSize="10" fill="#94a3b8" style={mono}>seconds (DSN) … days (EPIC) end to end</text>
        </g>
      )}
    </svg>
  );
}
