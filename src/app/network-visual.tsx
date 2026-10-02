"use client";

import type { NetNodeId } from "./network-topology";
import styles from "./network-visuals.module.css";

export function NetworkNodeVisual({ id, steps }: { id: NetNodeId; steps: readonly string[] }) {
  switch (id) {
    case "residential":
      return <div className={styles.rings}>{[0, 1, 2].map((ring) => <span key={ring} />)}<b>NAT</b></div>;
    case "enterprise":
      return <div className={styles.table}>{["VLAN   DEPT       ACCESS", "10     FINANCE    RESTRICT", "20     GUEST      ISOLATE"].map((row) => <span key={row}>{row}</span>)}</div>;
    case "government":
      return <div className={styles.hex}><span>ENCLAVE</span><strong>GOV</strong><span>AUDITED</span></div>;
    case "public":
      return <div className={styles.portal}><div className={styles.portalBar}><i /><i /><i /></div><div className={styles.portalBody}><span>CAPTIVE PORTAL</span><small>GUEST SSID / ISOLATED</small></div></div>;
    case "private":
      return <div className={styles.rack}>{["ROW A / TENANT 1", "ROW B / TENANT 2", "CAGE / POLICY"].map((row, index) => <span key={row} style={{ marginLeft: `${index * 22}px` }}>{row}</span>)}</div>;
    case "access":
      return <div className={styles.vectors}>{Array.from({ length: 24 }, (_, index) => <span key={index} style={{ opacity: index % 5 === 0 ? 1 : 0.4 }} />)}<strong>FIBER / CABLE / DSL</strong></div>;
    case "tower":
      return <div className={styles.tower}><i /><span />{[0, 1, 2].map((ring) => <em key={ring} />)}</div>;
    case "ixp":
      return (
        <div className={styles.mesh}>
          {[0, 1, 2, 3].map((node) => <span key={node} style={{ transform: `rotate(${node * 90}deg) translate(70px)` }} />)}
          <strong>PEER A</strong><strong>PEER B</strong><strong>PEER C</strong>
        </div>
      );
    case "backbone":
      return <div className={styles.tokens}>{["AS64500", "→", "AS64501", "→", "AS64502"].map((token, index) => <span key={index}>{token}</span>)}</div>;
    case "cable":
      return <div className={styles.rings}>{[0, 1, 2].map((ring) => <span key={ring} />)}<b>CORE</b></div>;
    case "dns":
      return <div className={styles.table}>{["ROOT       (.)", "TLD        (.com)", "AUTHORITATIVE  (example.com)"].map((row) => <span key={row}>{row}</span>)}</div>;
    case "cdn":
      return <div className={styles.rack}>{["EDGE NODE / CACHE 92%", "ANYCAST / NEAREST", "ORIGIN / FETCH ON MISS"].map((row, index) => <span key={row} style={{ marginLeft: `${index * 18}px` }}>{row}</span>)}</div>;
    default:
      return <div className={styles.pipeline}>{steps.map((step, index) => <span key={step}>{step}{index < steps.length - 1 && <i>&rarr;</i>}</span>)}</div>;
  }
}

export function HubVisual({ label }: { label: string }) {
  return (
    <div className={styles.hub}>
      {[0, 1, 2].map((ring) => <span key={ring} />)}
      <strong>{label}</strong>
    </div>
  );
}
