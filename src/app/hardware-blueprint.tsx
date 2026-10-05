"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { hardwareRoutes, workloads, type HardwareRouteId } from "./hardware-routes";

const points = {
  CPU: new THREE.Vector3(-1.3, 0.33, -0.2),
  DDR5: new THREE.Vector3(-2.7, 0.3, -1.25),
  GPU: new THREE.Vector3(1.65, 0.33, 0.85),
  NVME: new THREE.Vector3(0.85, 0.31, -1.25),
  PSU: new THREE.Vector3(3.35, 0.32, -2.15),
  LOOP: new THREE.Vector3(-1.3, 0.95, -0.2),
  RAD: new THREE.Vector3(-3.35, 0.34, -2.12),
};

const paths: Record<HardwareRouteId, THREE.Vector3[]> = {
  "nvme-cpu": [points.NVME, new THREE.Vector3(0.1, 0.44, -1.25), new THREE.Vector3(0.1, 0.44, -0.2), points.CPU],
  "cpu-ram": [points.CPU, new THREE.Vector3(-2.35, 0.44, -0.2), points.DDR5],
  "cpu-gpu": [points.CPU, new THREE.Vector3(-0.25, 0.44, 0.9), points.GPU],
  "psu-cpu": [points.PSU, new THREE.Vector3(2.9, 0.49, -2.05), new THREE.Vector3(-1.3, 0.49, -2.05), points.CPU],
  "psu-gpu": [points.PSU, new THREE.Vector3(3.15, 0.5, 0.85), points.GPU],
  "cpu-loop": [points.CPU, points.LOOP],
  "loop-radiator": [points.LOOP, new THREE.Vector3(-3.35, 0.95, -0.2), points.RAD],
};

const routeColors = { data: 0x48e1d6, power: 0xffc978, thermal: 0xff917f };
const labels = Object.entries(points) as [keyof typeof points, THREE.Vector3][];

export default function HardwareBlueprint() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const selectionRef = useRef<{ workload: string; route: HardwareRouteId | null }>({ workload: "ai", route: null });
  const [workloadId, setWorkloadId] = useState<(typeof workloads)[number]["id"]>("ai");
  const [routeId, setRouteId] = useState<HardwareRouteId | null>(null);
  const [labelPositions, setLabelPositions] = useState<Record<string, { x: number; y: number }>>({});

  const workload = workloads.find((item) => item.id === workloadId) ?? workloads[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6, 6, 5, -5, 0.1, 50);
    camera.position.set(8, 9, 10);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const assembly = new THREE.Group();
    scene.add(assembly);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(7.9, 0.12, 5.2),
      new THREE.MeshBasicMaterial({ color: 0x133b3c, transparent: true, opacity: 0.42 }),
    );
    assembly.add(board);
    const grid = new THREE.GridHelper(8, 20, 0x5ba09b, 0x2a6261);
    grid.position.y = 0.075;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.32;
    assembly.add(grid);

    const addPart = (center: THREE.Vector3, size: [number, number, number], color: number) => {
      const geometry = new THREE.BoxGeometry(...size);
      const part = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, depthWrite: false }));
      part.position.copy(center);
      assembly.add(part);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.82 }));
      edges.position.copy(center);
      assembly.add(edges);
    };

    addPart(points.CPU, [0.86, 0.34, 0.86], 0x78eee0);
    addPart(points.GPU, [2.25, 0.38, 0.86], 0x6de1d9);
    addPart(points.NVME, [1.1, 0.13, 0.27], 0x86d6c9);
    addPart(points.PSU, [0.83, 0.53, 0.85], 0xffc978);
    addPart(points.LOOP, [1.2, 0.13, 1.2], 0xff917f);
    addPart(points.RAD, [0.33, 0.3, 2.25], 0xff917f);
    addPart(new THREE.Vector3(0, 0.2, 0.3), [0.65, 0.16, 0.65], 0x4f9192);
    for (let index = 0; index < 4; index++) {
      addPart(new THREE.Vector3(-2.9 + index * 0.15, 0.29, -1.25), [0.08, 0.25, 1.16], 0x93e6d4);
    }
    for (let index = 0; index < 3; index++) {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.025, 24), new THREE.MeshBasicMaterial({ color: 0x81ddd5, transparent: true, opacity: 0.4 }));
      fan.position.set(0.95 + index * 0.72, 0.55, 0.85);
      assembly.add(fan);
    }

    const routes = hardwareRoutes.map((route, index) => {
      const curve = new THREE.CatmullRomCurve3(paths[route.id].map((point) => point.clone()));
      const material = new THREE.MeshBasicMaterial({ color: routeColors[route.kind], transparent: true, opacity: 0.85, depthWrite: false });
      const trace = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.015, 6, false), material);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), new THREE.MeshBasicMaterial({ color: routeColors[route.kind] }));
      pulse.position.copy(curve.getPoint(index / hardwareRoutes.length));
      assembly.add(trace, pulse);
      return { route, curve, material, pulse, offset: index / hardwareRoutes.length };
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = (time = 0) => {
      const selection = selectionRef.current;
      const active = workloads.find((item) => item.id === selection.workload) ?? workloads[0];
      routes.forEach(({ route, curve, material, pulse, offset }) => {
        const enabled = selection.route ? route.id === selection.route : active.routeIds.some((id) => id === route.id);
        material.opacity = enabled ? 0.92 : 0.09;
        pulse.visible = enabled;
        pulse.position.copy(curve.getPoint(reducedMotion.matches ? offset : (time * 0.00016 + offset) % 1));
      });
      renderer.render(scene, camera);
    };
    renderRef.current = () => render(performance.now());

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfHeight = Math.max(4.7, 5.8 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      const projected: Record<string, { x: number; y: number }> = {};
      labels.forEach(([name, point]) => {
        const screen = point.clone().project(camera);
        projected[name] = { x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2 - 16 };
      });
      setLabelPositions(projected);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let frame = 0;
    const animate = (time: number) => {
      render(time);
      frame = requestAnimationFrame(animate);
    };
    if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
    const changeMotion = () => {
      cancelAnimationFrame(frame);
      if (reducedMotion.matches) render();
      else frame = requestAnimationFrame(animate);
    };
    reducedMotion.addEventListener("change", changeMotion);

    return () => {
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener("change", changeMotion);
      observer.disconnect();
      renderRef.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.GridHelper) {
          geometries.add(object.geometry);
          const assigned = Array.isArray(object.material) ? object.material : [object.material];
          assigned.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      // Release the GL context now: browsers allow only ~16 at once and evict the oldest (the big scenes) when it runs out.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    selectionRef.current = { workload: workloadId, route: routeId };
    renderRef.current?.();
  }, [workloadId, routeId]);

  return (
    <section aria-labelledby="blueprint-title" className="border-t border-slate-700/70 pt-12 mt-16 sm:mt-20">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-emerald-400">Hardware layer / 01</p>
        <h2 id="blueprint-title" className="mt-3 text-2xl font-semibold sm:text-3xl">Hardware Electronics Signals Blueprint</h2>
        <p className="mt-2 text-sm text-slate-400">How data, power, and heat flow within the local workstation.</p>
      </div>

      <div aria-label="Workload" className="mb-7 grid grid-cols-2 gap-1 border-b border-slate-700 pb-5 sm:flex sm:flex-wrap">
        {workloads.map((item) => (
          <button key={item.id} type="button" aria-pressed={workloadId === item.id} onClick={() => { setWorkloadId(item.id); setRouteId(null); }} className={`min-h-10 border-b-2 px-3 py-2 text-sm transition-colors ${workloadId === item.id ? "border-emerald-400 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>{item.label}</button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_285px] lg:gap-10">
        <div className="relative h-[390px] min-w-0 overflow-hidden bg-[#0b1c20] sm:h-[500px] lg:h-[540px]" role="img" aria-label={`Transparent 3D hardware blueprint for ${workload.label}`}>
          <div ref={containerRef} className="absolute inset-0" />
          {labels.map(([name]) => labelPositions[name] && (
            <span key={name} aria-hidden="true" className="pointer-events-none absolute z-10 -translate-x-1/2 font-mono text-[10px] font-bold tracking-wider text-[#ddfff4] drop-shadow-[0_1px_5px_#041111] sm:text-xs" style={{ left: labelPositions[name].x, top: labelPositions[name].y }}>{name}</span>
          ))}
          <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 flex gap-4 font-mono text-[10px] text-slate-300">
            <span className="text-[#48e1d6]">● DATA</span><span className="text-[#ffc978]">● POWER</span><span className="text-[#ff917f]">● HEAT</span>
          </div>
        </div>

        <div className="lg:border-l lg:border-slate-700 lg:pl-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">{workload.software}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">{workload.flow}</p>
          <h3 className="mb-2 mt-7 text-sm font-semibold">electrical paths / Route details</h3>
          <div className="divide-y divide-slate-700/70 border-y border-slate-700/70">
            {hardwareRoutes.map((route) => {
              const inWorkload = workload.routeIds.some((id) => id === route.id);
              const highlighted = routeId ? routeId === route.id : inWorkload;
              return (
                <button key={route.id} type="button" aria-pressed={routeId === route.id} onClick={() => setRouteId(routeId === route.id ? null : route.id)} className={`w-full py-3 text-left text-xs leading-relaxed transition-colors ${highlighted ? "text-slate-100" : "text-slate-500 hover:text-slate-200"}`}>
                  <span className={`mr-2 ${route.kind === "data" ? "text-[#48e1d6]" : route.kind === "power" ? "text-[#ffc978]" : "text-[#ff917f]"}`}>●</span>
                  <span className="font-semibold">{route.label}</span>
                  {(routeId === route.id || (!routeId && inWorkload)) && <span className="mt-1 block pl-4 text-slate-400">{route.detail}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}