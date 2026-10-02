"use client";

import { useEffect, useRef, useState } from "react";
import { Hand, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import CpuHoverPreview from "./cpu-hover-preview";
import GpuHoverPreview from "./gpu-hover-preview";
import MotherboardHoverPreview from "./motherboard-hover-preview";
import MemoryHoverPreview from "./memory-hover-preview";
import StorageHoverPreview from "./storage-hover-preview";
import SystemHoverPreview from "./system-hover-preview";
import HardwareBlueprint from "./hardware-blueprint";
import { hardwareItems } from "./hardware-items";

const categories = ["All categories", "Processors", "Graphics cards", "Motherboards", "Memory", "Storage", "Cooling", "Power", "Cases"];

export default function HardwareCatalog() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [selected, setSelected] = useState<(typeof hardwareItems)[number] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number } | null>(null);
  const [cpuPreview, setCpuPreview] = useState<{ left: number; top: number } | null>(null);
  const [gpuPreview, setGpuPreview] = useState<{ left: number; top: number } | null>(null);
  const [motherboardPreview, setMotherboardPreview] = useState<{ left: number; top: number } | null>(null);
  const [memoryPreview, setMemoryPreview] = useState<{ left: number; top: number } | null>(null);
  const [storagePreview, setStoragePreview] = useState<{ left: number; top: number } | null>(null);
  const [systemPreview, setSystemPreview] = useState<{ index: 5 | 6 | 7; left: number; top: number } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const wheelRemainderRef = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !selected) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      if (Math.sign(wheelRemainderRef.current) !== Math.sign(delta)) wheelRemainderRef.current = 0;
      wheelRemainderRef.current += delta;
      const steps = Math.trunc(wheelRemainderRef.current / 80);
      if (!steps) return;
      wheelRemainderRef.current -= steps * 80;

      const nextZoom = Math.min(3, Math.max(1, Math.round((zoom - steps * 0.1) * 10) / 10));
      if (nextZoom === zoom) return;
      const bounds = viewport.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const contentX = (viewport.scrollLeft + x) / zoom;
      const contentY = (viewport.scrollTop + y) / zoom;
      setZoom(nextZoom);
      requestAnimationFrame(() => {
        viewport.scrollLeft = contentX * nextZoom - x;
        viewport.scrollTop = contentY * nextZoom - y;
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [selected, zoom]);

  const search = query.trim().toLocaleLowerCase();
  const results = hardwareItems.filter((item) =>
    (category === "All categories" || item.category === category) &&
    (!search || `${item.name} ${item.category} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(search)),
  );

  const openItem = (item: (typeof hardwareItems)[number]) => {
    setSelected(item);
    setZoom(1);
    wheelRemainderRef.current = 0;
    setDragging(false);
    setHandPosition(null);
    dialogRef.current?.showModal();
  };

  const stopDragging = (element: HTMLDivElement, pointerId: number) => {
    if (dragRef.current?.pointerId !== pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  };

  return (
    <div className="min-h-screen bg-[#0b1519] text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="text-lg font-semibold hover:text-emerald-300">首页</Link>
        <Link href="/#work" className="text-sm text-slate-400 hover:text-white">All work &larr;</Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="border-b border-slate-700/70 pb-10 pt-12 sm:pt-20">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-emerald-400">Solution 2/ AI Workstation &mdash; {hardwareItems.length} parts</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">Superpower Productives/ AI Flagship
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            3D Rendering, 4K/8K Video Editing, Local AI Computing, and Engineering Compilation Hardware Selection.
          </p>
        </div>

        <section aria-label="Hardware image database" className="pt-8">
          <div className="flex flex-col gap-4 border-b border-slate-700/70 pb-7 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="hardware-search" className="mb-2 block text-xs font-medium uppercase tracking-widest text-slate-400">Search the index</label>
              <input
                id="hardware-search"
                type="search"
                autoComplete="off"
                placeholder="CPU, memory, GPU..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-600 bg-[#142329] px-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div className="sm:w-56">
              <label htmlFor="hardware-category" className="mb-2 block text-xs font-medium uppercase tracking-widest text-slate-400">Category</label>
              <select
                id="hardware-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-600 bg-[#142329] px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                {categories.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-6 text-sm text-slate-400" aria-live="polite">
            <p>{results.length} {results.length === 1 ? "result" : "results"}</p>
            <p className="font-mono text-xs">HARDWARE / IMAGE INDEX</p>
          </div>

          {results.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => openItem(item)}
                  className="group overflow-hidden rounded-md border border-slate-700/70 bg-[#132229] text-left transition-colors hover:border-emerald-400/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
                >
                  <div
                    className="relative aspect-[4/3] bg-[#233339]"
                    onPointerEnter={(event) => {
                      if (event.pointerType === "touch") return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      if (index === 0) setCpuPreview({ left: rect.right, top: rect.top });
                      if (index === 1) setGpuPreview({ left: rect.right, top: rect.top });
                      if (index === 2) setMotherboardPreview({ left: rect.right, top: rect.top });
                      if (index === 3) setMemoryPreview({ left: rect.right, top: rect.top });
                      if (index === 4) setStoragePreview({ left: rect.right, top: rect.top });
                      if (index >= 5) setSystemPreview({ index: index as 5 | 6 | 7, left: rect.right, top: rect.top });
                    }}
                    onPointerLeave={() => {
                      if (index === 0) setCpuPreview(null);
                      if (index === 1) setGpuPreview(null);
                      if (index === 2) setMotherboardPreview(null);
                      if (index === 3) setMemoryPreview(null);
                      if (index === 4) setStoragePreview(null);
                      if (index >= 5) setSystemPreview(null);
                    }}
                  >
                    <Image src={item.image} alt={item.name} fill unoptimized loading={index < 3 ? "eager" : "lazy"} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                  </div>
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3 font-mono text-xs text-emerald-300">
                      <span>{item.category}</span>
                      <span className="text-slate-500">{String(hardwareItems.indexOf(item) + 1).padStart(2, "0")}</span>
                    </div>
                    <h2 className="text-lg font-semibold">{item.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="border-y border-slate-700 py-16 text-center">
              <h2 className="text-xl font-semibold">No matching hardware</h2>
              <p className="mt-2 text-sm text-slate-400">Try another part name or category.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("All categories"); }} className="mt-6 rounded-md border border-slate-600 px-5 py-2 text-sm hover:border-emerald-400">Clear filters</button>
            </div>
          )}
        </section>
        <HardwareBlueprint />
      </main>

      {cpuPreview && !selected && <CpuHoverPreview anchor={cpuPreview} />}
      {gpuPreview && !selected && <GpuHoverPreview anchor={gpuPreview} />}
      {motherboardPreview && !selected && <MotherboardHoverPreview anchor={motherboardPreview} />}
      {memoryPreview && !selected && <MemoryHoverPreview anchor={memoryPreview} />}
      {storagePreview && !selected && <StorageHoverPreview anchor={storagePreview} />}
      {systemPreview && !selected && <SystemHoverPreview preview={systemPreview} />}

      <dialog
        ref={dialogRef}
        aria-labelledby="hardware-dialog-title"
        onClose={() => { setSelected(null); setDragging(false); setHandPosition(null); dragRef.current = null; }}
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-5xl rounded-md border border-slate-600 bg-[#101d22] p-0 text-slate-100 shadow-2xl backdrop:bg-black/80"
      >
        {selected && (
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
              <span className="font-mono text-xs uppercase tracking-widest text-emerald-300">{selected.category}</span>
              <button type="button" onClick={() => dialogRef.current?.close()} title="Close detail" aria-label="Close detail" className="flex h-9 w-9 items-center justify-center rounded border border-slate-600 hover:border-emerald-400"><X size={18} /></button>
            </div>
            <div className="flex items-center justify-end gap-2 border-b border-slate-700 px-5 py-2" aria-label="Image zoom controls">
              {zoom > 1 && <span title="Drag image to pan" className="mr-auto flex items-center gap-2 font-mono text-[10px] text-emerald-300"><Hand size={16} aria-hidden="true" /> 0101 1010</span>}
              <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom === 1} title="Zoom out" aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center rounded border border-slate-600 hover:border-emerald-400 disabled:opacity-40"><ZoomOut size={18} /></button>
              <output className="w-14 text-center font-mono text-xs text-slate-300" aria-live="polite">{Math.round(zoom * 100)}%</output>
              <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} disabled={zoom === 3} title="Zoom in" aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center rounded border border-slate-600 hover:border-emerald-400 disabled:opacity-40"><ZoomIn size={18} /></button>
              <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} title="Reset zoom" aria-label="Reset zoom" className="ml-2 flex h-9 w-9 items-center justify-center rounded border border-slate-600 hover:border-emerald-400 disabled:opacity-40"><RotateCcw size={16} /></button>
            </div>
            <div
              ref={viewportRef}
              className="h-[min(52vh,520px)] w-full overflow-auto bg-[#233339]"
              style={{ cursor: zoom > 1 ? "none" : "default", touchAction: zoom > 1 ? "none" : "auto" }}
              onPointerEnter={(event) => { if (zoom > 1 && event.pointerType !== "touch") setHandPosition({ x: event.clientX, y: event.clientY }); }}
              onPointerLeave={() => { if (!dragRef.current) setHandPosition(null); }}
              onPointerDown={(event) => {
                if (zoom <= 1) return;
                const element = event.currentTarget;
                dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
                if (event.isTrusted) element.setPointerCapture(event.pointerId);
                setDragging(true);
                event.preventDefault();
              }}
              onPointerMove={(event) => {
                if (zoom > 1 && event.pointerType !== "touch") setHandPosition({ x: event.clientX, y: event.clientY });
                const start = dragRef.current;
                if (!start || start.pointerId !== event.pointerId) return;
                event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
                event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
              }}
              onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
              onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
            >
              <div className="relative" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
                <Image src={selected.fullImage} alt={selected.name} fill unoptimized draggable={false} sizes="(max-width: 1024px) 100vw, 1024px" className="pointer-events-none select-none object-contain" />
              </div>
            </div>
            {zoom > 1 && handPosition && (
              <div aria-hidden="true" className={`pointer-events-none fixed z-10 flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] shadow-lg ${dragging ? "border-amber-300 bg-[#20302e] text-amber-200" : "border-emerald-400 bg-[#142727] text-emerald-300"}`} style={{ left: handPosition.x + 12, top: handPosition.y + 12 }}>
                <Hand size={18} strokeWidth={1.8} /> 0101
              </div>
            )}
            <div className="px-5 py-6 sm:px-8">
              <h2 id="hardware-dialog-title" className="text-2xl font-semibold">{selected.name}</h2>
              <p className="mt-3 leading-relaxed text-slate-300">{selected.description}</p>
              <a href={selected.source} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-sm text-emerald-300 underline underline-offset-4 hover:text-emerald-200">产品与图片来源 &rarr;</a>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}