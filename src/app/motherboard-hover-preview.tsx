"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { hardwareItems } from "./hardware-items";
import styles from "./motherboard-hover-preview.module.css";

const introduction = [
  "The MSI MEG Z890 GODLIKE is the pinnacle of enthusiast hardware, engineered specifically for the latest Intel Core Ultra 200S (Arrow Lake-S) processors utilizing the new LGA1851 socket.",
  "As MSI's ultimate flagship motherboard, it is crafted for extreme overclockers, hardcore gamers, and elite content creators who demand zero compromises in AI compute and heavy rendering workflows.",
];

const features = [
  { title: "Monster Power Delivery:", detail: "Features an overkill digital power phase design engineered to effortlessly unlock the absolute maximum overclocking headroom of the Intel Core Ultra 9 285K." },
  { title: "Next-Gen DDR5 Performance:", detail: "Utilizing advanced memory routing technology, it pushes DDR5 memory speeds to stable new heights, ensuring ultra-low latency for heavy AI data prep." },
  { title: "Unmatched PCIe 5.0 Expansion:", detail: "Provides full-bandwidth PCIe 5.0 lanes to fully utilize cutting-edge GPUs like the NVIDIA RTX 5090, alongside multiple high-speed PCIe 5.0 M.2 SSD slots running concurrently without throttling." },
  { title: "Elite Connectivity:", detail: "Equipped with premium 10G LAN, next-generation Wi-Fi 7, and high-throughput Thunderbolt ports for lightning-fast networking and massive file transfers." },
  { title: "Luxury Aesthetic & Dynamic Dashboard:", detail: "Features the iconic GODLIKE premium styling with comprehensive thermal armor and an integrated smart dashboard display for real-time hardware telemetry and custom visuals." },
];

function StormText({ text, offset = 0 }: { text: string; offset?: number }) {
  return text.split(/(\s+)/).map((word, index) => {
    if (/^\s+$/.test(word)) return word;
    const position = index + offset;
    const style = {
      "--scatter-x": `${((position * 47) % 340) - 170}px`,
      "--scatter-y": `${((position * 71) % 240) - 120}px`,
      "--spin": `${((position * 29) % 100) - 50}deg`,
      animationDelay: `${(position % 25) * 0.032 + offset * 0.018}s`,
    } as CSSProperties;
    return <span key={index} className={styles.word} style={style}>{word}</span>;
  });
}

export default function MotherboardHoverPreview({ anchor }: { anchor: { left: number; top: number } }) {
  return (
    <aside
      aria-label="MSI MEG Z890 GODLIKE feature preview"
      className={styles.preview}
      style={{
        left: Math.max(12, Math.min(anchor.left + 12, window.innerWidth - 732)),
        top: Math.max(12, Math.min(anchor.top - 48, window.innerHeight - 756)),
      }}
    >
      <Image src={hardwareItems[2].image} alt="" fill unoptimized sizes="720px" className={styles.backdrop} aria-hidden="true" />
      <div className={styles.fragments} aria-hidden="true">
        {["Z890", "DDR5", "PCIe 5.0", "10G", "LGA1851", "Wi-Fi 7", "GODLIKE", "THUNDERBOLT"].map((fragment, index) => (
          <span key={fragment} style={{ left: `${(index * 31) % 85 + 5}%`, top: `${(index * 47) % 75 + 8}%`, animationDelay: `${index * 0.09}s` }}>{fragment}</span>
        ))}
      </div>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Z890 / ENTHUSIAST PLATFORM</div>
        <h2 className={styles.title}><StormText text="MSI MEG Z890 GODLIKE" /></h2>
        {introduction.map((paragraph, index) => (
          <p key={paragraph} className={styles.intro}><StormText text={paragraph} offset={index * 18 + 12} /></p>
        ))}
        <div className={styles.featuresTitle}>Key Features:</div>
        <ul className={styles.features}>
          {features.map((feature, index) => (
            <li key={feature.title}>
              <strong><StormText text={feature.title} offset={index * 16 + 32} /></strong>{" "}
              <StormText text={feature.detail} offset={index * 16 + 40} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}