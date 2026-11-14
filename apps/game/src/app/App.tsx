import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GameCanvas } from "../game/core/GameCanvas";
import { MainMenuOverlay } from "../features/menu/MainMenuOverlay";
import { TestMovePage } from "../features/testmove";
import { UEHPage } from "../features/ueh";
import { HuePage } from "../features/hue";
import { MenuStartupLoading } from "../features/loading/MenuStartupLoading";
import { ChapterLoadingFlow } from "../features/loading/ChapterLoadingFlow";
import { ChapterPlaceholder } from "../features/chapter/ChapterPlaceholder";
import { ChapterOnePage } from "../features/chapter1/ChapterOnePage";
import { shouldPlayPrologue } from "../features/prologue/prologueGate";
import type { PrologueBuildProgress } from "../features/prologue/ProloguePage";
import type { LoadingHold } from "../features/loading/ChapterLoadingFlow";
import type { ContinueAvailability } from "../features/menu/MainMenuOverlay";
import { DEFAULT_CHAPTER_ID, getChapter } from "../game/chapters/chapterRegistry";
import { readContinueAvailability } from "./continueAvailability";
import type { ChapterSession } from "../game/chapters/chapterSession";
import type { ChapterLoadRequest } from "../game/loading/chapterLoader";
import { checkBasicWebGLSupport } from "../game/loading/deviceCapabilities";
import { createLocalStorageSaveSource } from "../game/saves/saveGame";
import type { GameSettings } from "@scammaze/shared-types";
import { applyLocale } from "../i18n";
import { loadSettings, saveSettings } from "./settingsStorage";

// The Mekong world is large (its own procedural builders plus the ambient-occlusion pass), so it
// is only downloaded when someone opens /mientay; the menu does not pay for it.
const MientayPage = lazy(() => import("../features/mientay").then((module) => ({ default: module.MientayPage })));

// The two prototype worlds below are standalone engines that are not part of the story chapters
// yet. They are only downloaded when someone opens /khupho or /roomv2.
// The new-game prologue (neighborhood, then the apartment) is also its own chunk.
const ProloguePage = lazy(() => import("../features/prologue").then((module) => ({ default: module.ProloguePage })));
const KhuphoPage = lazy(() => import("../features/khupho").then((module) => ({ default: module.KhuphoPage })));
const RoomV2Page = lazy(() => import("../features/roomv2").then((module) => ({ default: module.RoomV2Page })));

/** `window.localStorage` itself can throw (for example when storage is blocked). */
function getBrowserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

type Screen =
  | { kind: "menu" }
  | { kind: "chapter-loading"; request: ChapterLoadRequest }
  | { kind: "prologue"; session: ChapterSession }
  | { kind: "chapter"; session: ChapterSession };

const saveSource = createLocalStorageSaveSource();

function readSavedContinueAvailability(): ContinueAvailability {
  return readContinueAvailability(saveSource);
}

type AppRoute = "menu" | "testmove" | "ueh" | "hue" | "mientay" | "khupho" | "roomv2";

function getAppRoute(): AppRoute {
  if (typeof window === "undefined") return "menu";
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path.startsWith("/testmove") || hash.includes("testmove")) return "testmove";
  if (path.startsWith("/ueh") || hash.includes("ueh")) return "ueh";
  if (path.startsWith("/hue") || hash.includes("hue")) return "hue";
  if (path.startsWith("/mientay") || hash.includes("mientay")) return "mientay";
  if (path.startsWith("/khupho") || hash.includes("khupho")) return "khupho";
  if (path.startsWith("/roomv2") || hash.includes("roomv2")) return "roomv2";
  return "menu";
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() => getAppRoute());
  const [sceneReady, setSceneReady] = useState(false);
  // Without WebGL the canvas shows its own fallback, so the startup screen would never finish.
  const [showLoading, setShowLoading] = useState(() => checkBasicWebGLSupport());
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const [continueAvailability, setContinueAvailability] = useState(readSavedContinueAvailability);

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings(getBrowserStorage()));

  // Before paint, so every route (menu, chapter and the world pages) follows the language setting.
  useLayoutEffect(() => {
    applyLocale(settings.language);
  }, [settings.language]);

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(getAppRoute());
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateTo = (newRoute: AppRoute) => {
    const targetPath =
      newRoute === "testmove"
          ? "/testmove"
          : newRoute === "ueh"
            ? "/ueh"
            : newRoute === "hue"
              ? "/hue"
              : newRoute === "mientay"
                ? "/mientay"
                : newRoute === "khupho"
                  ? "/khupho"
                  : newRoute === "roomv2"
                    ? "/roomv2"
                    : "/";
    window.history.pushState(null, "", targetPath);
    setRoute(newRoute);
  };

  const handleUpdateSettings = (updates: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      // A failed write (for example a full quota) is ignored; the new settings still apply.
      saveSettings(getBrowserStorage(), next);
      return next;
    });
  };

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  const handleLoadingFinished = useCallback(() => {
    setShowLoading(false);
  }, []);

  const handleSceneError = useCallback((message: string) => {
    setSceneError(message);
  }, []);

  // Functional updates make repeated clicks harmless: only the first transition applies.
  const startChapterLoading = useCallback((request: ChapterLoadRequest) => {
    setScreen((prev) => (prev.kind === "menu" ? { kind: "chapter-loading", request } : prev));
  }, []);

  const handleStartNewGame = useCallback(() => {
    startChapterLoading({ kind: "new-game", chapterId: DEFAULT_CHAPTER_ID });
  }, [startChapterLoading]);

  const handleContinue = useCallback(() => {
    startChapterLoading({ kind: "continue" });
  }, [startChapterLoading]);

  const handleEnterChapter = useCallback((session: ChapterSession) => {
    setScreen((prev) => {
      if (prev.kind !== "chapter-loading") return prev;
      // A new game starts with the prologue; saved games and `?skip-prologue` go to the chapter.
      return getChapter(session.chapterId)?.gameplayAvailable && shouldPlayPrologue(session, window.location.search)
        ? { kind: "prologue", session }
        : { kind: "chapter", session };
    });
  }, []);

  // A new game's prologue is built behind the chapter loading screen, which stays up until the
  // neighborhood is ready and drawing steady frames. One loading screen, then the street.
  const prologueRequested =
    screen.kind === "chapter-loading" &&
    screen.request.kind === "new-game" &&
    !!getChapter(screen.request.chapterId)?.gameplayAvailable &&
    shouldPlayPrologue({ origin: "new-game" }, typeof window === "undefined" ? "" : window.location.search);
  const prologueMounted = prologueRequested || screen.kind === "prologue";
  const [prologueBuild, setPrologueBuild] = useState<PrologueBuildProgress | null>(null);
  useEffect(() => {
    if (!prologueMounted) setPrologueBuild(null);
  }, [prologueMounted]);
  const { t: tLoading } = useTranslation("loading");
  const loadingHold: LoadingHold | null = prologueRequested
    ? {
        progress: prologueBuild?.fraction ?? 0,
        stage: tLoading(`prologueStreet.${prologueBuild?.step ?? "world"}`),
        done: prologueBuild?.done ?? false,
      }
    : null;

  const handleReturnToMenu = useCallback(() => {
    setScreen({ kind: "menu" });
    setContinueAvailability(readSavedContinueAvailability());
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
  // Menu music is faded out on chapter screens; the street ambient keeps playing.
  const onMenuScreen = screen.kind === "menu";
  // The prologue world plays the same street recording itself (muffled indoors), so the menu's copy fades out.
  const inPrologue = screen.kind === "prologue";
  const onMenuScreenRef = useRef(onMenuScreen);
  onMenuScreenRef.current = onMenuScreen;

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
      const targetGain =
        settings.soundEnabled && onMenuScreenRef.current
          ? Math.max(0, Math.min(1, settings.musicVolume * 0.28))
          : 0;
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
      const targetAmbient = settings.soundEnabled && !inPrologue ? Math.max(0, Math.min(1, settings.musicVolume * 0.25)) : 0;
      if (!ambientFadedInRef.current) {
        ambientGain.gain.cancelScheduledValues(ctx.currentTime);
        ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        ambientGain.gain.linearRampToValueAtTime(targetAmbient, ctx.currentTime + 2.0);
        ambientFadedInRef.current = true;
      } else {
        ambientGain.gain.setTargetAtTime(targetAmbient, ctx.currentTime, 0.06);
      }
    }
  }, [sceneReady, showLoading, route, inPrologue, settings.soundEnabled, settings.musicVolume]);

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
    // Off the menu screen (chapter loading or chapter) the music fades to 0 over about 1 s.
    if (musicFadedInRef.current && route === "menu") {
      const targetMusic =
        settings.soundEnabled && onMenuScreen ? Math.max(0, Math.min(1, settings.musicVolume * 0.28)) : 0;
      musicGain.gain.setTargetAtTime(targetMusic, ctx.currentTime, onMenuScreen ? 0.06 : 0.3);
    }

    if (sfxGain) {
      const targetSfx = settings.soundEnabled ? Math.max(0, settings.sfxVolume * 1.5) : 0;
      sfxGain.gain.setTargetAtTime(targetSfx, ctx.currentTime, 0.06);
    }

    if (targetMaster > 0) {
      startMusicSource();
      startAmbientSource();
    }
  }, [route, onMenuScreen, settings.soundEnabled, settings.musicVolume, settings.sfxVolume, startMusicSource, startAmbientSource]);

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


  // Route: /testmove -> 3D First Person Movement & Combat Testing Playground
  if (route === "testmove") {
    return (
      <TestMovePage
        settings={settings}
        onBackToMenu={() => navigateTo("menu")}
      />
    );
  }

  // Route: /UEH or /ueh -> Procedural 3D UEH Campus with First-Person Arms Viewmodel
  if (route === "ueh") {
    return (
      <UEHPage
        settings={settings}
        onBackToMenu={() => navigateTo("menu")}
      />
    );
  }

  // Route: /hue or /HUE -> Procedural 3D Huế Heritage World (Cố Đô Huế)
  if (route === "hue") {
    return (
      <HuePage
        settings={settings}
        onBackToMenu={() => navigateTo("menu")}
      />
    );
  }

  // Route: /mientay -> Procedural 3D Mekong Delta world (Miền Tây sông nước)
  if (route === "mientay") {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-[#0b0e0c]" aria-busy="true" />}>
        <MientayPage
          settings={settings}
          onBackToMenu={() => navigateTo("menu")}
        />
      </Suspense>
    );
  }

  // Route: /khupho -> Prototype Vietnamese neighborhood (alley, tube houses, shops)
  if (route === "khupho") {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-[#0d1117]" aria-busy="true" />}>
        <KhuphoPage settings={settings} onBackToMenu={() => navigateTo("menu")} />
      </Suspense>
    );
  }

  // Route: /roomv2 -> Prototype player apartment ("After the Rain")
  if (route === "roomv2") {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-black" aria-busy="true" />}>
        <RoomV2Page settings={settings} onBackToMenu={() => navigateTo("menu")} />
      </Suspense>
    );
  }

  // Route: / -> Original Main Menu Scene & Overlay
  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#13111f]">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas
        settings={settings}
        onSceneReady={handleSceneReady}
        onSceneError={handleSceneError}
        paused={screen.kind !== "menu"}
      />

      {/* HTML / React Menu Overlay */}
      {screen.kind === "menu" && (
        <MainMenuOverlay
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onToggleSound={handleToggleSound}
          onHoverSound={playHoverSound}
          onStartNewGame={handleStartNewGame}
          onContinue={handleContinue}
          continueAvailability={continueAvailability}
        />
      )}

      {/* Same element for both screens, so the world built during loading is kept when it is revealed. */}
      {prologueMounted && (
        <div key="prologue" className="absolute inset-0 z-40">
          <Suspense fallback={<div className="h-full w-full bg-[#0d1117]" aria-busy="true" />}>
            <ProloguePage
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onBackToMenu={handleReturnToMenu}
              revealed={screen.kind === "prologue"}
              onBuildProgress={setPrologueBuild}
            />
          </Suspense>
        </div>
      )}

      {screen.kind === "chapter-loading" && (
        <ChapterLoadingFlow
          hold={loadingHold}
          request={screen.request}
          onEnterChapter={handleEnterChapter}
          onBackToMenu={handleReturnToMenu}
        />
      )}

      {/*
        A playable chapter replaces the menu. The menu canvas stays mounted and paused
        (frameloop "never") underneath, so returning to the menu needs no reload.
        A chapter without a playable scene (gameplayAvailable is false) ends at the placeholder.
      */}

      {screen.kind === "chapter" &&
        (getChapter(screen.session.chapterId)?.gameplayAvailable ? (
          <div className="absolute inset-0 z-40">
            <ChapterOnePage
              session={screen.session}
              settings={settings}
              onReturnToMenu={handleReturnToMenu}
            />
          </div>
        ) : (
          <ChapterPlaceholder session={screen.session} onBackToMenu={handleReturnToMenu} />
        ))}

      {/* Startup screen for the menu's own 3D scene */}
      {showLoading && (
        <MenuStartupLoading
          sceneReady={sceneReady}
          sceneError={sceneError}
          onFinished={handleLoadingFinished}
        />
      )}
    </div>
  );
};
