import React, { useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { HCMModel } from "./HCMModel";
import { HCMSky } from "./HCMSky";
import type { HCMThemeId, LandmarkInfo, ViewPreset } from "./types";

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;

interface HCMCanvasProps {
  theme: HCMThemeId;
  showLandmarks: boolean;
  autoRotate: boolean;
  selectedLandmark: LandmarkInfo | null;
  activeView: ViewPreset | null;
  onSelectLandmark: (landmark: LandmarkInfo) => void;
}

// Camera animation controller for smooth fly-to transitions
const CameraController: React.FC<{
  targetPos: [number, number, number] | null;
  targetLookAt: [number, number, number] | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onAnimationComplete: () => void;
}> = ({ targetPos, targetLookAt, controlsRef, onAnimationComplete }) => {
  const { camera } = useThree();
  const animating = useRef(false);
  const destPos = useRef(new THREE.Vector3());
  const destLook = useRef(new THREE.Vector3());

  useEffect(() => {
    if (targetPos && targetLookAt) {
      destPos.current.set(...targetPos);
      destLook.current.set(...targetLookAt);
      animating.current = true;
    }
  }, [targetPos, targetLookAt]);

  useFrame((_, delta) => {
    if (!animating.current) return;

    const t = Math.min(1, delta * 3.2);
    camera.position.lerp(destPos.current, t);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(destLook.current, t);
      controlsRef.current.update();
    }

    const distPos = camera.position.distanceTo(destPos.current);
    const distLook = controlsRef.current
      ? controlsRef.current.target.distanceTo(destLook.current)
      : 0;

    if (distPos < 0.1 && distLook < 0.1) {
      animating.current = false;
      onAnimationComplete();
    }
  });

  return null;
};

// Natural Daylight & Atmospheric Lighting matching real Saigon aerial photography
const HCMLighting: React.FC<{ theme: HCMThemeId }> = ({ theme }) => {
  const { gl, scene } = useThree();

  useEffect(() => {
    let bgColor = "#adc3e9";
    let fogColor = "#adc3e9";
    let fogNear = 70;
    let fogFar = 230;

    if (theme === "cyberpunk") {
      bgColor = "#060712";
      fogColor = "#080a18";
      fogNear = 40;
      fogFar = 160;
    } else if (theme === "sunset") {
      bgColor = "#4d2238";
      fogColor = "#5c2b43";
      fogNear = 45;
      fogFar = 180;
    } else if (theme === "blueprint") {
      bgColor = "#0b1220";
      fogColor = "#0f172a";
      fogNear = 50;
      fogFar = 180;
    }

    gl.setClearColor(bgColor, 1);
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
  }, [gl, scene, theme]);

  if (theme === "cyberpunk") {
    return (
      <>
        <ambientLight intensity={0.45} color="#1e1b4b" />
        <hemisphereLight args={["#312e81", "#09090b", 0.5]} />
        <directionalLight
          position={[-25, 38, -20]}
          intensity={1.0}
          color="#38bdf8"
          castShadow
        />
        <pointLight position={[5.8, 3.5, 8.7]} color="#f43f5e" intensity={4} distance={25} />
        <pointLight position={[8.0, 2.0, 5.0]} color="#00f5d4" intensity={3} distance={25} />
        <pointLight position={[-3.0, 2.5, 3.0]} color="#fbbf24" intensity={3} distance={25} />
      </>
    );
  }

  if (theme === "sunset") {
    return (
      <>
        <ambientLight intensity={0.6} color="#7c2d12" />
        <hemisphereLight args={["#f43f5e", "#292524", 0.65]} />
        <directionalLight
          position={[32, 16, 15]}
          intensity={2.4}
          color="#fb923c"
          castShadow
        />
      </>
    );
  }

  if (theme === "blueprint") {
    return (
      <>
        <ambientLight intensity={0.7} color="#1e293b" />
        <hemisphereLight args={["#38bdf8", "#020617", 0.65]} />
        <directionalLight
          position={[20, 42, 25]}
          intensity={1.5}
          color="#f8fafc"
          castShadow
        />
      </>
    );
  }

  // Realistic Saigon Daylight (Photos 2 & 3: Radiant tropical blue sky, bright sun, warm ground bounce)
  return (
    <>
      <ambientLight intensity={0.65} color="#9ec2e6" />
      <hemisphereLight
        args={["#8cbbe8", "#6f6b5c", 0.7]}
      />
      <directionalLight
        position={[28, 48, 22]}
        intensity={2.1}
        color="#fffbf0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={130}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />
    </>
  );
};

export const HCMCanvas: React.FC<HCMCanvasProps> = ({
  theme,
  showLandmarks,
  autoRotate,
  selectedLandmark,
  activeView,
  onSelectLandmark,
}) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const targetPos = selectedLandmark
    ? selectedLandmark.cameraPos
    : activeView
      ? activeView.position
      : null;

  const targetLookAt = selectedLandmark
    ? selectedLandmark.cameraTarget
    : activeView
      ? activeView.target
      : null;

  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          fov: 46,
          position: [0, 32, 36],
          near: 0.2,
          far: 500,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: theme === "cyberpunk" ? 1.25 : 1.15,
        }}
      >
        <HCMLighting theme={theme} />

        <Suspense fallback={null}>
          <HCMSky theme={theme} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={2.5}
          maxDistance={85}
          autoRotate={autoRotate}
          autoRotateSpeed={0.45}
        />

        <CameraController
          targetPos={targetPos}
          targetLookAt={targetLookAt}
          controlsRef={controlsRef}
          onAnimationComplete={() => {}}
        />

        <HCMModel
          theme={theme}
          showLandmarks={showLandmarks}
          selectedLandmarkId={selectedLandmark ? selectedLandmark.id : null}
          onSelectLandmark={onSelectLandmark}
        />
      </Canvas>
    </div>
  );
};
