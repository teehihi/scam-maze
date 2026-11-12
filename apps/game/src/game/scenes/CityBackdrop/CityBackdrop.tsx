/**
 * Low-poly city that fills the empty ground around the walkable street: buildings from Low Poly
 * City, Low Poly City Game-Ready and Low Poly City Asset Pack, and a car park and a few parked
 * cars from Low Poly Cars Pack. Decoration only: it has no collision and no interaction, and a
 * failed download leaves the street as it was.
 */

import React, { Component, Suspense, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { CITY_CARS_GLB, CITY_DISTRICT_GLB } from "../../../config/assetPaths";
import {
  layoutBuildings,
  layoutCars,
  type PieceFootprint,
  type Placement,
} from "./cityLayout";

const configureLoader = (loader: GLTFLoader): void => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/** Pieces whose name starts with one of these prefixes are buildings; the rest are not placed. */
const BUILDING_PREFIXES = ["gr_", "lp_building_", "ap_"] as const;

/** Measures every top-level piece of a loaded pack. */
function measurePieces(root: THREE.Object3D, prefixes: readonly string[]): PieceFootprint[] {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const pieces: PieceFootprint[] = [];
  for (const child of root.children) {
    if (!prefixes.some((prefix) => child.name.startsWith(prefix))) continue;
    box.setFromObject(child);
    if (box.isEmpty()) continue;
    box.getSize(size);
    pieces.push({ name: child.name, w: size.x, h: size.y, d: size.z });
  }
  return pieces;
}

/** Soft, matte look that matches the street's lighting; done once because materials are shared. */
function calibrateMaterials(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) continue;
      standard.metalness = Math.min(standard.metalness, 0.08);
      standard.roughness = Math.max(standard.roughness, 0.7);
    }
  });
}

/** Builds one frozen group per placement, sharing geometry and materials with the template. */
function instantiate(
  root: THREE.Object3D,
  placements: readonly { placement: Placement }[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = "CityPieces";
  for (const { placement } of placements) {
    const template = root.getObjectByName(placement.name);
    if (!template) continue;
    const holder = new THREE.Group();
    holder.position.set(placement.x, placement.y, placement.z);
    holder.rotation.y = placement.yaw;
    holder.add(template.clone(true));
    group.add(holder);
  }
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    object.matrixAutoUpdate = false;
  });
  return group;
}

const Buildings: React.FC = () => {
  const gltf = useLoader(GLTFLoader, CITY_DISTRICT_GLB, configureLoader);
  const group = useMemo(() => {
    calibrateMaterials(gltf.scene);
    const placements = layoutBuildings(measurePieces(gltf.scene, BUILDING_PREFIXES));
    return instantiate(gltf.scene, placements);
  }, [gltf]);
  return <primitive object={group} />;
};

const Cars: React.FC = () => {
  const gltf = useLoader(GLTFLoader, CITY_CARS_GLB, configureLoader);
  const group = useMemo(() => {
    calibrateMaterials(gltf.scene);
    const placements = layoutCars(measurePieces(gltf.scene, ["car_"]));
    return instantiate(gltf.scene, placements);
  }, [gltf]);
  return <primitive object={group} />;
};

/** The backdrop is optional: a load error is logged once and nothing is drawn. */
class OptionalScene extends Component<{ children: React.ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.warn(`Optional scene "${this.props.label}" failed to load; continuing without it.`, error);
  }

  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export const CityBackdrop: React.FC = () => (
  <group name="CityBackdrop">
    <OptionalScene label="city buildings">
      <Suspense fallback={null}>
        <Buildings />
      </Suspense>
    </OptionalScene>
    <OptionalScene label="city cars">
      <Suspense fallback={null}>
        <Cars />
      </Suspense>
    </OptionalScene>
  </group>
);
