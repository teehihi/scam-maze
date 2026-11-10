import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { GameSettings } from "@scammaze/shared-types";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { STREET_CONFIG } from "../scenes/MainMenuScene/StreetComposition";
import { WebGLFallback } from "../../components/ui/WebGLFallback";

interface GameCanvasProps {
  settings: GameSettings;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ settings }) => {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      if (!gl) {
        setWebglSupported(false);
        setErrorMessage("Browser does not provide a valid WebGL 1 or WebGL 2 context.");
      } else {
        setWebglSupported(true);
      }
    } catch (err) {
      setWebglSupported(false);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  if (webglSupported === false) {
    return <WebGLFallback error={errorMessage} />;
  }

  // Crisp native DPR scale - eliminates blurriness on Retina/High-DPI displays
  const maxDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr =
    settings.graphicsQuality === "low"
      ? 1.0
      : settings.graphicsQuality === "medium"
        ? Math.min(maxDpr, 1.5)
        : Math.min(maxDpr, 2.0);

  const shadows = settings.graphicsQuality === "high";

  return (
    <div className="absolute inset-0 w-full h-full bg-[#86a9d2]">
      <Canvas
        shadows={shadows}
        dpr={dpr}
        camera={{
          fov: settings.fov,
          position: STREET_CONFIG.camera.defaultPosition,
          near: 0.1,
          far: STREET_CONFIG.camera.far,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.95,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#86a9d2", 1);
        }}
      >
        <MainMenuScene settings={settings} />
      </Canvas>
    </div>
  );
};
