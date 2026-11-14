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
import { HomeCallOverlay } from "./HomeCallOverlay";
import { GO_HOME_KEY, PrologueHud, ProloguePauseMenu } from "./PrologueHud";

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
  onBackToMenu: () => void;
  /**
   * False while the chapter loading screen still covers the page: the world is built and
   * warmed up underneath, and nothing starts (no narration) until it is revealed.
   */
  revealed: boolean;
  onBuildProgress?: (progress: PrologueBuildProgress) => void;
}

/** Minimum time the "walking home" screen stays up, so the cut is never a flash. */
const HOME_LOADING_MIN_MS = 1800;

/** The neighborhood has no phone, journal or pause menu entry in the intro list yet. */
const PROLOGUE_CONTROLS: readonly IntroControlId[] = ["move", "look", "interact", "pause"];

/**
 * Chapter 1 prologue: explore the neighborhood until it gets dark and starts to rain, then walk
 * home to the apartment. This page owns the whole interface, in the chapter's style; the two
 * world pages only draw the 3D view.
 */
export const ProloguePage: React.FC<ProloguePageProps> = ({ settings, onBackToMenu, revealed, onBuildProgress }) => {
  const { t, i18n } = useTranslation(["worlds", "loading"]);
  const [stage, setStage] = useState<Stage>("neighborhood");
  const [worldReady, setWorldReady] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [headingHome, setHeadingHome] = useState(false);
  const [roomChunk, setRoomChunk] = useState(false);
  const [hands, setHands] = useState(false);
  const [roomBuilt, setRoomBuilt] = useState(false);
  const [roomUI, setRoomUI] = useState<RoomUI | null>(null);
  const streetRef = useRef<StreetEngine | null>(null);
  const roomRef = useRef<RoomEngine | null>(null);
  const prefetchRef = useRef<Promise<void> | null>(null);
  const goneHome = useRef(false);
  const progressRef = useRef(onBuildProgress);
  progressRef.current = onBuildProgress;

  const minElapsed = useMinimumDisplayTime(HOME_LOADING_MIN_MS, stage);

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

  const goHome = useCallback(() => {
    if (goneHome.current) return;
    goneHome.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    setCallOpen(false);
    setPaused(false);
    void prefetchRoom();
    setStage("room");
  }, [prefetchRoom]);

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
  }, []);

  const beginWalk = useCallback(() => {
    const engine = streetRef.current;
    if (!engine) return;
    engine.begin(true);
    setStarted(true);
    void prefetchRoom();
  }, [prefetchRoom]);

  const stayOutside = useCallback(() => {
    setCallOpen(false);
    streetRef.current?.setInputBlocked(false);
    streetRef.current?.lock();
  }, []);

  const openPause = useCallback(() => {
    setPaused(true);
    streetRef.current?.setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  const resume = useCallback(() => {
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
  }, [paused, playingStreet, playingRoom, resume, openPause, goHome]);

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
  const gain = voiceGain({ soundEnabled: settings.soundEnabled, masterVolume: settings.sfxVolume, voiceVolume: settings.voiceVolume }, false);

  const tips = LOADING_TIP_IDS.map((id) => t(`loading:tips.${id}`));
  const done = [roomChunk, hands, roomBuilt].filter(Boolean).length;
  const roomStage = !roomChunk
    ? t("loading:prologueHome.stage.room")
    : !hands
      ? t("loading:prologueHome.stage.hands")
      : !roomBuilt
        ? t("loading:prologueHome.stage.build")
        : t("loading:prologueHome.stage.ready");
  const showRoomLoading = stage === "room" && !(roomBuilt && minElapsed);

  const showResume =
    !paused && ((playingStreet && !locked) || (playingRoom && !roomUI?.locked && !roomUI?.inspecting));

  return (
    <div className="absolute inset-0 bg-black">
      {stage === "neighborhood" && (
        <>
          <KhuphoStoryWorld
            settings={settings}
            onProgress={handleProgress}
            onReady={handleReady}
            onHud={handleHud}
            onStory={handleStory}
            onError={handleError}
          />
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
              onGoHome={goHome}
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

      {stage === "room" && (
        <>
          <Suspense fallback={null}>
            <RoomV2Page
              settings={settings}
              onBackToMenu={onBackToMenu}
              embedded
              onUI={setRoomUI}
              onReady={(engine) => {
                roomRef.current = engine;
                setRoomBuilt(true);
              }}
            />
          </Suspense>
          {playingRoom && !paused && showResume && <PrologueHud objective={null} prompt={null} showResume />}
        </>
      )}

      {paused && <ProloguePauseMenu onResume={resume} onReturnToMenu={onBackToMenu} />}

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
