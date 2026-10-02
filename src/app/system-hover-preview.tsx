"use client";

import Image from "next/image";
import { hardwareItems } from "./hardware-items";
import styles from "./system-hover-preview.module.css";

const scenes = {
  5: {
    kind: "cooling",
    eyebrow: "THERMAL CIRCUIT / 420 MM",
    title: "ARCTIC Liquid Freezer III Pro 420",
    summary: "Heat travels from the processor through the liquid loop to the radiator, where airflow carries it away.",
    details: ["Cold plate draws heat from the CPU.", "Coolant transports it through the closed loop.", "The 420 mm radiator and fans release it into the airflow."],
  },
  6: {
    kind: "power",
    eyebrow: "ENERGY DISTRIBUTION / ATX 3.1",
    title: "Super Flower LEADEX VII XG 1300W",
    summary: "A 1300 W power supply converts mains power and distributes it to the workstation's demanding components.",
    details: ["CPU: stable power under sustained compute loads.", "GPU: account for RTX 5090 connector and power requirements.", "Storage and cooling: supply the rest of the system."],
  },
  7: {
    kind: "case",
    eyebrow: "ASSEMBLY PLAN / FULL TOWER",
    title: "Phanteks NV9",
    summary: "The chassis brings the build together: board, graphics card, large radiator, cabling, and directed airflow.",
    details: ["01 / Position the motherboard and cable routes.", "02 / Allow clearance for the graphics card.", "03 / Place the radiator and plan the airflow path."],
  },
} as const;

export default function SystemHoverPreview({ preview }: { preview: { index: 5 | 6 | 7; left: number; top: number } }) {
  const scene = scenes[preview.index];

  return (
    <aside
      aria-label={`${scene.title} preview`}
      className={`${styles.preview} ${styles[scene.kind]}`}
      style={{
        left: Math.max(12, Math.min(preview.left + 12, window.innerWidth - 632)),
        top: Math.max(12, Math.min(preview.top - 36, window.innerHeight - 592)),
      }}
    >
      <Image src={hardwareItems[preview.index].image} alt="" fill unoptimized sizes="620px" className={styles.image} aria-hidden="true" />
      <div className={styles.visual} aria-hidden="true">
        {preview.index === 5 && (
          <div className={styles.thermal}>
            <span className={styles.heatLabel}>CPU / HEAT</span>
            <div className={styles.flow}><i /><i /><i /></div>
            <span className={styles.coolLabel}>RADIATOR / AIR</span>
          </div>
        )}
        {preview.index === 6 && (
          <div className={styles.circuit}>
            <div className={styles.core}>1300<span>W</span></div>
            <div className={styles.rails}><span>CPU</span><span>GPU</span><span>DRIVES</span></div>
          </div>
        )}
        {preview.index === 7 && (
          <div className={styles.blueprint}>
            <div className={styles.outline}>
              <span>01 / BOARD</span><span>02 / GPU</span><span>03 / 420 MM</span>
            </div>
          </div>
        )}
      </div>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{scene.eyebrow}</p>
        <h2>{scene.title}</h2>
        <p className={styles.summary}>{scene.summary}</p>
        <ul>{scene.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
      </div>
    </aside>
  );
}