import React, { useEffect, useState, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { BrandLogo } from "./BrandLogo";

interface LoadingScreenProps {
  sceneReady: boolean;
  onFinished?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  sceneReady,
  onFinished,
}) => {
  const { active, progress } = useProgress();
  const [displayProgress, setDisplayProgress] = useState(15);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [effectiveReady, setEffectiveReady] = useState(false);
  const finishTriggered = useRef(false);

  // Safety fallback: if Drei download finished or after a reasonable timeout, auto-complete
  useEffect(() => {
    if (sceneReady) {
      setEffectiveReady(true);
      return;
    }

    // If Drei reports assets loaded (or inactive), give a brief 1.2s safety window then force-reveal
    if (!active || progress >= 99) {
      const fallbackTimer = setTimeout(() => {
        setEffectiveReady(true);
      }, 1200);
      return () => clearTimeout(fallbackTimer);
    }

    // Absolute fallback: never trap user on loading screen for more than 4.5s
    const hardTimeout = setTimeout(() => {
      setEffectiveReady(true);
    }, 4500);
    return () => clearTimeout(hardTimeout);
  }, [sceneReady, active, progress]);

  // Smooth progress calculation: Strictly capped at 92% until scene is actually ready to display
  useEffect(() => {
    let animId: number;

    // Only allow 100% when effectiveReady is true
    const target = effectiveReady
      ? 100
      : Math.min(Math.max(progress, 18), 92);

    const step = () => {
      setDisplayProgress((prev) => {
        if (effectiveReady) return 100;
        if (prev >= target) return prev;
        const diff = target - prev;
        const next = prev + Math.max(diff * 0.15, 1.2);
        return next >= target ? target : next;
      });

      if (!effectiveReady && displayProgress < target) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [progress, effectiveReady, displayProgress]);

  // Once ready, transition out smoothly directly into the completed 3D street
  useEffect(() => {
    if (effectiveReady && !finishTriggered.current) {
      finishTriggered.current = true;
      setDisplayProgress(100);

      // Fast transition: start fade out in 60ms, finish in 450ms
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
        const finishTimer = setTimeout(() => {
          onFinished?.();
        }, 450);
        return () => clearTimeout(finishTimer);
      }, 60);

      return () => clearTimeout(fadeTimer);
    }
  }, [effectiveReady, onFinished]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center p-8 sm:p-12 bg-[#0e0d16] text-white transition-opacity duration-500 ease-out select-none overflow-hidden ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-label="Loading Game Scene"
      role="status"
    >
      {/* Background Cinematic Artwork Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <picture>
          <source srcSet="/assets/ui/loading_bg.webp" type="image/webp" />
          <img
            src="/assets/ui/loading_bg.jpg"
            alt="District 4 Saigon street incoming scam call"
            className="w-full h-full object-cover object-center filter brightness-[0.72] contrast-[1.05]"
          />
        </picture>
        {/* Subtle Vignette & Gradient Overlays for UI contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0d16]/95 via-[#0e0d16]/40 to-[#0e0d16]/80" />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(14, 13, 22, 0.15) 0%, rgba(14, 13, 22, 0.85) 100%)",
          }}
        />
      </div>

      {/* Top Branding */}
      <header className="relative z-10 w-full flex items-center">
        <BrandLogo size="md" />
      </header>

      {/* Center Loading Display */}
      <div className="relative z-10 my-auto flex flex-col items-center max-w-md w-full text-center space-y-6 px-6 py-6 rounded-2xl bg-[#141221]/80 backdrop-blur-md border border-[#3b3452]/70 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-['Bricolage_Grotesque_Variable',sans-serif]">
            Preparing Environment
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300">
            {displayProgress < 65
              ? "Downloading 3D neighborhood assets..."
              : displayProgress < 95
                ? "Calibrating shaders and environment..."
                : "Entering District 4..."}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full space-y-2">
          <div className="w-full h-2.5 bg-[#1b172b] rounded-full overflow-hidden border border-[#3b3452]/70 p-0.5 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-500 to-amber-400 transition-[width] duration-150 ease-out"
              style={{ width: `${Math.min(Math.round(displayProgress), 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs font-mono text-zinc-300 px-1">
            <span>Asset Pipeline</span>
            <span className="text-[#b9a5f5] font-semibold">
              {Math.min(Math.round(displayProgress), 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Invisible bottom spacer to ensure balanced vertical centering */}
      <div className="relative z-10 w-full h-6 opacity-0 pointer-events-none" aria-hidden="true" />
    </div>
  );
};
