"use client";

import Image from "next/image";
import { hardwareItems } from "./hardware-items";
import styles from "./gpu-hover-preview.module.css";

const passages = [
  'GPU Core: The RTX 5090 (32GB GDDR7) delivers generational dominance.',
  'In local AI computing, "the GPU is everything," and the RTX 5090 32GB represents the absolute pinnacle of consumer-grade hardware:',
  "Significant VRAM boost (32GB): Moving from the previous flagship's 24GB to 32GB marks a qualitative leap. This allows for the lossless local execution and fine-tuning of larger-scale LLMs (such as 30B+ parameter models like Llama 3 and Qwen 2.5) and enables higher resolutions and larger batch sizes for image generation tasks (e.g., Stable Diffusion/Midjourney).",
  "Blackwell architecture and Tensor Core upgrades: The new generation of Tensor Cores features low-level hardware optimizations for FP8 and FP4 precision calculations—formats commonly used in AI—resulting in a massive, multi-fold increase in AI compute performance (TFLOPS) compared to the RTX 4090.",
];

export default function GpuHoverPreview({ anchor }: { anchor: { left: number; top: number } }) {
  return (
    <aside
      aria-label="RTX 5090 32GB AI computing preview"
      className={styles.preview}
      style={{
        left: Math.max(12, Math.min(anchor.left + 12, window.innerWidth - 672)),
        top: Math.max(12, Math.min(anchor.top - 48, window.innerHeight - 652)),
      }}
    >
      <Image src={hardwareItems[1].image} alt="" fill unoptimized sizes="660px" className={styles.image} aria-hidden="true" />
      <div className={styles.matrix} aria-hidden="true">
        {Array.from({ length: 32 }, (_, index) => (
          <span key={index} style={{ left: `${(index / 32) * 100}%`, animationDelay: `-${(index * 0.31) % 5}s` }}>
            {index % 2 === 0 ? "01010011100101101010" : "10110100101100110101"}
          </span>
        ))}
      </div>
      <div className={styles.content}>
        <div className={styles.label}>GPU / BLACKWELL / LOCAL AI</div>
        {passages.map((passage, paragraphIndex) => (
          <p key={passage} className={paragraphIndex === 0 ? styles.heading : styles.paragraph}>
            {passage.split(/(\s+)/).map((word, wordIndex) => (
              /^\s+$/.test(word) ? word : (
                <span key={wordIndex} className={styles.word}>
                  {Array.from(word).map((character, characterIndex) => (
                    <span
                      key={characterIndex}
                      className={styles.glyph}
                      style={{ animationDelay: `${paragraphIndex * 0.16 + ((wordIndex * 3 + characterIndex) % 22) * 0.045}s` }}
                    >
                      {character}
                    </span>
                  ))}
                </span>
              )
            ))}
          </p>
        ))}
      </div>
    </aside>
  );
}