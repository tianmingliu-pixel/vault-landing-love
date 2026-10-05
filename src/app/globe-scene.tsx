"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const radius = 1.65;

function position(latitude: number, longitude: number, distance = radius) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return new THREE.Vector3(
    distance * Math.cos(lat) * Math.sin(lon),
    distance * Math.sin(lat),
    distance * Math.cos(lat) * Math.cos(lon),
  );
}

export default function GlobeScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 7.4;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    globe.rotation.set(0.16, -0.48, -0.14);
    scene.add(globe);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius - 0.045, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x071b24, transparent: true, opacity: 0.96 }),
    );
    globe.add(core);

    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x248b91, wireframe: true, transparent: true, opacity: 0.12 }),
    );
    globe.add(wire);

    const dots: number[] = [];
    const dotColors: number[] = [];
    const teal = new THREE.Color(0x48d6ca);
    const ivory = new THREE.Color(0xe3f4dc);
    for (let index = 0; index < 1400; index++) {
      const vertical = 1 - (index / 1399) * 2;
      const circleRadius = Math.sqrt(1 - vertical * vertical);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      dots.push(radius * circleRadius * Math.cos(angle), radius * vertical, radius * circleRadius * Math.sin(angle));
      const color = index % 13 === 0 ? ivory : teal;
      dotColors.push(color.r, color.g, color.b);
    }
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dots, 3));
    dotGeometry.setAttribute("color", new THREE.Float32BufferAttribute(dotColors, 3));
    const dotMaterial = new THREE.PointsMaterial({ size: 0.024, vertexColors: true, transparent: true, opacity: 0.85 });
    globe.add(new THREE.Points(dotGeometry, dotMaterial));

    const hubs: [number, number][] = [
      [40, -74], [34, -118], [51, 0], [48, 13], [1, 104], [35, 139],
      [-34, 151], [19, 73], [-23, -43], [30, 31], [-1, 37], [37, 127],
    ];
    const routes: [number, number][] = [
      [0, 2], [0, 3], [0, 8], [1, 5], [1, 7], [2, 4],
      [2, 9], [3, 7], [4, 5], [4, 6], [5, 11], [7, 10], [8, 9],
    ];
    const curves: THREE.QuadraticBezierCurve3[] = [];
    const pulses: THREE.Mesh[] = [];
    const routeMaterials: THREE.LineBasicMaterial[] = [];
    const pulseGeometry = new THREE.SphereGeometry(0.035, 8, 8);
    const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xffbd82 });
    const hubGeometry = new THREE.SphereGeometry(0.038, 8, 8);
    const hubMaterial = new THREE.MeshBasicMaterial({ color: 0xffd69c });

    hubs.forEach(([latitude, longitude]) => {
      const hub = new THREE.Mesh(hubGeometry, hubMaterial);
      hub.position.copy(position(latitude, longitude, radius + 0.025));
      globe.add(hub);
    });

    routes.forEach(([from, to], index) => {
      const start = position(...hubs[from], radius + 0.02);
      const end = position(...hubs[to], radius + 0.02);
      const midpoint = start.clone().add(end).normalize().multiplyScalar(radius + 0.55 + index % 3 * 0.12);
      const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
      curves.push(curve);
      const material = new THREE.LineBasicMaterial({ color: index % 3 === 0 ? 0xffaa74 : 0x59ded3, transparent: true, opacity: 0.55 });
      routeMaterials.push(material);
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), material));
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      globe.add(pulse);
      pulses.push(pulse);
    });

    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 129 }, (_, index) => {
        const angle = (index / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * 2.16, Math.sin(angle) * 0.44, Math.sin(angle) * 1.85);
      }),
    );
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x53baab, transparent: true, opacity: 0.3 });
    const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
    orbit.rotation.z = -0.4;
    scene.add(orbit);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 320 ? 8.5 : 7.4;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let start = 0;
    const animate = (time: number) => {
      if (!start) start = time;
      const elapsed = (time - start) / 1000;
      globe.rotation.y = -0.48 + elapsed * 0.12;
      orbit.rotation.y = elapsed * 0.08;
      pulses.forEach((pulse, index) => {
        pulse.position.copy(curves[index].getPoint((elapsed * 0.23 + index / routes.length) % 1));
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    const updateMotion = () => {
      cancelAnimationFrame(frame);
      if (media.matches) {
        pulses.forEach((pulse, index) => pulse.position.copy(curves[index].getPoint(0.35)));
        renderer.render(scene, camera);
      } else {
        start = 0;
        frame = requestAnimationFrame(animate);
      }
    };
    media.addEventListener("change", updateMotion);
    updateMotion();

    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", updateMotion);
      observer.disconnect();
      globe.traverse((object) => {
        if (object instanceof THREE.Line) object.geometry.dispose();
      });
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      wire.geometry.dispose();
      (wire.material as THREE.Material).dispose();
      dotGeometry.dispose();
      dotMaterial.dispose();
      hubGeometry.dispose();
      hubMaterial.dispose();
      pulseGeometry.dispose();
      pulseMaterial.dispose();
      routeMaterials.forEach((material) => material.dispose());
      orbitGeometry.dispose();
      orbitMaterial.dispose();
      renderer.dispose();
      // Release the GL context now: browsers allow only ~16 at once and evict the oldest (the big scenes) when it runs out.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Animated global data network with connected nodes and traveling signals"
      className="h-44 min-w-0 w-full sm:h-80 lg:h-[440px]"
    />
  );
}