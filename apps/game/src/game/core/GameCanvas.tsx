import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { GameSettings } from "@scammaze/shared-types";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { STREET_CONFIG } from "../scenes/MainMenuScene/StreetComposition";
import { WebGLFallback } from "../../components/ui/WebGLFallback";

interface GameCanvasProps {
  settings: GameSettings;
  onSceneReady?: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error?: string) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GameCanvas WebGL runtime error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.errorMessage);
    }
    return this.props.children;
  }
}

function checkBasicWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.WebGLRenderingContext || window.WebGL2RenderingContext);
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ settings, onSceneReady }) => {
  // Lightweight check that does not allocate or leak active GPU contexts
  if (!checkBasicWebGLSupport()) {
    return (
      <WebGLFallback error="Browser does not support WebGL 3D rendering. Please enable Hardware Acceleration in browser settings." />
    );
  }

  // Optimized DPR scaling: sharp visuals on Retina without crushing GPU fillrate
  const maxDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr =
    settings.graphicsQuality === "low"
      ? 1.0
      : settings.graphicsQuality === "medium"
        ? Math.min(maxDpr, 1.25)
        : Math.min(maxDpr, 1.5);

  const shadows = settings.graphicsQuality === "high";

  return (
    <div className="absolute inset-0 w-full h-full bg-[#13111f]">
      <CanvasErrorBoundary
        fallback={(err) => (
          <WebGLFallback error={err || "WebGL 3D Context could not be initialized by the graphics driver."} />
        )}
      >
        <Canvas
          shadows={shadows}
          dpr={dpr}
          performance={{ min: 0.5 }}
          camera={{
            fov: settings.fov,
            position: STREET_CONFIG.camera.defaultPosition,
            near: 0.1,
            far: STREET_CONFIG.camera.far,
          }}
          gl={{
            antialias: settings.graphicsQuality !== "low",
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.95,
          }}
          onCreated={({ gl, camera }) => {
            // Prevent context loss from crashing the page; allows automatic GPU restoration
            gl.domElement.addEventListener(
              "webglcontextlost",
              (event) => {
                event.preventDefault();
                console.warn("WebGL context temporarily lost. Waiting for browser GPU restoration...");
              },
              false
            );

            gl.domElement.addEventListener(
              "webglcontextrestored",
              () => {
                console.info("WebGL context restored successfully.");
              },
              false
            );

            gl.setClearColor("#86a9d2", 1);
            // Set orientation immediately on WebGL initialization to prevent unoriented initial frame
            camera.position.set(
              STREET_CONFIG.camera.defaultPosition[0],
              STREET_CONFIG.camera.defaultPosition[1],
              STREET_CONFIG.camera.defaultPosition[2]
            );
            camera.lookAt(
              STREET_CONFIG.camera.targetPosition[0],
              STREET_CONFIG.camera.targetPosition[1],
              STREET_CONFIG.camera.targetPosition[2]
            );
            camera.updateMatrixWorld(true);
          }}
        >
          <MainMenuScene settings={settings} onSceneReady={onSceneReady} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
};
