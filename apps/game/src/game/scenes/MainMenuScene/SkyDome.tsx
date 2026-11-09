import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const SKY_MODEL_PATH = "/assets/3d/environments/sky.glb";
useGLTF.preload(SKY_MODEL_PATH);

export const SkyDome: React.FC = () => {
  const skyGltf = useGLTF(SKY_MODEL_PATH);
  const skyRef = useRef<THREE.Group>(null);

  const skyObject = useMemo(() => {
    // Find the Sphere_8 sky dome node inside sky.glb
    const sphereNode = skyGltf.scene.getObjectByName("Sphere_8");
    if (!sphereNode) {
      // Fallback: search for Object_20 or any mesh in the scene
      const mesh = skyGltf.scene.getObjectByName("Object_20") as THREE.Mesh | undefined;
      if (mesh && mesh.isMesh) {
        const cloned = mesh.clone();
        if (cloned.material) {
          const mat = (cloned.material as THREE.MeshStandardMaterial).clone();
          mat.side = THREE.BackSide;
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          cloned.material = mat;
        }
        return cloned;
      }
      return null;
    }

    // Clone Sphere_8 and prepare its materials
    const cloned = sphereNode.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const mat = m as THREE.MeshStandardMaterial;
              mat.side = THREE.BackSide;
              mat.roughness = 0.95;
              mat.metalness = 0.0;
              if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
              if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            }
          });
        }
      }
    });

    return cloned;
  }, [skyGltf]);

  // Gentle atmospheric cloud drift
  useFrame((_, delta) => {
    if (skyRef.current) {
      skyRef.current.rotation.y += delta * 0.004;
    }
  });

  if (!skyObject) return null;

  return (
    <group ref={skyRef} position={[0, -10, -85]} scale={[6.8, 6.8, 6.8]}>
      <primitive object={skyObject} />
    </group>
  );
};
