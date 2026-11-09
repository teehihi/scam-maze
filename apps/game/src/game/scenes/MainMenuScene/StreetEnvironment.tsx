import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STREET_CONFIG, type TreeInstance } from "./StreetComposition";

const CITY_MODEL_PATH = "/assets/3d/environments/low_poly_city_asset_pack.glb";
const CARS_MODEL_PATH = "/assets/3d/vehicles/low_poly_cars_pack.glb";

// Preload assets for instant rendering
useGLTF.preload(CITY_MODEL_PATH);
useGLTF.preload(CARS_MODEL_PATH);

interface StreetEnvironmentProps {
  shadows?: boolean;
}

export const StreetEnvironment: React.FC<StreetEnvironmentProps> = ({ shadows = true }) => {
  const cityGltf = useGLTF(CITY_MODEL_PATH);
  const carsGltf = useGLTF(CARS_MODEL_PATH);

  // Prepare primary city block
  const primaryCityScene = useMemo(() => {
    const cloned = cityGltf.scene.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        // Low-poly materials should have soft roughness
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughness = 0.85;
          mat.metalness = 0.1;
        }
      }
    });
    return cloned;
  }, [cityGltf, shadows]);

  // Prepare opposite side of the street (buildings mirroring along the other sidewalk)
  const oppositeCityScene = useMemo(() => {
    const cloned = cityGltf.scene.clone(true);
    cloned.traverse((child) => {
      // Hide the hospital & road in opposite clone so we only duplicate the residential building facade
      if (child.name.includes("Hospital") || child.name.includes("Road")) {
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

  // Extract and center distinctive parked cars
  const extractedCars = useMemo(() => {
    const cars: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
    const targetMeshNames = ["Object_4", "Object_9", "Object_14", "Object_7", "Object_12"];

    carsGltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && targetMeshNames.includes(child.name)) {
        const mesh = child as THREE.Mesh;
        const centeredGeo = mesh.geometry.clone();
        centeredGeo.center(); // Center geometry around its local origin
        centeredGeo.computeVertexNormals();

        // Standardize material
        let mat = mesh.material;
        if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          stdMat.roughness = 0.6;
          stdMat.metalness = 0.2;
        }

        cars.push({
          geometry: centeredGeo,
          material: mat,
        });
      }
    });

    return cars;
  }, [carsGltf]);

  return (
    <group name="StreetEnvironment">
      {/* Primary City Block (Buildings, Road, Storefronts, Streetlights) */}
      <primitive object={primaryCityScene} position={[0, 0, 0]} />

      {/* Opposite Facade (Rotated across the street at Z ≈ 23 to create a two-sided avenue) */}
      <primitive
        object={oppositeCityScene}
        position={[8, 0, 24]}
        rotation={[0, Math.PI, 0]}
      />

      {/* Parked Cars along Curbs */}
      {STREET_CONFIG.parkedCars.map((slot, index) => {
        const carData = extractedCars[index % (extractedCars.length || 1)];
        if (!carData) return null;

        return (
          <group
            key={`car-${index}`}
            position={slot.position}
            rotation={[0, slot.rotationY, 0]}
            scale={[slot.scale, slot.scale, slot.scale]}
          >
            <mesh
              geometry={carData.geometry}
              material={carData.material}
              castShadow={shadows}
              receiveShadow={shadows}
              position={[0, 0.7, 0]}
            />
          </group>
        );
      })}

      {/* Stylized Low-Poly Sidewalk Trees */}
      {STREET_CONFIG.trees.map((tree, index) => (
        <LowPolyTree key={`tree-${index}`} config={tree} castShadow={shadows} />
      ))}

      {/* Ground Sub-Plane (Fills horizon under road and buildings) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        receiveShadow={shadows}
      >
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#1a1827" roughness={0.95} metalness={0.05} />
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
      <mesh position={[0, 0.9, 0]} castShadow={castShadow} receiveShadow={castShadow}>
        <cylinderGeometry args={[0.14, 0.22, 1.8, 6]} />
        <meshStandardMaterial color="#544031" roughness={0.9} />
      </mesh>

      {/* Tree Foliage (Stylized low-poly shape) */}
      {config.type === "cone" && (
        <mesh position={[0, 2.4, 0]} castShadow={castShadow} receiveShadow={castShadow}>
          <coneGeometry args={[1.0, 2.2, 7]} />
          <meshStandardMaterial color={config.color} roughness={0.8} />
        </mesh>
      )}

      {config.type === "dodeca" && (
        <group position={[0, 2.2, 0]}>
          <mesh castShadow={castShadow} receiveShadow={castShadow}>
            <dodecahedronGeometry args={[0.95, 0]} />
            <meshStandardMaterial color={config.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.8, 0]} scale={0.7} castShadow={castShadow}>
            <dodecahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial color={config.color} roughness={0.8} />
          </mesh>
        </group>
      )}

      {config.type === "sphere" && (
        <group position={[0, 2.3, 0]}>
          <mesh castShadow={castShadow} receiveShadow={castShadow}>
            <icosahedronGeometry args={[1.0, 1]} />
            <meshStandardMaterial color={config.color} roughness={0.8} flatShading />
          </mesh>
        </group>
      )}
    </group>
  );
};
