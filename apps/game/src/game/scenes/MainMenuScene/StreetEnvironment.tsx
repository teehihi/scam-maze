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

  // Extract, right-side-up, and scale parked cars
  const extractedCars = useMemo(() => {
    carsGltf.scene.updateMatrixWorld(true);

    // Distinct vehicle models from the pack:
    // Object_4: Sedan (blue/red)
    // Object_14: Delivery van / utility truck
    // Object_9: Compact city car
    // Object_7: Station wagon / taxi
    const targetNames = ["Object_4", "Object_14", "Object_9", "Object_7"];
    const cars: {
      geometry: THREE.BufferGeometry;
      material: THREE.Material | THREE.Material[];
      height: number;
    }[] = [];

    for (const name of targetNames) {
      const carMesh = carsGltf.scene.getObjectByName(name) as THREE.Mesh | undefined;
      if (carMesh && carMesh.isMesh) {
        const geo = carMesh.geometry.clone();
        // Crucial: apply world transformation so Y is UP and orientation is right-side up
        geo.applyMatrix4(carMesh.matrixWorld);
        geo.center(); // Center geometry around local (0, 0, 0)
        geo.computeVertexNormals();
        geo.computeBoundingBox();

        const bbox = geo.boundingBox!;
        const height = bbox.max.y - bbox.min.y;

        cars.push({
          geometry: geo,
          material: carMesh.material,
          height,
        });
      }
    }

    return cars;
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

      {/* Parked Cars along curbs (Right-side up, wheels sitting directly on the asphalt pavement) */}
      {STREET_CONFIG.parkedCars.map((slot, index) => {
        const carData = extractedCars[slot.carIndex % (extractedCars.length || 1)];
        if (!carData) return null;

        const posX = slot.position[0];
        const posY = slot.position[1] + carData.height / 2;
        const posZ = slot.position[2];

        return (
          <group
            key={`car-${index}`}
            position={[posX, posY, posZ]}
            rotation={[0, slot.rotationY, 0]}
          >
            <mesh
              geometry={carData.geometry}
              material={carData.material}
              castShadow={shadows}
              receiveShadow={shadows}
            />
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
