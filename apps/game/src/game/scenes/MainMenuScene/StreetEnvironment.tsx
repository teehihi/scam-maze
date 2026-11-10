import React, { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Production optimized 3D environment (20.5 MB, Meshopt compressed, WebP textures)
const CITY_MODEL_PATH = "/assets/3d/optimized/MenuBG.optimized.glb";

// Preload production-ready optimized street scene
useGLTF.preload(CITY_MODEL_PATH);

interface StreetEnvironmentProps {
  shadows?: boolean;
  onReady?: () => void;
}

interface AnimatedPedestrian {
  object: THREE.Object3D;
  basePosY: number;
  baseRotY: number;
  baseRotZ: number;
  phaseOffset: number;
  speed: number;
}

interface FoliageAnimSystem {
  treeBig?: {
    object: THREE.Object3D;
    baseRot: THREE.Euler;
  };
  leafCanopy?: {
    object: THREE.Object3D;
    baseRot: THREE.Euler;
  };
  bananaTree?: {
    object: THREE.Object3D;
    baseRot: THREE.Euler;
  };
  grassList: Array<{
    object: THREE.Object3D;
    baseRotZ: number;
    phaseOffset: number;
  }>;
}

export const StreetEnvironment: React.FC<StreetEnvironmentProps> = ({
  shadows = false,
  onReady,
}) => {
  const { gl, camera } = useThree();
  const [isCompiled, setIsCompiled] = useState(false);
  const cityGltf = useGLTF(CITY_MODEL_PATH);
  const npcsRef = useRef<AnimatedPedestrian[]>([]);
  const foliageRef = useRef<FoliageAnimSystem>({ grassList: [] });
  const readyNotified = useRef(false);

  // Prepare and calibrate the Vietnamese street environment
  // In-place traversal with static transform freezing and frustum culling
  const primaryCityScene = useMemo(() => {
    const scene = cityGltf.scene;
    const npcs: AnimatedPedestrian[] = [];
    const foliage: FoliageAnimSystem = { grassList: [] };

    let npcIndex = 0;
    const alreadyCalibrated = Boolean(scene.userData.calibrated);

    // Helper to enable matrix auto update on an object and all its children
    const enableDynamicMatrix = (obj: THREE.Object3D) => {
      obj.matrixAutoUpdate = true;
      obj.children.forEach(enableDynamicMatrix);
    };

    scene.traverse((child) => {
      const name = child.name || "";
      const lowerName = name.toLowerCase();

      // Defensive check: hide any leftover legacy foreground characters
      if (name.includes("19_6_2025") || lowerName.includes("ai guy")) {
        child.visible = false;
        return;
      }

      // Detect pedestrian models (sidewalk characters)
      if (
        name.includes("rp_mei_posed_001") ||
        name.includes("20261110000447_177df9df")
      ) {
        child.matrixAutoUpdate = true;
        npcs.push({
          object: child,
          basePosY: child.position.y,
          baseRotY: child.rotation.y,
          baseRotZ: child.rotation.z,
          phaseOffset: npcIndex * 1.5,
          speed: 1.4 + (npcIndex % 3) * 0.2,
        });
        npcIndex++;
        return;
      }

      // Detect street trees and foliage for gentle tropical breeze animation
      if (name === "tree_big") {
        enableDynamicMatrix(child);
        foliage.treeBig = {
          object: child,
          baseRot: child.rotation.clone(),
        };
        return;
      }

      if (name === "Leaf_6_3") {
        enableDynamicMatrix(child);
        foliage.leafCanopy = {
          object: child,
          baseRot: child.rotation.clone(),
        };
        return;
      }

      if (name === "tree_banana") {
        enableDynamicMatrix(child);
        foliage.bananaTree = {
          object: child,
          baseRot: child.rotation.clone(),
        };
        return;
      }

      if (lowerName.startsWith("cỏ")) {
        child.matrixAutoUpdate = true;
        foliage.grassList.push({
          object: child,
          baseRotZ: child.rotation.z,
          phaseOffset: foliage.grassList.length * 1.3,
        });
        return;
      }

      // Configure meshes & materials
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.frustumCulled = true;

        const isSkyMesh = lowerName.includes("sky");

        if (isSkyMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        } else if (shadows) {
          // Selective shadows: only foreground objects cast, ground/street receives
          const isGround = lowerName.includes("street") || lowerName.includes("road") || lowerName.includes("sidewalk");
          mesh.receiveShadow = true;
          mesh.castShadow = !isGround && child.position.z < 60;
        } else {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        }

        // Freeze static transform matrices if not a dynamic animated object
        if (!child.matrixAutoUpdate) {
          child.updateMatrix();
          child.matrixAutoUpdate = false;
        }

        // Perform one-time material calibration
        if (!alreadyCalibrated && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const mat = m as THREE.MeshStandardMaterial;

              // Fix asphalt road glowing/chói issue: disable accidental full-white emission exported from Unity
              if (mat.name === "streets") {
                mat.emissive = new THREE.Color(0, 0, 0);
                mat.emissiveIntensity = 0;
                mat.roughness = 0.55;
                mat.metalness = 0.05;
              } else if (mat.name.includes("Mat_Light_Emission") || mat.name.includes("Emission")) {
                mat.emissive = new THREE.Color("#ffe082");
                mat.emissiveIntensity = 1.2;
              } else if (mat.name === "material") {
                mat.emissiveIntensity = 0.8;
              } else {
                if (mat.emissiveIntensity > 0 && !mat.name.includes("Light")) {
                  mat.emissiveIntensity = 0;
                }
              }

              // Prevent unmapped materials from appearing pitch-black
              if (mat.metalness > 0.25 && !mat.metalnessMap) {
                mat.metalness = 0.08;
              }
              mat.roughness = Math.max(mat.roughness, 0.4);

              // Normalize texture color spaces
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
              }
              if (mat.emissiveMap) {
                mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
              }
            }
          });
        }
      } else {
        // Freeze static group nodes if not dynamic
        if (!child.matrixAutoUpdate) {
          child.updateMatrix();
          child.matrixAutoUpdate = false;
        }
      }
    });

    scene.userData.calibrated = true;
    npcsRef.current = npcs;
    foliageRef.current = foliage;
    return scene;
  }, [cityGltf, shadows]);

  // Async GPU shader pre-compilation: warms up WebGL pipelines in parallel without freezing frame loop
  useEffect(() => {
    let active = true;
    if (primaryCityScene && gl && camera) {
      const compilePromise = gl.compileAsync
        ? gl.compileAsync(primaryCityScene, camera)
        : Promise.resolve();

      compilePromise
        .then(() => {
          if (!active) return;
          setIsCompiled(true);
          if (!readyNotified.current) {
            readyNotified.current = true;
            onReady?.();
          }
        })
        .catch(() => {
          if (!active) return;
          setIsCompiled(true);
          if (!readyNotified.current) {
            readyNotified.current = true;
            onReady?.();
          }
        });
    }
    return () => {
      active = false;
    };
  }, [primaryCityScene, gl, camera, onReady]);

  // Subtle living motions: human NPC breathing and lively tropical wind on trees & foliage
  useFrame((state) => {
    if (!isCompiled) return;

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

    // Gentle, relaxing Saigon afternoon breeze (soft rustle, no storm tilt)
    const windTime = time * 0.55;
    const gust = Math.sin(windTime * 0.6) * 0.7 + Math.sin(windTime * 1.3) * 0.25;
    const leafBreath = Math.sin(time * 1.6) * 0.12 + Math.cos(time * 2.4) * 0.06;

    const foliage = foliageRef.current;

    // 1. Main Street Tree: Trunk stays solid and grounded with very subtle, heavy tree breathing
    if (foliage.treeBig) {
      const { object, baseRot } = foliage.treeBig;
      const swayX = gust * 0.008;
      const swayZ = Math.cos(windTime * 0.7) * 0.006;
      object.rotation.x = baseRot.x + swayX;
      object.rotation.z = baseRot.z + swayZ;
    }

    // 2. Tree Canopy & Leaves: Soft, organic fluttering in the breeze without leaning into buildings
    if (foliage.leafCanopy) {
      const { object, baseRot } = foliage.leafCanopy;
      const leafTime = time * 0.75;
      const leafSway = Math.sin(leafTime * 0.8 + 0.3) * 0.016 + Math.cos(leafTime * 1.5) * 0.008;
      const leafTilt = Math.cos(leafTime * 0.9) * 0.012;
      const leafTwist = Math.sin(leafTime * 0.5) * 0.008;
      const rustle = leafBreath * 0.004;

      object.rotation.x = baseRot.x + leafSway + rustle;
      object.rotation.y = baseRot.y + leafTwist;
      object.rotation.z = baseRot.z + leafTilt + rustle * 0.5;
    }

    // 3. Tropical Banana Trees: Soft, gentle frond wave
    if (foliage.bananaTree) {
      const { object, baseRot } = foliage.bananaTree;
      const bTime = time * 0.65 + 0.5;
      const bSwayZ = Math.sin(bTime * 0.8) * 0.016 + Math.sin(bTime * 1.4) * 0.006;
      const bSwayY = Math.cos(bTime * 0.6) * 0.01;
      object.rotation.z = baseRot.z + bSwayZ;
      object.rotation.y = baseRot.y + bSwayY;
    }

    // 4. Sidewalk & Planter Grass: Gentle grassy ripples
    if (foliage.grassList.length > 0) {
      foliage.grassList.forEach((grass) => {
        const gTime = time * 1.1 + grass.phaseOffset;
        const gSway = Math.sin(gTime) * 0.022 + Math.sin(gTime * 1.9) * 0.008;
        grass.object.rotation.z = grass.baseRotZ + gSway;
      });
    }
  });

  return (
    <group name="StreetEnvironment" visible={isCompiled}>
      <primitive
        object={primaryCityScene}
        scale={[1, 1, 1]}
        position={[0, 0, 0]}
      />
    </group>
  );
};
