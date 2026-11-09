import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STREET_CONFIG, type TreeInstance } from "./StreetComposition";

const CITY_MODEL_PATH = "/assets/3d/environments/low_poly_city_asset_pack.glb";
const CARS_MODEL_PATH = "/assets/3d/vehicles/low_poly_cars_pack.glb";

// Preload models for instant display
useGLTF.preload(CITY_MODEL_PATH);
useGLTF.preload(CARS_MODEL_PATH);

interface StreetEnvironmentProps {
  shadows?: boolean;
}

// Helper to extract a sub-geometry from a mesh where triangle centroids fall within a bounding box
function extractBoxSubGeometry(
  sourceGeo: THREE.BufferGeometry,
  minBox: [number, number, number],
  maxBox: [number, number, number]
): THREE.BufferGeometry | null {
  const pos = sourceGeo.attributes.position;
  const norm = sourceGeo.attributes.normal;
  const uv = sourceGeo.attributes.uv;
  const index = sourceGeo.index;

  if (!pos) return null;

  const newPos: number[] = [];
  const newNorm: number[] = [];
  const newUv: number[] = [];
  const newIndex: number[] = [];
  const vertMap = new Map<number, number>();

  const numTriangles = index ? index.count / 3 : pos.count / 3;

  for (let t = 0; t < numTriangles; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
    const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
    const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);

    const midX = (x0 + x1 + x2) / 3;
    const midY = (y0 + y1 + y2) / 3;
    const midZ = (z0 + z1 + z2) / 3;

    if (
      midX >= minBox[0] && midX <= maxBox[0] &&
      midY >= minBox[1] && midY <= maxBox[1] &&
      midZ >= minBox[2] && midZ <= maxBox[2]
    ) {
      for (const idx of [i0, i1, i2]) {
        let newIdx = vertMap.get(idx);
        if (newIdx === undefined) {
          newIdx = newPos.length / 3;
          vertMap.set(idx, newIdx);
          newPos.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
          if (norm) newNorm.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
          if (uv) newUv.push(uv.getX(idx), uv.getY(idx));
        }
        newIndex.push(newIdx);
      }
    }
  }

  if (newIndex.length === 0) return null;

  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute("position", new THREE.Float32BufferAttribute(newPos, 3));
  if (newNorm.length > 0) newGeo.setAttribute("normal", new THREE.Float32BufferAttribute(newNorm, 3));
  if (newUv.length > 0) newGeo.setAttribute("uv", new THREE.Float32BufferAttribute(newUv, 2));
  newGeo.setIndex(newIndex);
  return newGeo;
}

interface CarPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

interface CompleteCar {
  name: string;
  parts: CarPart[];
}

export const StreetEnvironment: React.FC<StreetEnvironmentProps> = ({ shadows = true }) => {
  const cityGltf = useGLTF(CITY_MODEL_PATH);
  const carsGltf = useGLTF(CARS_MODEL_PATH);

  // Prepare primary city block at TRUE scale (x100 to compensate for FBX cm-to-m conversion)
  const primaryCityScene = useMemo(() => {
    const cloned = cityGltf.scene.clone(true);
    cloned.traverse((child) => {
      // Hide untextured authoring mannequin
      if (child.name.includes("Person_Scale")) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.75;
          mat.metalness = 0.05;
        }
      }
    });
    return cloned;
  }, [cityGltf, shadows]);

  // Prepare south-side buildings (opposite facade lining the other side of the road)
  const southSideBuildings = useMemo(() => {
    const cloned = cityGltf.scene.clone(true);
    cloned.traverse((child) => {
      // Hide hospital, road, and props from duplicate clone so we only duplicate the residential building facade
      if (
        child.name.includes("Hospital") ||
        child.name.includes("Road") ||
        child.name.includes("Bench") ||
        child.name.includes("StreetLight") ||
        child.name.includes("Person_Scale")
      ) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
      }
    });
    return cloned;
  }, [cityGltf, shadows]);

  // Extract complete vehicle models (body + wheels + glass) with proper upright orientation and vivid materials
  const extractedCars = useMemo<CompleteCar[]>(() => {
    carsGltf.scene.updateMatrixWorld(true);

    const wheelsMesh = carsGltf.scene.getObjectByName("Object_58") as THREE.Mesh | undefined;
    const glassMesh = carsGltf.scene.getObjectByName("Object_57") as THREE.Mesh | undefined;

    // Common wheels material (non-metallic rubber & hubcaps, no black void artifact)
    let wheelsMat: THREE.MeshStandardMaterial | null = null;
    if (wheelsMesh && (wheelsMesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      wheelsMat = (wheelsMesh.material as THREE.MeshStandardMaterial).clone();
      wheelsMat.metalness = 0.05;
      wheelsMat.roughness = 0.75;
      wheelsMat.flatShading = true;
      wheelsMat.side = THREE.DoubleSide;
      if (wheelsMat.map) wheelsMat.map.colorSpace = THREE.SRGBColorSpace;
    }

    // Common tinted glass material for sedan windshields/windows
    const glassMat = new THREE.MeshStandardMaterial({
      color: "#6b92a8",
      metalness: 0.1,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    // 6 distinct vehicle types authored across the pack
    const vehicleTargets = [
      { name: "Red Sedan", body: "Object_4", cx: 5.01, cy: 2.59, cz: 1.22, hx: 2.5, hy: 1.15, hz: 1.2 },
      { name: "Yellow Taxi", body: "Object_7", cx: 5.01, cy: -5.28, cz: 1.22, hx: 2.5, hy: 1.15, hz: 1.2 },
      { name: "Blue Hatchback", body: "Object_9", cx: -2.71, cy: -7.11, cz: 1.51, hx: 2.3, hy: 1.0, hz: 1.2 },
      { name: "White Delivery Van", body: "Object_14", cx: -11.06, cy: 4.79, cz: 1.51, hx: 3.1, hy: 1.4, hz: 1.4 },
      { name: "Yellow Cab Van", body: "Object_17", cx: -11.06, cy: -4.99, cz: 1.51, hx: 3.1, hy: 1.4, hz: 1.4 },
      { name: "Silver Pickup", body: "Object_34", cx: 14.62, cy: -1.55, cz: 1.37, hx: 2.2, hy: 1.4, hz: 1.2 },
    ];

    const result: CompleteCar[] = [];

    for (const vt of vehicleTargets) {
      const bodyMesh = carsGltf.scene.getObjectByName(vt.body) as THREE.Mesh | undefined;
      if (!bodyMesh || !bodyMesh.isMesh) continue;

      const minBox: [number, number, number] = [vt.cx - vt.hx, vt.cy - vt.hy, vt.cz - vt.hz];
      const maxBox: [number, number, number] = [vt.cx + vt.hx, vt.cy + vt.hy, vt.cz + vt.hz];

      // 1. Clone body geometry
      const bodyGeo = bodyMesh.geometry.clone();

      // 2. Extract corresponding wheels for this car
      const carWheelsGeo = wheelsMesh ? extractBoxSubGeometry(wheelsMesh.geometry, minBox, maxBox) : null;

      // 3. Extract glass windows if present for this car
      const carGlassGeo = glassMesh ? extractBoxSubGeometry(glassMesh.geometry, minBox, maxBox) : null;

      // 4. Rotate by -90 deg on X so that Z (original up) becomes Y (Three.js up)
      bodyGeo.rotateX(-Math.PI / 2);
      carWheelsGeo?.rotateX(-Math.PI / 2);
      carGlassGeo?.rotateX(-Math.PI / 2);

      // 5. Calculate bounding box of the complete vehicle to align wheels flush to Y = 0
      const combinedBox = new THREE.Box3();
      bodyGeo.computeBoundingBox();
      if (bodyGeo.boundingBox) combinedBox.union(bodyGeo.boundingBox);
      if (carWheelsGeo) {
        carWheelsGeo.computeBoundingBox();
        if (carWheelsGeo.boundingBox) combinedBox.union(carWheelsGeo.boundingBox);
      }
      if (carGlassGeo) {
        carGlassGeo.computeBoundingBox();
        if (carGlassGeo.boundingBox) combinedBox.union(carGlassGeo.boundingBox);
      }

      // 6. Normalize geometry so horizontal center is (0, 0) and bottom of tires is at Y = 0
      const center = new THREE.Vector3();
      combinedBox.getCenter(center);
      const minY = combinedBox.min.y;

      const offX = -center.x;
      const offY = -minY;
      const offZ = -center.z;

      bodyGeo.translate(offX, offY, offZ);
      bodyGeo.computeVertexNormals();

      if (carWheelsGeo) {
        carWheelsGeo.translate(offX, offY, offZ);
        carWheelsGeo.computeVertexNormals();
      }
      if (carGlassGeo) {
        carGlassGeo.translate(offX, offY, offZ);
        carGlassGeo.computeVertexNormals();
      }

      // 7. Fix body material (low metalness reveals vibrant painted livery, no pitch-black bug)
      const bodyMat = (bodyMesh.material as THREE.MeshStandardMaterial).clone();
      bodyMat.metalness = 0.05;
      bodyMat.roughness = 0.45;
      bodyMat.flatShading = true;
      bodyMat.side = THREE.DoubleSide;
      if (bodyMat.map) bodyMat.map.colorSpace = THREE.SRGBColorSpace;

      const parts: CarPart[] = [{ geometry: bodyGeo, material: bodyMat }];
      if (carWheelsGeo && wheelsMat) {
        parts.push({ geometry: carWheelsGeo, material: wheelsMat });
      }
      if (carGlassGeo) {
        parts.push({ geometry: carGlassGeo, material: glassMat });
      }

      result.push({
        name: vt.name,
        parts,
      });
    }

    return result;
  }, [carsGltf]);

  return (
    <group name="StreetEnvironment">
      {/* Primary City Block (Scaled 100x to full architectural meter scale) */}
      <primitive
        object={primaryCityScene}
        scale={[100, 100, 100]}
        position={[0, 0, 0]}
      />

      {/* Opposite Facade (Rotated across the street at Z = +24 to create a complete two-sided street) */}
      <primitive
        object={southSideBuildings}
        scale={[100, 100, 100]}
        position={[0, 0, 24]}
        rotation={[0, Math.PI, 0]}
      />

      {/* Parked Cars along curbs (Complete bodies + wheels, upright on road surface at Y = 0.32m) */}
      {STREET_CONFIG.parkedCars.map((slot, index) => {
        const car = extractedCars[slot.carIndex % (extractedCars.length || 1)];
        if (!car) return null;

        return (
          <group
            key={`parked-car-${index}`}
            position={slot.position}
            rotation={[0, slot.rotationY, 0]}
          >
            {car.parts.map((part, partIdx) => (
              <mesh
                key={`car-part-${partIdx}`}
                geometry={part.geometry}
                material={part.material}
                castShadow={shadows}
                receiveShadow={shadows}
              />
            ))}
          </group>
        );
      })}

      {/* Stylized Low-Poly Sidewalk Trees */}
      {STREET_CONFIG.trees.map((tree, index) => (
        <LowPolyTree key={`tree-${index}`} config={tree} castShadow={shadows} />
      ))}

      {/* Surrounding Ground Plane (Covers distant horizon under road & buildings) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.25, 0]}
        receiveShadow={shadows}
      >
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#4a5242" roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  );
};

interface LowPolyTreeProps {
  config: TreeInstance;
  castShadow?: boolean;
}

const LowPolyTree: React.FC<LowPolyTreeProps> = ({ config, castShadow = true }) => {
  const [posX, posY, posZ] = config.position;

  return (
    <group
      position={[posX, posY, posZ]}
      scale={config.scale}
      rotation={[0, config.rotationY, 0]}
    >
      {/* Tree Trunk */}
      <mesh position={[0, 1.1, 0]} castShadow={castShadow} receiveShadow={castShadow}>
        <cylinderGeometry args={[0.16, 0.24, 2.2, 6]} />
        <meshStandardMaterial color="#5c4533" roughness={0.9} />
      </mesh>

      {/* Tree Foliage */}
      {config.type === "cone" && (
        <mesh position={[0, 2.8, 0]} castShadow={castShadow} receiveShadow={castShadow}>
          <coneGeometry args={[1.2, 2.6, 7]} />
          <meshStandardMaterial color={config.color} roughness={0.8} />
        </mesh>
      )}

      {config.type === "dodeca" && (
        <group position={[0, 2.6, 0]}>
          <mesh castShadow={castShadow} receiveShadow={castShadow}>
            <dodecahedronGeometry args={[1.1, 0]} />
            <meshStandardMaterial color={config.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.9, 0]} scale={0.7} castShadow={castShadow}>
            <dodecahedronGeometry args={[0.9, 0]} />
            <meshStandardMaterial color={config.color} roughness={0.8} />
          </mesh>
        </group>
      )}

      {config.type === "sphere" && (
        <group position={[0, 2.6, 0]}>
          <mesh castShadow={castShadow} receiveShadow={castShadow}>
            <icosahedronGeometry args={[1.15, 1]} />
            <meshStandardMaterial color={config.color} roughness={0.8} flatShading />
          </mesh>
        </group>
      )}
    </group>
  );
};
