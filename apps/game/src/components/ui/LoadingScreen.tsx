import React, { useEffect, useState, useRef } from "react";
import { useProgress } from "@react-three/drei";
import { ShieldCheck, Sparkles } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface LoadingScreenProps {
  sceneReady: boolean;
  onFinished?: () => void;
}

const TIPS = [
  "Scammers often create urgent time pressure so you act before thinking.",
  "Never share one-time OTP codes, passwords, or banking credentials with anyone.",
  "Check sender domain names carefully: look-alike domains often contain subtle typos.",
  "Official banks and police departments will never ask you to transfer money to a safe account over the phone.",
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  sceneReady,
  onFinished,
}) => {
  const { active, progress } = useProgress();
  const [displayProgress, setDisplayProgress] = useState(15);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
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
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center p-8 sm:p-12 bg-[#0e0d16] text-white transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 40%, rgba(94, 60, 168, 0.22) 0%, rgba(14, 13, 22, 0.98) 70%)",
      }}
      aria-label="Loading Game Scene"
      role="status"
    >
      {/* Top Branding */}
      <header className="w-full flex justify-between items-center">
        <BrandLogo size="md" />
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b172b] border border-[#3b3452] text-xs font-mono text-[#b9a5f5]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>District 4 Urban Scene</span>
        </div>
      </header>

      {/* Center Loading Display */}
      <div className="flex flex-col items-center max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-['Bricolage_Grotesque_Variable',sans-serif]">
            Preparing Environment
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
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

          <div className="flex justify-between items-center text-xs font-mono text-zinc-400 px-1">
            <span>Asset Pipeline</span>
            <span className="text-[#b9a5f5] font-semibold">
              {Math.min(Math.round(displayProgress), 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Cyber Safety Tip */}
      <footer className="max-w-lg w-full flex items-start gap-3 p-4 rounded-xl bg-[#141221]/90 border border-[#2d2742] text-xs text-zinc-300">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-zinc-200">Security Awareness Note</p>
          <p className="text-zinc-400 leading-relaxed">{TIPS[tipIndex]}</p>
        </div>
      </footer>
    </div>
  );
};
