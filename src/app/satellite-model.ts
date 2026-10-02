import * as THREE from "three";
import type { FunctionKind } from "./satellite-function";

/* Small, schematic 3D spacecraft used to mark a satellite on the globes (not to scale, not a real model of any craft).
   Local axes: +Z = direction of travel, +Y = away from Earth (zenith), X = across track (where the solar wings point). */

export type SatMarker = { kind: FunctionKind; color: string; locate: (date: Date) => { lat: number; lon: number; altKm: number } | null };

const bodyMaterial = () => new THREE.MeshLambertMaterial({ color: 0xd8dee9, emissive: 0x1e293b });
const panelMaterial = () => new THREE.MeshLambertMaterial({ color: 0x1d4ed8, emissive: 0x0b1e5b, side: THREE.DoubleSide });
const goldMaterial = () => new THREE.MeshLambertMaterial({ color: 0xf2b954, emissive: 0x3b2a08 });

function wing(width: number, depth: number, offset: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), panelMaterial());
  mesh.position.x = offset;
  return mesh;
}

/** Builds a unit-sized model (about 1 unit across); scale it to taste. */
export function buildSatelliteModel(kind: FunctionKind, accent: string) {
  const group = new THREE.Group();
  const add = (mesh: THREE.Object3D) => (group.add(mesh), mesh);
  switch (kind) {
    case "starlink":
    case "kuiper": {
      // flat bus, one long wing on a short boom
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.2), bodyMaterial()));
      add(wing(0.62, 0.22, 0.52));
      break;
    }
    case "station": {
      // truss with four pairs of arrays and a pressurised core
      add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.04), bodyMaterial()));
      for (const x of [-0.45, -0.3, 0.3, 0.45]) {
        const a = wing(0.12, 0.42, x);
        a.position.z = 0.24;
        add(a);
        const b = wing(0.12, 0.42, x);
        b.position.z = -0.24;
        add(b);
      }
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16), bodyMaterial())).rotation.x = Math.PI / 2;
      break;
    }
    case "science": {
      // CubeSat with two deployable panels
      add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.34), goldMaterial()));
      add(wing(0.3, 0.3, 0.25));
      add(wing(0.3, 0.3, -0.25));
      break;
    }
    case "weather":
    case "eo": {
      // bus with one wing and an Earth-pointing instrument
      add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.36), goldMaterial()));
      add(wing(0.6, 0.26, 0.48));
      const lens = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), bodyMaterial()));
      lens.position.y = -0.21;
      break;
    }
    case "iridium": {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 3), bodyMaterial())).rotation.x = Math.PI / 2;
      add(wing(0.36, 0.2, 0.38));
      add(wing(0.36, 0.2, -0.38));
      break;
    }
    default: {
      // GEO / MEO / navigation / other LEO: box bus, two wings, reflectors
      add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.3), goldMaterial()));
      add(wing(0.5, 0.22, 0.42));
      add(wing(0.5, 0.22, -0.42));
      for (const z of [0.2, -0.2]) {
        const dish = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), bodyMaterial()));
        dish.position.set(0, -0.12, z);
        dish.rotation.x = Math.PI;
      }
    }
  }
  // Coloured halo so the craft stays findable when tiny.
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  return group;
}

/** Lights the models (the globes themselves use unlit materials, so this only affects the spacecraft). */
export function addModelLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(5, 3, 4);
  scene.add(sun);
}

/** Places and orients a model at `position`, travelling toward `ahead`, with its top facing away from Earth. */
export function poseModel(model: THREE.Object3D, position: THREE.Vector3, ahead: THREE.Vector3) {
  model.position.copy(position);
  model.up.copy(position).normalize();
  model.lookAt(ahead);
}

export function disposeModel(model: THREE.Object3D) {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
}
