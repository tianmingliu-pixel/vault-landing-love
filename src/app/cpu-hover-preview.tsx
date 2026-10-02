"use client";

import { useEffect, useRef } from "react";
import styles from "./cpu-hover-preview.module.css";

const passages = [
  "CPU and Motherboard Expansion: Intel Ultra 9 285K + Z890 with Full-Speed PCIe 5.0 Throughput.",
  "AI training requires the high-frequency, high-speed transfer of massive datasets between SSDs, system memory, and GPU VRAM.",
  "Top-tier Z890 motherboards (such as the GODLIKE series) offer optimized lane allocation, ensuring that both the GPU and PCIe 5.0 SSDs operate at maximum bandwidth and eliminating data transfer bottlenecks.",
  "Ultra 9 Multi-threaded Data Pre-processing: During local AI training, the CPU handles preliminary tasks such as data decompression and image augmentation.",
  "The 285K’s combination of multiple cores and high clock speeds delivers exceptional efficiency when executing these intensive single- or multi-threaded pre-processing workloads.",
];

export default function CpuHoverPreview({ anchor }: { anchor: { left: number; top: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (time: number) => {
      context.fillStyle = "#03120d";
      context.fillRect(0, 0, width, height);
      const phase = motion.matches ? 0 : time * 0.00055;
      for (let row = 0; row < 19; row++) {
        const depth = row / 18;
        const base = height * (0.27 + depth * 0.76);
        const stride = 9 + depth * 5;
        context.beginPath();
        for (let x = 0; x <= width + stride; x += stride) {
          const wave = Math.sin(x * 0.019 + phase * 2 + depth * 4) * (8 + depth * 25)
            + Math.cos(x * 0.008 - phase + depth * 9) * (3 + depth * 13);
          const y = base + wave;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
          if (row % 2 === 0) {
            context.fillStyle = `rgba(92, 255, 146, ${0.16 + depth * 0.52})`;
            context.beginPath();
            context.arc(x, y, 0.7 + depth * 1.1, 0, Math.PI * 2);
            context.fill();
            context.beginPath();
            context.moveTo(x, y);
          }
        }
        context.strokeStyle = `rgba(32, 230, 104, ${0.1 + depth * 0.36})`;
        context.lineWidth = 0.5 + depth;
        context.shadowColor = "#2bff83";
        context.shadowBlur = row % 4 === 0 ? 14 : 4;
        context.stroke();
      }
      context.shadowBlur = 0;
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  return (
    <aside
      aria-label="Intel Core Ultra 9 285K and Z890 preview"
      className={styles.preview}
      style={{
        left: Math.max(12, Math.min(anchor.left + 12, window.innerWidth - 640)),
        top: Math.max(12, Math.min(anchor.top - 34, window.innerHeight - 540)),
      }}
    >
      <canvas ref={canvasRef} className={styles.wave} aria-hidden="true" />
      <div className={styles.rain} aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => (
          <span key={index} style={{ left: `${index * 5 + 1}%`, animationDelay: `${(index * 0.37) % 4}s` }}>
            {index % 3 === 0 ? "010110101101001" : index % 3 === 1 ? "101001110010110" : "110100101011011"}
          </span>
        ))}
      </div>
      <div className={styles.content}>
        <div className={styles.label}>PROCESSOR / DATA PATH / Z890</div>
        {passages.map((passage, index) => (
          <p key={passage} className={index === 0 ? styles.heading : styles.line} style={{ animationDelay: `${index * 0.18}s` }}>{passage}</p>
        ))}
      </div>
    </aside>
  );
}