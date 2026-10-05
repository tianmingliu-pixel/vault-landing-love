"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { connections, services, type AccessLevel, type ConnectionId, type ServiceId } from "./llm-topology";

export type SecurityMode = "exposure" | "target";

const positions: Record<ServiceId, THREE.Vector3> = {
  user: new THREE.Vector3(-5.35, 0.65, 0.4),
  spa: new THREE.Vector3(-4.15, 0.75, 0.4),
  api: new THREE.Vector3(-2.65, 1.2, 0.4),
  sso: new THREE.Vector3(-2.65, 0.55, -1.8),
  postgres: new THREE.Vector3(-0.85, 0.62, -1.8),
  s3: new THREE.Vector3(-0.85, 0.62, 1.75),
  llm: new THREE.Vector3(0.45, 1.2, -2.25),
  rag: new THREE.Vector3(1.85, 0.62, 1.75),
  agent: new THREE.Vector3(1.85, 1.2, -2.1),
  hpc: new THREE.Vector3(3.7, 1.2, -2.05),
  external: new THREE.Vector3(5.1, 0.62, -1.8),
  notify: new THREE.Vector3(4.2, 0.62, 1.75),
};

const accessColors: Record<AccessLevel, number> = { public: 0xf19b77, auth: 0xf0bf80, operator: 0x76e6c8, manager: 0xd4bd83 };

export default function LlmRackScene({ mode, focus, connectionId, accessFilter, onInspect }: { mode: SecurityMode; focus: ServiceId | null; connectionId: ConnectionId | null; accessFilter: AccessLevel | "all"; onInspect: (id: ServiceId) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ mode, focus, connectionId, accessFilter });
  const inspectRef = useRef(onInspect);
  const renderRef = useRef<(() => void) | null>(null);
  const [labels, setLabels] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    selectionRef.current = { mode, focus, connectionId, accessFilter };
    renderRef.current?.();
  }, [mode, focus, connectionId, accessFilter]);

  useEffect(() => { inspectRef.current = onInspect; }, [onInspect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 50);
    camera.position.set(5.2, 7.2, 12.5);
    camera.lookAt(0, 1.2, 0);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 6.3),
      new THREE.MeshBasicMaterial({ color: 0x17352d, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.14;
    scene.add(floor);
    const grid = new THREE.GridHelper(13, 26, 0x648c78, 0x38564b);
    grid.position.y = -0.125;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    scene.add(grid);

    const isolation = new THREE.Mesh(
      new THREE.BoxGeometry(7.7, 3.65, 5.1),
      new THREE.MeshBasicMaterial({ color: 0x63bea1, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.BackSide }),
    );
    isolation.position.set(2, 1.68, 0);
    scene.add(isolation);
    const boundary = new THREE.LineSegments(
      new THREE.EdgesGeometry(isolation.geometry),
      new THREE.LineBasicMaterial({ color: 0x79bca4, transparent: true, opacity: 0.45 }),
    );
    boundary.position.copy(isolation.position);
    scene.add(boundary);

    const hitTargets: THREE.Mesh[] = [];

    const addRack = (id: ServiceId, color: number) => {
      const position = positions[id];
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.12, 2.55, 0.95),
        new THREE.MeshBasicMaterial({ color: 0x11231f, transparent: true, opacity: 0.85 }),
      );
      frame.position.set(position.x, 1.2, position.z);
      frame.userData.nodeId = id;
      hitTargets.push(frame);
      scene.add(frame);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(frame.geometry),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
      );
      edges.position.copy(frame.position);
      scene.add(edges);
      for (let index = 0; index < 7; index++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.84, 0.16, 0.08),
          new THREE.MeshBasicMaterial({ color: 0x28433b, transparent: true, opacity: 0.92 }),
        );
        blade.position.set(position.x, 0.31 + index * 0.285, position.z + 0.5);
        scene.add(blade);
        const status = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.035, 0.01),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }),
        );
        status.position.set(position.x + 0.28, blade.position.y, position.z + 0.55);
        scene.add(status);
      }
    };
    addRack("api", 0xf0bb83);
    addRack("llm", 0x79e3d0);
    addRack("agent", 0x81d8bb);
    addRack("hpc", 0xd5c28d);

    services.filter((service) => !["api", "llm", "agent", "hpc"].includes(service.id)).forEach((service) => {
      const geometry = new THREE.BoxGeometry(0.78, 0.38, 0.55);
      const color = service.id === "user" || service.id === "spa" ? 0xf19b77 : 0x80cdb3;
      const terminal = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 }));
      terminal.position.copy(positions[service.id]);
      terminal.userData.nodeId = service.id;
      hitTargets.push(terminal);
      scene.add(terminal);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
      edges.position.copy(terminal.position);
      scene.add(edges);
    });

    const paths = connections.map((connection, index) => {
      const start = positions[connection.from].clone();
      const end = positions[connection.to].clone();
      const middle = start.clone().add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.35 + index % 3 * 0.1, 0));
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      const material = new THREE.LineBasicMaterial({ color: accessColors[connection.access], transparent: true, opacity: 0.78 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)), material);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshBasicMaterial({ color: accessColors[connection.access] }));
      scene.add(line, pulse);
      return { connection, curve, material, pulse, offset: index / connections.length };
    });

    const render = (time = 0) => {
      const { mode: activeMode, focus: activeFocus, connectionId: activeConnection, accessFilter: activeFilter } = selectionRef.current;
      paths.forEach(({ connection, curve, material, pulse, offset }) => {
        const selected = activeConnection ? connection.id === activeConnection :
          (!activeFocus || connection.from === activeFocus || connection.to === activeFocus) &&
          (activeFilter === "all" || connection.access === activeFilter);
        const browserRisk = activeMode === "exposure" && connection.id === "spa-api";
        material.color.setHex(browserRisk ? 0xf19b77 : accessColors[connection.access]);
        material.opacity = selected ? 0.9 : 0.09;
        pulse.visible = selected;
        if (pulse.visible) pulse.position.copy(curve.getPoint((time * 0.00019 + offset) % 1));
      });
      renderer.render(scene, camera);
    };
    renderRef.current = () => render(performance.now());

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const halfHeight = width < 900 ? 5.1 : 4.1;
      const halfWidth = halfHeight * width / height;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      const projected: Record<string, { x: number; y: number }> = {};
      services.forEach(({ id }) => {
        const isRack = ["api", "llm", "agent", "hpc"].includes(id);
        const point = positions[id].clone().add(new THREE.Vector3(0, isRack ? 1.5 : 0.42, 0)).project(camera);
        projected[id] = { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
      });
      setLabels(projected);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitNode = (event: MouseEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(hitTargets, false)[0]?.object.userData.nodeId as ServiceId | undefined;
    };
    const onMove = (event: MouseEvent) => {
      const id = hitNode(event);
      renderer.domElement.style.cursor = id ? "pointer" : "default";
      renderer.domElement.title = id ? `Inspect ${services.find((service) => service.id === id)?.label}` : "";
    };
    const onClick = (event: MouseEvent) => {
      const id = hitNode(event);
      if (id) inspectRef.current(id);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("click", onClick);

    let frame = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animate = (time: number) => {
      render(time);
      frame = requestAnimationFrame(animate);
    };
    if (!media.matches) frame = requestAnimationFrame(animate);
    const changeMotion = () => {
      cancelAnimationFrame(frame);
      if (media.matches) render();
      else frame = requestAnimationFrame(animate);
    };
    media.addEventListener("change", changeMotion);

    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", changeMotion);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("click", onClick);
      renderRef.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments || object instanceof THREE.GridHelper) {
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

  return (
    <div className="relative h-[500px] w-full overflow-hidden sm:h-[540px] lg:h-[600px]" role="group" aria-label="Conceptual enterprise service topology from user and React SPA through FastAPI, storage, LLM, agents and managed compute">
      <div ref={containerRef} className="absolute inset-0" />
      {services.map(({ id, label }) => labels[id] && (
        <button key={id} type="button" onClick={() => onInspect(id)} aria-label={`Inspect ${label}`} className="absolute z-10 -translate-x-1/2 whitespace-nowrap border-b border-[#80d5ab] bg-[#0d1a16]/90 px-1 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-[#dcf7e8] hover:bg-[#275541] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 sm:text-[10px]" style={{ left: labels[id].x, top: labels[id].y }}>{label}</button>
      ))}
    </div>
  );
}