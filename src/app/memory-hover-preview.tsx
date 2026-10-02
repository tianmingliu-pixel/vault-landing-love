"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { hardwareItems } from "./hardware-items";
import styles from "./memory-hover-preview.module.css";

const introduction = [
  "The CORSAIR DOMINATOR TITANIUM RGB DDR5 is a premium, luxury memory series engineered for enthusiasts who demand breathtaking aesthetics and absolute peak performance.",
  "The proposed configuration of 128GB (4 × 32GB) running at 6000 MT/s is meticulously tailored for massive data sets, local AI model fine-tuning, and intensive multi-threaded content creation.",
];

const note = "(Note: The provided image represents the design language and premium finish of the DOMINATOR TITANIUM series, rather than the exact physical configuration of this specific 4-stick kit.)";

const features = [
  { title: "Premium Artistry & DHX Cooling:", detail: "Built using strictly screened, high-frequency memory ICs and backed by patented DHX (Dual-path Heat Exchange) cooling technology. This cools both the front and back of the PCB, guaranteeing rock-solid stability even when all 128GB is fully stressed." },
  { title: "Innovative Customizable Top Bars:", detail: "Features a groundbreaking modular design with removable and replaceable top bars. Enthusiasts can swap them out for clean, non-RGB classic fins or utilize 3D printing to create entirely custom designs." },
  { title: "Brilliant Capellix RGB Illumination:", detail: "Crowned with 11 individually addressable, ultra-bright CAPELLIX LEDs per module. Beautiful, vibrant lighting effects can be endlessly customized and synchronized system-wide via CORSAIR iCUE software." },
  { title: "The Sweet Spot for High-Capacity:", detail: "While filling all 4 slots with 128GB (4x32GB) usually strains modern memory controllers, 6000 MT/s provides the perfect operational sweet spot—delivering massive bandwidth and unmatched memory depth without sacrificing system stability." },
];

function SpiralText({ text }: { text: string }) {
  return text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : (
    <span key={index} data-spiral-word className={styles.word}>{word}</span>
  ));
}

export default function MemoryHoverPreview({ anchor }: { anchor: { left: number; top: number } }) {
  const panelRef = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const words = panel.querySelectorAll<HTMLElement>("[data-spiral-word]");
    const positionWords = () => {
      const bounds = panel.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      words.forEach((word, index) => {
        const rect = word.getBoundingClientRect();
        const startX = centerX - rect.left - rect.width / 2;
        const startY = centerY - rect.top - rect.height / 2;
        const angle = index * 2.39996;
        word.style.setProperty("--start-x", `${startX}px`);
        word.style.setProperty("--start-y", `${startY}px`);
        word.style.setProperty("--mid-x", `${startX * 0.48 + Math.cos(angle) * 52}px`);
        word.style.setProperty("--mid-y", `${startY * 0.48 + Math.sin(angle) * 52}px`);
        word.style.animationDelay = `${(index % 28) * 0.035}s`;
      });
      setReady(true);
    };
    positionWords();
    const observer = new ResizeObserver(() => { if (!panel.classList.contains(styles.ready)) positionWords(); });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <aside
      ref={panelRef}
      aria-label="CORSAIR DOMINATOR TITANIUM RGB DDR5 preview"
      className={`${styles.preview} ${ready ? styles.ready : ""}`}
      style={{
        left: Math.max(12, Math.min(anchor.left + 12, window.innerWidth - 752)),
        top: Math.max(12, Math.min(anchor.top - 48, window.innerHeight - 772)),
      }}
    >
      <Image src={hardwareItems[3].image} alt="" fill unoptimized sizes="740px" className={styles.backdrop} aria-hidden="true" />
      <div className={styles.orbits} aria-hidden="true"><span /><span /><span /></div>
      <div className={styles.content}>
        <div className={styles.eyebrow}>DDR5 / 128GB / 6000 MT/S</div>
        <h2 className={styles.title}><SpiralText text="CORSAIR DOMINATOR TITANIUM RGB DDR5" /></h2>
        {introduction.map((paragraph) => <p key={paragraph} className={styles.intro}><SpiralText text={paragraph} /></p>)}
        <p className={styles.note}><SpiralText text={note} /></p>
        <div className={styles.featuresTitle}>Key Features:</div>
        <ul className={styles.features}>
          {features.map((feature) => (
            <li key={feature.title}>
              <strong><SpiralText text={feature.title} /></strong>{" "}<SpiralText text={feature.detail} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}