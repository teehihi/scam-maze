import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { SceneTransition } from "../../components/ui/SceneTransition";
import { LOADING_TIP_IDS } from "../../config/loadingTips";
import { voiceGain } from "../../game/voice/mixPlan";
import { CharacterAssetCache } from "../player/runtime/CharacterAssetCache";
import { useMinimumDisplayTime } from "../loading/useMinimumDisplayTime";
import { ChapterIntroOverlay, type IntroControlId } from "../chapter1/intro/ChapterIntroOverlay";
import { KhuphoStoryWorld } from "../khupho/KhuphoStoryWorld";
import { BUILD_STEPS, type BuildStep, type Engine as StreetEngine, type Hud, type StoryEvent } from "../khupho/world/engine";
import type { Engine as RoomEngine, UIState as RoomUI } from "../roomv2/game/engine";
import type { RoomOptions } from "../roomv2/game/outside";
import { HomeCallOverlay } from "./HomeCallOverlay";
import { GO_HOME_KEY, PrologueHud, ProloguePauseMenu, PrologueTopBar } from "./PrologueHud";
import { SettingsModal } from "../menu/SettingsModal";

// The room is its own chunk, downloaded in the background while the player walks around.
const loadRoomModule = () => import("../roomv2");
const RoomV2Page = lazy(() => loadRoomModule().then((module) => ({ default: module.RoomV2Page })));

type Stage = "neighborhood" | "room";

/** Progress of building the neighborhood, shown on the chapter loading screen. */
export interface PrologueBuildProgress {
  /** 0..1 */
  fraction: number;
  step: BuildStep;
  done: boolean;
  error?: string;
}

interface ProloguePageProps {
  settings: GameSettings;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
  /** The main menu's hover blip, reused by the in-game menus. */
  onHoverSound?: () => void;
  onBackToMenu: () => void;
  /**
   * False while the chapter loading screen still covers the page: the world is built and
   * warmed up underneath, and nothing starts (no narration) until it is revealed.
   */
  revealed: boolean;
  onBuildProgress?: (progress: PrologueBuildProgress) => void;
}

/** White doorway into the room: how long the screen takes to white out, and to clear again on the other side. */
const WHITE_IN_MS = 150;
const WHITE_OUT_MS = 700;
/** The room is built this long after the walk begins (and sooner when the player nears house no. 59). */
const ROOM_BUILD_DELAY_MS = 1500;
/** Minimum time the "walking home" screen stays up, so the cut is never a flash. */
const HOME_LOADING_MIN_MS = 1800;

/** The neighborhood has no phone, journal or pause menu entry in the intro list yet. */
const PROLOGUE_CONTROLS: readonly IntroControlId[] = ["move", "look", "interact", "pause"];

/**
 * Chapter 1 prologue: explore the neighborhood until it gets dark and starts to rain, then walk
 * home to the apartment. This page owns the whole interface, in the chapter's style; the two
 * world pages only draw the 3D view.
 */
export const ProloguePage: React.FC<ProloguePageProps> = ({ settings, onUpdateSettings, onHoverSound, onBackToMenu, revealed, onBuildProgress }) => {
  const { t, i18n } = useTranslation(["worlds", "loading"]);
  const [stage, setStage] = useState<Stage>("neighborhood");
  const [worldReady, setWorldReady] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [streetHud, setStreetHud] = useState<Hud | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [headingHome, setHeadingHome] = useState(false);
  const [roomChunk, setRoomChunk] = useState(false);
  const [hands, setHands] = useState(false);
  const [roomBuilt, setRoomBuilt] = useState(false);
  const [roomUI, setRoomUI] = useState<RoomUI | null>(null);
  /** The room is built in standby (no loop, shaders compiled) once the walk begins, and shown through the white doorway or by "go home". */
  const [roomOptions, setRoomOptions] = useState<RoomOptions | null>(null);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [white, setWhite] = useState({ on: false, ms: WHITE_IN_MS });
  const pendingEnter = useRef(false);
  const streetRef = useRef<StreetEngine | null>(null);
  const roomRef = useRef<RoomEngine | null>(null);
  const prefetchRef = useRef<Promise<void> | null>(null);
  const goneHome = useRef(false);
  const progressRef = useRef(onBuildProgress);
  progressRef.current = onBuildProgress;
  const soundRef = useRef(settings.soundEnabled);
  soundRef.current = settings.soundEnabled;

  const minElapsed = useMinimumDisplayTime(HOME_LOADING_MIN_MS, waitingRoom);

  // Pointer lock state, for the "click to resume" hint.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  /** Downloads the room code and the first-person hands (idempotent). */
  const prefetchRoom = useCallback(() => {
    if (!prefetchRef.current) {
      prefetchRef.current = Promise.all([
        loadRoomModule().then(() => setRoomChunk(true)),
        CharacterAssetCache.loadArmsModel().then(() => setHands(true)),
      ])
        .then(() => undefined)
        // A failed prefetch is not fatal: the room asks for the same files again when it opens.
        .catch(() => undefined);
    }
    return prefetchRef.current;
  }, []);

  /** Builds the room in standby (idempotent): everything is compiled before the player needs it. */
  const mountRoom = useCallback(() => {
    setRoomOptions((current) => current ?? {
      standby: true,
      onExitStart: () => setWhite({ on: true, ms: 500 }),
      onExit: () => leaveRoomRef.current(),
    });
    void prefetchRoom();
  }, [prefetchRoom]);

  /** The screen is white: swap the street for the room. False while the room is still being built. */
  const showRoom = useCallback(() => {
    const street = streetRef.current;
    const room = roomRef.current;
    if (!street || !room) return false;
    pendingEnter.current = false;
    setWaitingRoom(false);
    street.suspend();
    room.audio.setMuted(!soundRef.current);
    room.activate();
    setStage("room");
    window.setTimeout(() => setWhite({ on: false, ms: WHITE_OUT_MS }), 60);
    return true;
  }, []);
  const showRoomRef = useRef(showRoom);
  showRoomRef.current = showRoom;

  /** Into the room: through the white doorway of house no. 59, or by "go home" (the call, the H key). */
  const goHome = useCallback(() => {
    if (goneHome.current) return;
    goneHome.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    streetRef.current?.setInputBlocked(true);
    setCallOpen(false);
    setPaused(false);
    mountRoom();
    setWhite({ on: true, ms: WHITE_IN_MS });
    window.setTimeout(() => {
      if (showRoomRef.current()) return;
      // Pressed before the room was built: the walking-home screen covers the wait.
      pendingEnter.current = true;
      setWaitingRoom(true);
    }, WHITE_IN_MS + 30);
  }, [mountRoom]);

  /** Out of the room by its door: the player stands in the hall outside it, the screen clears from white. */
  const leaveRoom = useCallback(() => {
    const street = streetRef.current;
    roomRef.current?.deactivate();
    setStage("neighborhood");
    setRoomUI(null);
    street?.placeAtHome();
    street?.setInputBlocked(false);
    street?.resume();
    street?.audio.setMuted(!soundRef.current);
    goneHome.current = false;
    window.setTimeout(() => street?.lock(), 150);
    window.setTimeout(() => setWhite({ on: false, ms: WHITE_OUT_MS }), 120);
  }, []);
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  const handleStory = useCallback((event: StoryEvent) => {
    if (event !== "callHome") return;
    streetRef.current?.setInputBlocked(true);
    // The call has buttons, so the pointer must be free.
    if (document.pointerLockElement) document.exitPointerLock();
    setCallOpen(true);
    setHeadingHome(true);
  }, []);

  const handleHud = useCallback((hud: Hud) => {
    setPrompt(hud.prompt);
    setStreetHud(hud);
  }, []);

  // The sound setting mutes both worlds' own audio (they do not read the settings themselves).
  const soundOn = settings.soundEnabled;
  useEffect(() => {
    streetRef.current?.audio.setMuted(!soundOn);
    roomRef.current?.audio.setMuted(!soundOn);
  }, [soundOn, worldReady, roomBuilt]);
  const toggleSound = useCallback(() => onUpdateSettings({ soundEnabled: !soundOn }), [onUpdateSettings, soundOn]);

  const beginWalk = useCallback(() => {
    const engine = streetRef.current;
    if (!engine) return;
    engine.begin(true);
    setStarted(true);
    void prefetchRoom();
  }, [prefetchRoom]);

  // The room is built a moment after the walk begins, so opening its door finds it ready.
  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(mountRoom, ROOM_BUILD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [started, mountRoom]);

  const stayOutside = useCallback(() => {
    setCallOpen(false);
    streetRef.current?.setInputBlocked(false);
    streetRef.current?.lock();
  }, []);

  const openPause = useCallback(() => {
    if (stage === "room") roomRef.current?.setCursorMode(false);
    setPaused(true);
    streetRef.current?.setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  const resume = useCallback(() => {
    setSettingsOpen(false);
    setPaused(false);
    if (stage === "neighborhood") {
      streetRef.current?.setPaused(false);
      streetRef.current?.lock();
    } else {
      roomRef.current?.lock();
    }
  }, [stage]);

  const playingStreet = stage === "neighborhood" && started && !callOpen;
  const playingRoom = stage === "room" && roomBuilt && !!roomUI?.started && !roomUI.ended;

  // Escape opens and closes the pause menu; H heads home.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape") {
        if (settingsOpen) return; // the settings dialog closes itself
        if (paused) {
          event.preventDefault();
          resume();
        } else if (playingStreet || playingRoom) {
          event.preventDefault();
          openPause();
        }
        return;
      }
      if (event.code === `Key${GO_HOME_KEY}` && playingStreet && !paused && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        goHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, settingsOpen, playingStreet, playingRoom, resume, openPause, goHome]);

  const handleProgress = useCallback((step: BuildStep, fraction: number) => {
    const index = BUILD_STEPS.indexOf(step);
    progressRef.current?.({ fraction: Math.min(0.99, (index + fraction) / BUILD_STEPS.length), step, done: false });
  }, []);

  const handleReady = useCallback((engine: StreetEngine) => {
    streetRef.current = engine;
    setWorldReady(true);
    progressRef.current?.({ fraction: 1, step: "warmup", done: true });
  }, []);

  const handleError = useCallback((message: string) => {
    setWorldError(message);
    progressRef.current?.({ fraction: 1, step: "warmup", done: true, error: message });
  }, []);

  const locale = i18n.language === "vi" ? "vi" : "en";
  // Narration must stay clear over the rain: a 1.6x boost (capped at full volume) while the world is ducked below.
  const gain = Math.min(1, 1.6 * voiceGain({ soundEnabled: settings.soundEnabled, masterVolume: settings.sfxVolume, voiceVolume: settings.voiceVolume }, false));
  const narrating = stage === "neighborhood" && revealed && worldReady && (!started || callOpen);
  useEffect(() => {
    streetRef.current?.audio.setDuck(narrating);
  }, [narrating, worldReady]);

  const tips = LOADING_TIP_IDS.map((id) => t(`loading:tips.${id}`));
  const done = [roomChunk, hands, roomBuilt].filter(Boolean).length;
  const roomStage = !roomChunk
    ? t("loading:prologueHome.stage.room")
    : !hands
      ? t("loading:prologueHome.stage.hands")
      : !roomBuilt
        ? t("loading:prologueHome.stage.build")
        : t("loading:prologueHome.stage.ready");
  const showRoomLoading = waitingRoom && !(roomBuilt && minElapsed);

  const streetCursor = !!streetHud?.cursorMode;
  const roomCursor = !!roomUI?.cursorMode;
  const showResume =
    !paused &&
    ((playingStreet && !locked && !streetCursor) || (playingRoom && !roomUI?.locked && !roomCursor && !roomUI?.inspecting));
  const clock = streetHud
    ? { time: streetHud.time, detail: [streetHud.weather, streetHud.loc].filter(Boolean).join(" · "), raining: streetHud.rain > 0.3 }
    : null;
  const inGame = (stage === "neighborhood" && revealed && worldReady && started) || (stage === "room" && roomBuilt && !showRoomLoading);

  return (
    <div className="absolute inset-0 bg-black">
      {/* The street stays mounted (stopped while the player is in the room), so coming back needs no rebuild. */}
      <KhuphoStoryWorld
        settings={settings}
        onProgress={handleProgress}
        onReady={handleReady}
        onHud={handleHud}
        onStory={handleStory}
        onError={handleError}
        onNearHome={mountRoom}
        onEnterHome={goHome}
      />
      {stage === "neighborhood" && (
        <>
          {revealed && worldReady && !started && (
            <ChapterIntroOverlay
              ready
              mode="begin"
              voiceGain={gain}
              onBegin={beginWalk}
              controlIds={PROLOGUE_CONTROLS}
            />
          )}
          {revealed && worldReady && started && !callOpen && !paused && (
            <PrologueHud
              objective={headingHome ? t("worlds:khupho.game.story.objectiveHome") : t("worlds:khupho.game.story.objectiveExplore")}
              prompt={prompt}
              showResume={showResume}
              cursorMode={streetCursor}
              clock={clock}
              onGoHome={goHome}
              onHoverSound={onHoverSound}
            />
          )}
          {callOpen && <HomeCallOverlay locale={locale} voiceGain={gain} onGoHome={goHome} onStay={stayOutside} />}
          {revealed && worldError && (
            <div role="alert" className="absolute inset-0 z-[70] grid place-items-center bg-[#171521] p-8 text-center text-[#f7f5ff]">
              <div className="max-w-md space-y-4">
                <p>{t("worlds:khupho.game.story.worldError")}</p>
                <button type="button" onClick={onBackToMenu} className="rounded-xl border border-[#38344f] px-4 py-2 text-sm hover:border-[#7654d6]">
                  {t("worlds:khupho.game.story.returnToMenu")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {roomOptions && (
        // Built in standby and kept: hidden, not removed, so it keeps its size and its compiled shaders.
        <div className={`absolute inset-0 z-30 ${stage === "room" ? "" : "invisible pointer-events-none"}`}>
          <Suspense fallback={null}>
            <RoomV2Page
              settings={settings}
              onBackToMenu={onBackToMenu}
              embedded
              options={roomOptions}
              onUI={setRoomUI}
              onReady={(engine) => {
                roomRef.current = engine;
                setRoomBuilt(true);
                if (pendingEnter.current) showRoomRef.current();
              }}
            />
          </Suspense>
        </div>
      )}
      {stage === "room" && playingRoom && !paused && <PrologueHud objective={null} prompt={null} showResume={showResume} cursorMode={roomCursor} crosshair={false} />}

      {inGame && !callOpen && !paused && (
        <PrologueTopBar soundEnabled={soundOn} onToggleSound={toggleSound} onOpenSettings={openPause} onHoverSound={onHoverSound} />
      )}

      {paused && !settingsOpen && <ProloguePauseMenu onHoverSound={onHoverSound} onResume={resume} onOpenSettings={() => setSettingsOpen(true)} onReturnToMenu={onBackToMenu} />}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onUpdateSettings={onUpdateSettings} />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[72] bg-white" style={{ opacity: white.on ? 1 : 0, transition: `opacity ${white.ms}ms ease` }} />

      {showRoomLoading && (
        <SceneTransition visible fadeIn className="z-[70]">
          <LoadingScreen
            eyebrow={t("loading:prologueHome.eyebrow")}
            chapterTitle={t("loading:prologueHome.title")}
            subtitle={t("loading:prologueHome.subtitle")}
            loadingStage={roomStage}
            progress={done / 3}
            tips={tips}
          />
        </SceneTransition>
      )}
    </div>
  );
};
