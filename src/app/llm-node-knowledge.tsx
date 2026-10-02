"use client";

import { ArrowRight } from "lucide-react";
import { nodeKnowledge } from "./llm-knowledge";
import { services, type ServiceId } from "./llm-topology";
import styles from "./llm-node-knowledge.module.css";

export function NodeDiagram({ id, steps }: { id: ServiceId; steps: readonly string[] }) {
  if (id === "user") return <div className={styles.identity}>{[0, 1, 2].map((ring) => <span key={ring} />)}<b>U</b></div>;
  if (id === "spa") return <div className={styles.browser}><div className={styles.browserBar}><i /><i /><i /></div><div className={styles.browserLines}><span /><span /><span /></div></div>;
  if (id === "sso") return <div className={styles.token}><span>ISS</span><strong>JWT</strong><span>AUD</span></div>;
  if (id === "postgres") return <div className={styles.table}>{["ID    PRINCIPAL    SCOPE", "01    TENANT_A     READ", "02    TENANT_B     DENY"].map((row) => <span key={row}>{row}</span>)}</div>;
  if (id === "s3") return <div className={styles.objects}>{["bucket / prefix", "artifact / version", "policy / expiry"].map((name) => <span key={name}>{name}</span>)}</div>;
  if (id === "llm") return <div className={styles.tokens}>{["<s>", "context", "→", "token", "token", "</s>"].map((token, index) => <span key={index}>{token}</span>)}</div>;
  if (id === "rag") return <div className={styles.vectors}>{Array.from({ length: 24 }, (_, index) => <span key={index} style={{ opacity: index % 5 === 0 ? 1 : 0.4 }} />)}<strong>TOP-K / FILTERED</strong></div>;
  if (id === "hpc") return <div className={styles.queue}>{["JOB 001", "JOB 002", "JOB 003"].map((job, index) => <span key={job}>{job}<i style={{ width: `${80 - index * 23}%` }} /></span>)}</div>;
  if (id === "external") return <div className={styles.egress}><b>ALLOW</b>{[0, 1, 2, 3].map((index) => <span key={index} />)}</div>;
  if (id === "notify") return <div className={styles.signal}><b>✓</b>{[0, 1, 2].map((index) => <span key={index} />)}</div>;
  return <div className={styles.pipeline}>{steps.map((step, index) => <span key={step}>{step}{index < steps.length - 1 && <ArrowRight size={15} aria-hidden="true" />}</span>)}</div>;
}

export default function LlmNodeKnowledge({ nodeId }: { nodeId: ServiceId }) {
  const service = services.find((item) => item.id === nodeId)!;
  const knowledge = nodeKnowledge[nodeId];

  return (
    <section aria-labelledby="knowledge-title" className={`${styles.section} ${styles[nodeId]}`}>
      <div className={styles.inner}>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.overline}>Architecture knowledge / {knowledge.code}</p>
            <h2 id="knowledge-title">Inside the boundary</h2>
          </div>
          <p className={styles.context}>SELECTED SERVICE <span>{service.label}</span></p>
        </div>

        <div key={nodeId} className={styles.stage}>
          <div className={styles.stageGrid} aria-hidden="true" />
          <NodeDiagram id={nodeId} steps={knowledge.steps} />
          <div className={styles.stageLabel}>
            <span>{service.zone}</span>
            <strong>{service.label}</strong>
            <small>{knowledge.steps.join("  /  ")}</small>
          </div>
        </div>

        <div className={styles.columns}>
          <div><span>01 / MECHANISM</span><h3>What runs here</h3><p>{knowledge.principle}</p></div>
          <div><span>02 / TRUST BOUNDARY</span><h3>What must not cross</h3><p>{knowledge.boundary}</p></div>
          <div><span>03 / TEST CLAIM</span><h3>What would verify it</h3><p>{knowledge.verification}</p></div>
        </div>
      </div>
    </section>
  );
}