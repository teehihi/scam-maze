import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameSettings } from "@scammaze/shared-types";
import { MainMenuScene } from "../scenes/MainMenuScene";
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

  // Determine DPR scale based on quality preset
  const dpr =
    settings.graphicsQuality === "low"
      ? 0.8
      : settings.graphicsQuality === "medium"
        ? 1.0
        : [1.0, 1.5];

  const shadows = settings.graphicsQuality === "high";

  return (
    <div className="absolute inset-0 w-full h-full bg-[#13111f]">
      <Canvas
        shadows={shadows}
        dpr={dpr as any}
        camera={{
          fov: settings.fov,
          position: [32, 2.05, 14],
          near: 0.1,
          far: 250,
        }}
        gl={{
          antialias: settings.graphicsQuality !== "low",
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#13111f", 1);
        }}
      >
        <MainMenuScene settings={settings} />
      </Canvas>
    </div>
  );
};
