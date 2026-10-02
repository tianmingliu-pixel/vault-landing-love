"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { hardwareItems } from "./hardware-items";
import styles from "./storage-hover-preview.module.css";

const features = [
  { title: "Saturating the PCIe 4.0 Bandwidth:", detail: "Delivers blistering sequential read speeds up to 7,300 MB/s and write speeds up to 6,600 MB/s, pushing the absolute limits of the PCIe Gen4 interface." },
  { title: "Elite Low-Latency Responsiveness:", detail: "Boasting up to 1,200,000 IOPS in random reads, it drastically slashes asset loading times for heavy 3D rendering and eliminates data starvation bottlenecks during local AI model training loops." },
  { title: "Game Mode 2.0 & Extreme Endurance:", detail: "Features advanced thermal throttling management and predictive loading algorithms, paired with an exceptional 2,400 TBW (Terabytes Written) rating on the 4TB model to easily survive constant AI dataset overwrites." },
  { title: "The Sweet Spot for System Stability:", detail: "By utilizing this elite Gen4 drive as the primary OS and workspace volume, the system achieves a perfect balance of thermal efficiency and rock-solid stability compared to hotter running Gen5 drives." },
];

function DecodeLine({ children, step, className = "" }: { children: ReactNode; step: number; className?: string }) {
  return (
    <div className={`${styles.entry} ${className}`} style={{ "--delay": `${step * 0.18}s` } as CSSProperties}>
      <span className={styles.address} aria-hidden="true">{step.toString(16).padStart(2, "0").toUpperCase()}</span>
      <div className={styles.data}>{children}</div>
    </div>
  );
}

export default function StorageHoverPreview({ anchor }: { anchor: { left: number; top: number } }) {
  return (
    <aside
      aria-label="WD_BLACK SN850X 4TB storage preview"
      className={styles.preview}
      style={{
        left: Math.max(12, Math.min(anchor.left + 12, window.innerWidth - 752)),
        top: Math.max(12, Math.min(anchor.top - 48, window.innerHeight - 772)),
      }}
    >
      <Image src={hardwareItems[4].image} alt="" fill unoptimized sizes="740px" className={styles.backdrop} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.eyebrow}>STORAGE INDEX / NVME / 04</div>
        <DecodeLine step={0} className={styles.title}><h2>WD_BLACK SN850X 4TB</h2></DecodeLine>
        <DecodeLine step={1}><p>The <strong>WD_BLACK SN850X 4TB</strong> from Western Digital is a top-tier, enthusiast-grade <strong>PCIe Gen4 NVMe M.2 SSD</strong> that defines high-speed storage reliability. In this ultimate flagship build, it has been selected as the <strong>Main Drive</strong> to house the operating system, high-frequency AI datasets, and primary engineering applications. Its massive <strong>4TB capacity</strong> ensures that you never run out of scratch space during intensive computing tasks.</p></DecodeLine>
        <DecodeLine step={2} className={styles.note}><p>(Note: While this drive serves as the system&apos;s ultra-reliable core storage, adding a secondary cutting-edge PCIe 5.0 SSD remains an optional upgrade for workflows requiring maximum sequential bandwidth.)</p></DecodeLine>
        <div className={styles.featuresTitle}>Key Features:</div>
        {features.map((feature, index) => (
          <DecodeLine key={feature.title} step={index + 3}>
            <p><strong>{feature.title}</strong> {feature.detail}</p>
          </DecodeLine>
        ))}
        <div className={styles.checksum} aria-hidden="true">VERIFY / DATA PATH READY <span>100%</span></div>
      </div>
    </aside>
  );
}