import React, { useState, useEffect, useCallback, useRef } from "react";
import { GameCanvas } from "../game/core/GameCanvas";
import { MainMenuOverlay } from "../features/menu/MainMenuOverlay";
import { HCMPage } from "../features/hochiminh";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import type { GameSettings } from "@scammaze/shared-types";

const SETTINGS_STORAGE_KEY = "scammaze_settings_v1";

const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: "medium",
  soundEnabled: true,
  musicVolume: 1.0,
  sfxVolume: 1.0,
  fov: 72,
};

function getIsHCMRoute(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path.startsWith("/hochiminh") ||
    path.startsWith("/hcm") ||
    hash.includes("hochiminh") ||
    hash.includes("hcm")
  );
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<"menu" | "hochiminh">(() =>
    getIsHCMRoute() ? "hochiminh" : "menu"
  );
  const [sceneReady, setSceneReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(getIsHCMRoute() ? "hochiminh" : "menu");
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateTo = (newRoute: "menu" | "hochiminh") => {
    const targetPath = newRoute === "hochiminh" ? "/hochiminh" : "/";
    window.history.pushState(null, "", targetPath);
    setRoute(newRoute);
  };

  const handleUpdateSettings = (updates: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage quota errors
      }
      return next;
    });
  };

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  const handleLoadingFinished = useCallback(() => {
    setShowLoading(false);
  }, []);

  // Gapless Seamless Dual-Layer Web Audio Engine (BGM + Street Ambient + SFX)
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const ambientBufferRef = useRef<AudioBuffer | null>(null);
  const hoverBufferRef = useRef<AudioBuffer | null>(null);
  const musicFadedInRef = useRef<boolean>(false);
  const ambientFadedInRef = useRef<boolean>(false);

  const playHoverSound = useCallback(() => {
    const ctx = audioContextRef.current;
    const buf = hoverBufferRef.current;
    const sfxGain = sfxGainRef.current;
    if (!ctx || !buf || !sfxGain || !settings.soundEnabled) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(sfxGain);
      source.start(0);
    } catch {
      // Ignore rapid collision errors
    }
  }, [settings.soundEnabled]);

  const startMusicSource = useCallback(() => {
    const ctx = audioContextRef.current;
    const buf = musicBufferRef.current;
    const gainNode = musicGainRef.current;
    if (!ctx || !buf || !gainNode || musicSourceRef.current) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true; // Hardware sample-accurate gapless loop (0ms stutter)
      source.connect(gainNode);
      source.start(0);
      musicSourceRef.current = source;

      // Smooth fade-in from loading screen (ramp up over 3.0s)
      const targetGain = settings.soundEnabled ? Math.max(0, Math.min(1, settings.musicVolume * 0.28)) : 0;
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 3.0);
      musicFadedInRef.current = true;
    } catch (err) {
      console.warn("Web Audio BGM source start error:", err);
    }
  }, [settings.soundEnabled, settings.musicVolume]);

  const startAmbientSource = useCallback(() => {
    const ctx = audioContextRef.current;
    const buf = ambientBufferRef.current;
    const gainNode = ambientGainRef.current;
    if (!ctx || !buf || !gainNode || ambientSourceRef.current) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true; // Hardware sample-accurate gapless loop (0ms stutter)
      source.connect(gainNode);
      source.start(0);
      ambientSourceRef.current = source;
    } catch (err) {
      console.warn("Web Audio ambient source start error:", err);
    }
  }, []);

  const handleToggleSound = useCallback(() => {
    const nextSoundEnabled = !settings.soundEnabled;
    handleUpdateSettings({ soundEnabled: nextSoundEnabled });

    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    if (nextSoundEnabled) {
      startMusicSource();
      startAmbientSource();
    }
  }, [settings.soundEnabled, handleUpdateSettings, startMusicSource, startAmbientSource]);

  // Initialize Web Audio Context and pre-decode both audio tracks into memory
  useEffect(() => {
    if (typeof window === "undefined") return;

    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    const ctx = new AudioCtxClass();

    // Master Gain
    const masterGain = ctx.createGain();
    const initialMasterGain = settings.soundEnabled && route === "menu" ? 1.0 : 0;
    masterGain.gain.setValueAtTime(initialMasterGain, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // BGM Gain (starts at 0.0001, will fade in as loading starts)
    const musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicGain.connect(masterGain);

    // Street Ambient Gain (starts at 0.0001, will fade in when scene is revealed)
    const ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambientGain.connect(masterGain);

    // SFX Gain (for button hover and UI interaction, prominent punch)
    const sfxGain = ctx.createGain();
    const initialSfxGain = settings.soundEnabled ? Math.max(0, settings.sfxVolume * 1.5) : 0;
    sfxGain.gain.setValueAtTime(initialSfxGain, ctx.currentTime);
    sfxGain.connect(masterGain);

    audioContextRef.current = ctx;
    masterGainRef.current = masterGain;
    musicGainRef.current = musicGain;
    ambientGainRef.current = ambientGain;
    sfxGainRef.current = sfxGain;

    let mounted = true;

    // Load & decode Button Hover SFX
    fetch("/assets/audio/button_hover.mp3")
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((decodedBuffer) => {
        if (!mounted) return;
        hoverBufferRef.current = decodedBuffer;
      })
      .catch((err) => {
        console.warn("Failed to decode hover SFX:", err);
      });

    // Load & decode BGM (menu_music.mp3 - chill theme)
    fetch("/assets/audio/menu_music.mp3")
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((decodedBuffer) => {
        if (!mounted) return;
        musicBufferRef.current = decodedBuffer;
        if (route === "menu" && settings.soundEnabled) {
          startMusicSource();
        }
      })
      .catch((err) => {
        console.warn("Failed to decode BGM audio:", err);
      });

    // Load & decode Street Ambient (menu_ambient.mp3 - District 4 Saigon street chatter)
    fetch("/assets/audio/menu_ambient.mp3")
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((decodedBuffer) => {
        if (!mounted) return;
        ambientBufferRef.current = decodedBuffer;
        if (route === "menu" && settings.soundEnabled) {
          startAmbientSource();
        }
      })
      .catch((err) => {
        console.warn("Failed to decode street ambient audio:", err);
      });

    const unlockOnGesture = () => {
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          if (route === "menu" && settings.soundEnabled) {
            startMusicSource();
            startAmbientSource();
          }
        }).catch(() => {});
      } else if (route === "menu" && settings.soundEnabled) {
        startMusicSource();
        startAmbientSource();
      }
    };

    window.addEventListener("pointerdown", unlockOnGesture, { passive: true });
    window.addEventListener("click", unlockOnGesture, { passive: true });
    window.addEventListener("keydown", unlockOnGesture, { passive: true });
    window.addEventListener("touchstart", unlockOnGesture, { passive: true });

    return () => {
      mounted = false;
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("click", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
      window.removeEventListener("touchstart", unlockOnGesture);

      try {
        musicSourceRef.current?.stop();
        ambientSourceRef.current?.stop();
        ctx.close();
      } catch {}

      audioContextRef.current = null;
      masterGainRef.current = null;
      musicGainRef.current = null;
      ambientGainRef.current = null;
      sfxGainRef.current = null;
      musicSourceRef.current = null;
      ambientSourceRef.current = null;
      musicBufferRef.current = null;
      ambientBufferRef.current = null;
      hoverBufferRef.current = null;
      musicFadedInRef.current = false;
      ambientFadedInRef.current = false;
    };
  }, [route, settings.soundEnabled, startMusicSource, startAmbientSource]);

  // Ambient fade-in when scene becomes ready and loading finishes
  useEffect(() => {
    const ambientGain = ambientGainRef.current;
    const ctx = audioContextRef.current;
    if (!ambientGain || !ctx) return;

    if (sceneReady && !showLoading && route === "menu") {
      const targetAmbient = settings.soundEnabled ? Math.max(0, Math.min(1, settings.musicVolume * 0.25)) : 0;
      if (!ambientFadedInRef.current) {
        ambientGain.gain.cancelScheduledValues(ctx.currentTime);
        ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(targetAmbient, ctx.currentTime + 2.0);
        ambientFadedInRef.current = true;
      } else {
        ambientGain.gain.setTargetAtTime(targetAmbient, ctx.currentTime, 0.06);
      }
    }
  }, [sceneReady, showLoading, route, settings.soundEnabled, settings.musicVolume]);

  // Reactive volume, route & mute synchronization with click-free 60ms transitions
  useEffect(() => {
    const masterGain = masterGainRef.current;
    const musicGain = musicGainRef.current;
    const sfxGain = sfxGainRef.current;
    const ctx = audioContextRef.current;
    if (!masterGain || !musicGain || !ctx) return;

    // Master gain controls overall on/off and route gating
    const targetMaster = route === "menu" && settings.soundEnabled ? 1.0 : 0;
    masterGain.gain.setTargetAtTime(targetMaster, ctx.currentTime, 0.06);

    // If BGM already completed initial fade-in, follow music volume changes reactively
    if (musicFadedInRef.current && route === "menu") {
      const targetMusic = settings.soundEnabled ? Math.max(0, Math.min(1, settings.musicVolume * 0.28)) : 0;
      musicGain.gain.setTargetAtTime(targetMusic, ctx.currentTime, 0.06);
    }

    if (sfxGain) {
      const targetSfx = settings.soundEnabled ? Math.max(0, settings.sfxVolume * 1.5) : 0;
      sfxGain.gain.setTargetAtTime(targetSfx, ctx.currentTime, 0.06);
    }

    if (targetMaster > 0) {
      startMusicSource();
      startAmbientSource();
    }
  }, [route, settings.soundEnabled, settings.musicVolume, settings.sfxVolume, startMusicSource, startAmbientSource]);

  // Global keyboard shortcuts (e.g. 'M' for mute when in menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "m" || e.key === "M") {
        handleToggleSound();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSound]);

  // Route: /hochiminh -> Standalone 3D Ho Chi Minh Map Explorer with rich colors
  if (route === "hochiminh") {
    return <HCMPage onBackToMenu={() => navigateTo("menu")} />;
  }

  // Route: / -> Original Main Menu Scene & Overlay
  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#13111f]">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas settings={settings} onSceneReady={handleSceneReady} />

      {/* HTML / React Menu Overlay */}
      <MainMenuOverlay
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onToggleSound={handleToggleSound}
        onHoverSound={playHoverSound}
        onOpenHCM={() => navigateTo("hochiminh")}
      />

      {/* Atmospheric Game Loading Screen overlay */}
      {showLoading && (
        <LoadingScreen
          sceneReady={sceneReady}
          onFinished={handleLoadingFinished}
        />
      )}
    </div>
  );
};
