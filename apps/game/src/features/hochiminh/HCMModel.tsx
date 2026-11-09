import React, { useMemo, useEffect, useRef } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { applyCityTheme } from "./colorEngine";
import { HCM_LANDMARKS, type HCMThemeId, type LandmarkInfo } from "./types";
import { MapPin, Navigation } from "lucide-react";

const HCM_MODEL_PATH = "/assets/3d/environments/hochiminh.glb";
useGLTF.preload(HCM_MODEL_PATH);

interface HCMModelProps {
  theme: HCMThemeId;
  showLandmarks: boolean;
  selectedLandmarkId: string | null;
  onSelectLandmark: (landmark: LandmarkInfo) => void;
}

export const HCMModel: React.FC<HCMModelProps> = ({
  theme,
  showLandmarks,
  selectedLandmarkId,
  onSelectLandmark,
}) => {
  const gltf = useGLTF(HCM_MODEL_PATH);
  const beaconRef1 = useRef<THREE.PointLight>(null);
  const beaconRef2 = useRef<THREE.PointLight>(null);

  const cityScene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    return cloned;
  }, [gltf.scene]);

  useEffect(() => {
    applyCityTheme(cityScene, theme);
  }, [cityScene, theme]);

  // Subtle aviation beacon pulsation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const blink = Math.sin(t * 3.5) > 0.4 ? 1.0 : 0.15;
    if (beaconRef1.current) {
      beaconRef1.current.intensity = blink * 2.5;
    }
    if (beaconRef2.current) {
      beaconRef2.current.intensity = blink * 2.0;
    }
  });

  // Authentic river water color per theme (sampled from photos 2, 3, 4, 5)
  const waterColor = useMemo(() => {
    switch (theme) {
      case "cyberpunk":
        return "#091424";
      case "sunset":
        return "#804e39";
      case "blueprint":
        return "#0284c7";
      default:
        // Sông Sài Gòn alluvial sediment water
        return "#5d6252";
    }
  }, [theme]);

  return (
    <group>
      {/* Centered Ho Chi Minh City 3D Model */}
      <primitive
        object={cityScene}
        position={[-27.756, 0, 24.365]}
      />

      {/* Sông Sài Gòn Physical Water Surface */}
      <mesh
        position={[3.5, 0.38, 11.5]}
        rotation={[-Math.PI / 2, 0, -0.25]}
        receiveShadow
      >
        <planeGeometry args={[32, 16, 24, 24]} />
        <meshStandardMaterial
          color={waterColor}
          roughness={0.18}
          metalness={0.4}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Aviation Warning Beacon on Bitexco Financial Tower */}
      <group position={[5.77, 5.25, 8.67]}>
        <pointLight
          ref={beaconRef1}
          color="#ff2222"
          distance={10}
          intensity={2.0}
        />
        <mesh>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color="#ff2222" />
        </mesh>
      </group>

      {/* Aviation Warning Beacon on Northern Skyscraper */}
      <group position={[3.57, 5.08, -14.72]}>
        <pointLight
          ref={beaconRef2}
          color="#ff2222"
          distance={10}
          intensity={1.8}
        />
        <mesh>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#ff2222" />
        </mesh>
      </group>

      {/* Sleek Floating 3D Landmark Markers */}
      {showLandmarks &&
        HCM_LANDMARKS.map((landmark) => {
          const isSelected = selectedLandmarkId === landmark.id;
          return (
            <group
              key={landmark.id}
              position={landmark.position}
            >
              {/* Thin Vertical Stem */}
              <line>
                <bufferGeometry>
                  <float32BufferAttribute
                    attach="attributes-position"
                    args={[
                      new Float32Array([
                        0, 0, 0,
                        0, 0.45, 0
                      ]),
                      3
                    ]}
                  />
                </bufferGeometry>
                <lineBasicMaterial
                  color={isSelected ? "#38bdf8" : "#fbbf24"}
                  transparent
                  opacity={0.7}
                />
              </line>

              {/* Floating Landmark Badge */}
              <Html
                position={[0, 0.5, 0]}
                center
                distanceFactor={22}
                style={{
                  pointerEvents: "auto",
                  userSelect: "none",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLandmark(landmark);
                  }}
                  className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-200 cursor-pointer shadow-lg whitespace-nowrap ${
                    isSelected
                      ? "bg-sky-600 text-white border-sky-300 ring-2 ring-sky-400/50 scale-105"
                      : "bg-[#141222]/90 text-amber-300 border-amber-500/40 hover:bg-[#201d36] hover:border-amber-400 hover:text-white"
                  }`}
                >
                  <MapPin className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="font-sans text-[11px] tracking-wide">{landmark.name}</span>
                  {isSelected && (
                    <Navigation className="w-3 h-3 text-sky-200 animate-pulse ml-0.5" />
                  )}
                </button>
              </Html>
            </group>
          );
        })}
    </group>
  );
};
