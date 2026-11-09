import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const CITY_MODEL_PATH = "/assets/3d/environments/MenuBG.glb";

// Preload Unity-authored street scene
useGLTF.preload(CITY_MODEL_PATH);

interface StreetEnvironmentProps {
  shadows?: boolean;
}

interface AnimatedObject {
  object: THREE.Object3D;
  basePosY: number;
  baseRotY: number;
  baseRotZ: number;
  phaseOffset: number;
  speed: number;
}

export const StreetEnvironment: React.FC<StreetEnvironmentProps> = ({ shadows = true }) => {
  const cityGltf = useGLTF(CITY_MODEL_PATH);
  const npcsRef = useRef<AnimatedObject[]>([]);
  const foliageRef = useRef<AnimatedObject[]>([]);

  // Prepare the Unity-authored Vietnamese street environment with PBR calibration
  const primaryCityScene = useMemo(() => {
    const cloned = cityGltf.scene.clone(true);
    const npcs: AnimatedObject[] = [];
    const foliage: AnimatedObject[] = [];

    let npcIndex = 0;
    let foliageIndex = 0;

    cloned.traverse((child) => {
      const name = child.name || "";
      const lowerName = name.toLowerCase();

      // Remove / hide the foreground character standing right in front of camera
      if (
        name.includes("19_6_2025") ||
        lowerName.includes("ai guy")
      ) {
        child.visible = false;
        return;
      }

      // Detect other human NPC models authored in Unity scene (sidewalk pedestrians)
      if (
        name.includes("rp_mei_posed_001") ||
        name.includes("20261110000447_177df9df")
      ) {
        npcs.push({
          object: child,
          basePosY: child.position.y,
          baseRotY: child.rotation.y,
          baseRotZ: child.rotation.z,
          phaseOffset: npcIndex * 1.5,
          speed: 1.4 + (npcIndex % 3) * 0.2,
        });
        npcIndex++;
      }

      // Detect tropical trees & plants for subtle wind sway
      if (
        lowerName.includes("tree_banana") ||
        lowerName.includes("tree_big") ||
        lowerName.includes("cỏ")
      ) {
        foliage.push({
          object: child,
          basePosY: child.position.y,
          baseRotY: child.rotation.y,
          baseRotZ: child.rotation.z,
          phaseOffset: foliageIndex * 0.9,
          speed: 1.0 + (foliageIndex % 2) * 0.3,
        });
        foliageIndex++;
      }

      // Configure meshes & materials
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const isSkyMesh = lowerName.includes("sky");

        if (isSkyMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        } else {
          mesh.castShadow = shadows;
          mesh.receiveShadow = shadows;
        }

        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const mat = m as THREE.MeshStandardMaterial;

              // Fix asphalt road glowing/chói issue: disable accidental full-white emission exported from Unity
              if (mat.name === "streets") {
                mat.emissive = new THREE.Color(0, 0, 0);
                mat.emissiveIntensity = 0;
                mat.roughness = 0.52;
                mat.metalness = 0.05;
              } else if (mat.name.includes("Mat_Light_Emission") || mat.name.includes("Emission")) {
                // Keep warm exterior wall fixtures glowing softly
                mat.emissive = new THREE.Color("#ffe082");
                mat.emissiveIntensity = 1.2;
              } else if (mat.name === "material") {
                // Sky dome material (retain soft atmospheric self-illumination)
                mat.emissiveIntensity = 0.8;
              } else {
                // Disable unwanted glare emission on other generic props
                if (mat.emissiveIntensity > 0 && !mat.name.includes("Light")) {
                  mat.emissiveIntensity = 0;
                }
              }

              // Prevent unmapped materials from appearing pitch-black due to over-metallic export
              if (mat.metalness > 0.25 && !mat.metalnessMap) {
                mat.metalness = 0.08;
              }
              mat.roughness = Math.max(mat.roughness, 0.4);

              // Normalize texture color spaces for accurate, vibrant rendering
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
              }
              if (mat.emissiveMap) {
                mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
              }
            }
          });
        }
      }
    });

    npcsRef.current = npcs;
    foliageRef.current = foliage;
    return cloned;
  }, [cityGltf, shadows]);

  // Subtle living motions: human NPC breathing and tropical breeze on trees
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Procedural NPC breathing & micro-idle adjustments
    if (npcsRef.current.length > 0) {
      npcsRef.current.forEach((npc) => {
        const breath = Math.sin(time * npc.speed + npc.phaseOffset) * 0.0035;
        const subtleTurn = Math.sin(time * 0.6 + npc.phaseOffset) * 0.006;
        npc.object.position.y = npc.basePosY + breath;
        npc.object.rotation.y = npc.baseRotY + subtleTurn;
      });
    }

    // Gentle tropical wind rustle on street trees
    if (foliageRef.current.length > 0) {
      foliageRef.current.forEach((leaf) => {
        const sway = Math.sin(time * leaf.speed + leaf.phaseOffset) * 0.012;
        leaf.object.rotation.z = leaf.baseRotZ + sway;
      });
    }
  });

  return (
    <group name="StreetEnvironment">
      {/* Unity-Authored Vietnamese Urban Street Scene */}
      <primitive
        object={primaryCityScene}
        scale={[1, 1, 1]}
        position={[0, 0, 0]}
      />
    </group>
  );
};
