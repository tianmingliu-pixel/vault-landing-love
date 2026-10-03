"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import BackLink from "./back-link";
import { ArrowRight, Bell, BookOpen, Boxes, Cpu, Database, FileBox, Globe2, HardDrive, Network, Server, ShieldCheck, X, type LucideIcon } from "lucide-react";
import LlmRackScene, { type SecurityMode } from "./llm-rack-scene";
import LlmNodeKnowledge, { NodeDiagram } from "./llm-node-knowledge";
import { nodeKnowledge } from "./llm-knowledge";
import knowledgeStyles from "./llm-node-knowledge.module.css";
import { accessLevels, connections, services, type AccessLevel, type ConnectionId, type ServiceId } from "./llm-topology";

const nodeIcons: Record<ServiceId, LucideIcon> = {
  user: Globe2, spa: FileBox, api: Server, sso: ShieldCheck,
  postgres: Database, s3: HardDrive, llm: Cpu, rag: BookOpen,
  agent: Network, hpc: Boxes, external: Globe2, notify: Bell,
};

const levelColors: Record<AccessLevel, string> = {
  public: "text-[#f19b77]", auth: "text-[#f0bf80]",
  operator: "text-[#76e6c8]", manager: "text-[#d4bd83]",
};

const protocol = [
  { number: "01", title: "Establish the baseline", text: "Record exact response headers, allowed origins, methods, credentials, bind address and affected endpoints. The existing finding is a permissive CORS setting; its precise exploitability requires these measurements." },
  { number: "02", title: "Exercise the browser boundary", text: "Use two controlled origins and an instrumented local service. Compare a simple request with a preflighted request, then separate 'request reached the server' from 'browser script could read the response'." },
  { number: "03", title: "Test controls independently", text: "Check denial without an authenticated principal, rejection of unexpected Origin and Host values, scoped tool authorization, CSRF safeguards for state changes, and network reachability from outside the private segment." },
  { number: "04", title: "Evaluate residual risk", text: "Repeat tests from a non-browser client, which is not constrained by CORS. Record policy decisions, server-side effects, false positives and the provenance of each observation before claiming a risk is closed." },
];

const reading = [
  { label: "MDN / Cross-Origin Resource Sharing", href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS" },
  { label: "OWASP / CSRF Prevention", href: "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html" },
  { label: "NIST SP 800-207 / Zero Trust Architecture", href: "https://csrc.nist.gov/pubs/sp/800/207/final" },
];

export default function LlmResearch() {
  const [mode, setMode] = useState<SecurityMode>("exposure");
  const [focus, setFocus] = useState<ServiceId | null>(null);
  const [connectionId, setConnectionId] = useState<ConnectionId | null>(null);
  const [accessFilter, setAccessFilter] = useState<AccessLevel | "all">("all");
  const [inspected, setInspected] = useState<ServiceId | null>(null);
  const detailRef = useRef<HTMLDialogElement>(null);
  const selectedNode = services.find((node) => node.id === focus);
  const selectedConnection = connections.find((connection) => connection.id === connectionId);
  const inspectedService = services.find((node) => node.id === inspected);
  const inspectedKnowledge = inspected ? nodeKnowledge[inspected] : null;

  return (
    <main className="min-h-screen bg-[#101816] text-[#eff4ed]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="text-lg font-semibold hover:text-emerald-300">首页</Link>
        <BackLink fallback="/#work" />
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Research dossier / AI security / 01</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">Local LLM Hardening</h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#b8cbc0]">From a permissive local-server CORS configuration to a testable, isolated enterprise inference architecture. A security argument grounded in trust boundaries, not a claim that a diagram itself provides security.</p>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#365147] pt-5 font-mono text-xs text-[#a8c8b4]">
          <span><strong className="text-[#f4cc94]">OBSERVED</strong> / permissive CORS setting</span>
          <span><strong className="text-[#f4cc94]">DOCUMENTED</strong> / browser-origin risk path</span>
          <span><strong className="text-[#83dacb]">PROPOSED</strong> / isolated reference design</span>
        </div>
      </section>

      <section id="architecture" aria-labelledby="architecture-title" className="border-y border-[#355247] bg-[#14211c]">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Model / conceptual simulation</p>
              <h2 id="architecture-title" className="mt-3 text-2xl font-semibold sm:text-3xl">Enterprise inference control plane</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#a9c1b2]">User → React SPA → FastAPI → data, identity, inference and agent services. Edges encode requested roles, not live access grants.</p>
            </div>
            <div aria-label="Architecture mode" className="inline-flex w-full self-start border border-[#567366] p-1 sm:w-auto lg:self-auto">
              {(["exposure", "target"] as const).map((option) => (
                <button key={option} type="button" aria-pressed={mode === option} onClick={() => { setMode(option); setFocus(null); setConnectionId(null); }} className={`min-h-10 flex-1 px-4 text-xs font-semibold transition-colors sm:flex-none ${mode === option ? "bg-[#c3e9d0] text-[#102019]" : "text-[#b7cebf] hover:text-white"}`}>
                  {option === "exposure" ? "Observed boundary" : "Target isolation"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] overflow-x-auto bg-[#0d1a16]">
          <div className="relative min-w-[760px]">
            <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#4a806017 1px, transparent 1px), linear-gradient(90deg, #4a806017 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
            <LlmRackScene mode={mode} focus={focus} connectionId={connectionId} accessFilter={accessFilter} onInspect={(id) => { setInspected(id); setFocus(id); setConnectionId(null); detailRef.current?.showModal(); }} />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] text-[#b4d2c1]">
              {accessLevels.map((level) => <span key={level} className={levelColors[level]}>● {level.toUpperCase()}</span>)}
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Inspect services / access paths</p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter access level">
              {(["all", ...accessLevels] as const).map((level) => (
                <button key={level} type="button" aria-pressed={accessFilter === level} onClick={() => { setAccessFilter(level); setFocus(null); setConnectionId(null); }} className={`min-h-9 border px-3 text-xs font-semibold uppercase transition-colors ${accessFilter === level ? "border-[#a4dfc3] bg-[#284b3d] text-white" : "border-[#456354] text-[#b7cebf] hover:border-[#8fe3bc]"}`}>{level}</button>
              ))}
            </div>
            <div className="mt-5 grid gap-px bg-[#355247] sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Inspect architecture nodes">
              {services.map((node) => {
                const Icon = nodeIcons[node.id];
                return (
                  <button key={node.id} type="button" aria-pressed={focus === node.id} onClick={() => { setFocus(focus === node.id ? null : node.id); setConnectionId(null); }} className={`flex min-h-14 items-center gap-3 px-4 text-left text-sm transition-colors ${focus === node.id ? "bg-[#284b3d] text-white" : "bg-[#14211c] text-[#bdd1c4] hover:bg-[#21372b]"}`}>
                    <Icon size={18} aria-hidden="true" className={node.id === "user" || node.id === "spa" ? "text-[#f2aa88]" : "text-[#8fe3bc]"} />
                    <span>{node.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 border-l-2 border-[#87d7ae] pl-5">
              <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">{selectedConnection ? `${selectedConnection.access} / requested role` : selectedNode?.zone ?? (mode === "target" ? "Target architecture" : "Observed finding / open questions")}</p>
              <h3 className="mt-2 text-lg font-semibold">{selectedConnection ? `${services.find((service) => service.id === selectedConnection.from)?.label} → ${services.find((service) => service.id === selectedConnection.to)?.label}` : selectedNode?.label ?? (mode === "target" ? "Default-deny private compute" : "Permissive browser-origin boundary")}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#bdd0c3]">{selectedConnection?.purpose ?? selectedNode?.responsibility ?? (mode === "target" ? "This proposed design exposes authenticated FastAPI ingress, then enforces scoped downstream identities, tool policies and private network rules independently." : "A permissive CORS configuration was identified on a local LLM service. Whether browser script can read a response or trigger an effect depends on headers, credentials and server behavior; those conditions require measurement.")}</p>
              {selectedNode && <p className="mt-3 text-sm leading-relaxed text-[#9cdbb8]"><strong className="text-[#c7e9d1]">Connected paths:</strong> {connections.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).map((edge) => `${edge.from} → ${edge.to} (${edge.access})`).join(" · ")}</p>}
            </div>
          </div>
          <aside className="border-t border-[#466555] pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Control ledger / illustrative</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#355247] pb-3"><dt className="text-[#a8bdaf]">Browser origin</dt><dd className={mode === "exposure" ? "text-[#f4ad8a]" : "text-[#96e3b7]"}>{mode === "exposure" ? "Permissive finding" : "Allowlist proposed"}</dd></div>
              <div className="flex justify-between gap-4 border-b border-[#355247] pb-3"><dt className="text-[#a8bdaf]">Identity check</dt><dd className="text-[#d5c28d]">Verify separately</dd></div>
              <div className="flex justify-between gap-4 border-b border-[#355247] pb-3"><dt className="text-[#a8bdaf]">Compute network</dt><dd className={mode === "target" ? "text-[#96e3b7]" : "text-[#d5c28d]"}>{mode === "target" ? "Isolated target" : "Not established"}</dd></div>
              <div className="flex justify-between gap-4 border-b border-[#355247] pb-3"><dt className="text-[#a8bdaf]">Tool permissions</dt><dd className="text-[#d5c28d]">Scope per request</dd></div>
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-[#9db5a4]">This panel changes a reference model only. It does not configure, monitor or secure an actual server.</p>
            <h3 className="mt-7 border-t border-[#355247] pt-6 text-sm font-semibold">Requested service calls</h3>
            <div className="mt-3 divide-y divide-[#355247]">
              {connections.filter((edge) => accessFilter === "all" || edge.access === accessFilter).map((edge) => (
                <button key={edge.id} type="button" aria-pressed={connectionId === edge.id} onClick={() => { setConnectionId(connectionId === edge.id ? null : edge.id); setFocus(null); }} className={`flex min-h-11 w-full items-start justify-between gap-2 py-2 text-left text-xs transition-colors ${connectionId === edge.id ? "text-white" : "text-[#aac3b3] hover:text-white"}`}>
                  <span>{services.find((service) => service.id === edge.from)?.label} <ArrowRight size={12} aria-hidden="true" className="inline" /> {services.find((service) => service.id === edge.to)?.label}</span>
                  <span className={`shrink-0 font-mono uppercase ${levelColors[edge.access]}`}>{edge.access}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
        <LlmNodeKnowledge nodeId={focus ?? selectedConnection?.to ?? "api"} />
      </section>

      <dialog ref={detailRef} onClose={() => setInspected(null)} aria-labelledby="rack-detail-title" className="m-auto max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto border border-[#6d9e80] bg-[#111f19] p-0 text-[#eff4ed] shadow-2xl backdrop:bg-black/80">
        {inspected && inspectedService && inspectedKnowledge && (
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-[#476654] px-5 py-4 sm:px-8">
              <p className="font-mono text-xs uppercase tracking-widest text-[#9bd9b6]">Rack dossier / {inspectedKnowledge.code}</p>
              <button type="button" aria-label="Close rack details" title="Close rack details" onClick={() => detailRef.current?.close()} className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#587564] hover:border-emerald-300"><X size={18} /></button>
            </div>
            <div className="px-5 py-6 sm:px-8">
              <h2 id="rack-detail-title" className="text-2xl font-semibold sm:text-3xl">{inspectedService.label}</h2>
              <p className="mt-2 text-sm text-[#adc8b4]">{inspectedService.zone} / Conceptual technical diagram</p>
              <div className={`${knowledgeStyles[inspected]} ${knowledgeStyles.stage} mt-6 h-56`} role="img" aria-label={`${inspectedService.label} technical diagram: ${inspectedKnowledge.steps.join(', ')}`}>
                <div className={knowledgeStyles.stageGrid} aria-hidden="true" />
                <NodeDiagram id={inspected} steps={inspectedKnowledge.steps} />
              </div>
              <div className="mt-5 divide-y divide-[#476654] border-y border-[#476654] text-sm leading-relaxed">
                <div className="py-4"><h3 className="font-semibold text-[#b6eccb]">Mechanism</h3><p className="mt-2 text-[#c4d6c7]">{inspectedKnowledge.principle}</p></div>
                <div className="py-4"><h3 className="font-semibold text-[#b6eccb]">Trust boundary</h3><p className="mt-2 text-[#c4d6c7]">{inspectedKnowledge.boundary}</p></div>
                <div className="py-4"><h3 className="font-semibold text-[#b6eccb]">Verification</h3><p className="mt-2 text-[#c4d6c7]">{inspectedKnowledge.verification}</p></div>
              </div>
            </div>
          </div>
        )}
      </dialog>

      <section id="analysis" className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Research question / trust boundary</p>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">When does a local model endpoint become a browser-reachable authority?</h2>
        <div className="mt-10 grid gap-8 border-y border-[#3c5648] py-8 md:grid-cols-3">
          <div><p className="font-mono text-xs text-[#f4bb96]">01 / OBSERVATION</p><h3 className="mt-3 font-semibold">Configuration</h3><p className="mt-2 text-sm leading-relaxed text-[#aec3b3]">An over-permissive CORS setting was found and the drive-by browser path was documented. Exact headers, endpoint methods and successful response reads are not asserted here.</p></div>
          <div><p className="font-mono text-xs text-[#f4d397]">02 / HYPOTHESIS</p><h3 className="mt-3 font-semibold">Boundary failure</h3><p className="mt-2 text-sm leading-relaxed text-[#aec3b3]">If an attacker-controlled origin can read a sensitive response, confidentiality may fail. A request can also cause a server-side effect even when CORS blocks its response; test that separately.</p></div>
          <div><p className="font-mono text-xs text-[#8fe3bc]">03 / DESIGN TARGET</p><h3 className="mt-3 font-semibold">Independent controls</h3><p className="mt-2 text-sm leading-relaxed text-[#aec3b3]">Authentication, authorization, ingress filtering, network isolation and auditable policy decisions must protect the service independently of a browser CORS policy.</p></div>
        </div>
        <p className="mt-7 max-w-4xl border-l-2 border-[#f4ad8a] pl-5 text-sm leading-relaxed text-[#c5d5c7]"><strong className="text-white">Important distinction:</strong> CORS governs whether browser JavaScript may read cross-origin responses. It is not an authentication mechanism, does not govern non-browser clients, and should not be the only defense against cross-site state changes.</p>
      </section>

      <section id="protocol" className="border-y border-[#355247] bg-[#14211c]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Reproducible evaluation / proposed protocol</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">From finding to evidence</h2>
          <div className="mt-10 divide-y divide-[#3c5648] border-y border-[#3c5648]">
            {protocol.map((step) => (
              <div key={step.number} className="grid gap-3 py-7 sm:grid-cols-[60px_minmax(0,1fr)]">
                <span className="font-mono text-sm text-[#8fe3bc]">{step.number}</span>
                <div><h3 className="text-lg font-semibold">{step.title}</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#aec3b3]">{step.text}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-7 md:grid-cols-2">
            <div><h3 className="font-semibold">Evidence required to claim mitigation</h3><p className="mt-3 text-sm leading-relaxed text-[#b8cbbb]">Denied unauthorized requests, blocked cross-origin reads where intended, no unauthorized server-side state changes, restricted private-network reachability and recorded policy decisions. No measured results are supplied here.</p></div>
            <div><h3 className="font-semibold">Limits of this model</h3><p className="mt-3 text-sm leading-relaxed text-[#b8cbbb]">This is a conceptual topology, not a measured deployment. Model prompt injection, tool misuse, supply-chain integrity and privileged insider access require separate threat models and tests.</p></div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-[#8fe3bc]">Technical references</p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {reading.map((source) => <a key={source.href} href={source.href} rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#c8dbcc] underline decoration-[#5b896e] underline-offset-4 hover:text-white">{source.label} <ArrowRight size={14} aria-hidden="true" /></a>)}
        </div>
        <p className="mt-9 text-xs text-[#96ab99]">Case study status: documented finding and proposed reference design. Measurements and production controls not claimed.</p>
      </footer>
    </main>
  );
}