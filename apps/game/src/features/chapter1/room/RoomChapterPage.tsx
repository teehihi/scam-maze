/**
 * RoomChapterPage: the Chapter 1 page for saved games and `?skip-prologue` (task 12.4).
 * See .kiro/specs/chapter-01-double-deception/design.md, "Flow", and Requirements 1.1, 1.2, 1.3,
 * 1.5, 1.6, 17.6 and 17.7.
 *
 * It embeds `RoomV2Page` (no standby: the room starts at once) with a stable `RoomStoryBridge`
 * and mounts the same `RoomChapterLayer` that the prologue mounts after the walk home. The layer
 * owns the store, the HUD, the overlays and the checkpoint saver; a session restored by the
 * loader (`session.restored`) is replayed by the layer's store. This page adds the host pause menu
 * (Escape, settings, return to menu), which it skips while a chapter overlay is open.
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameSettings } from "@scammaze/shared-types";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { SettingsModal } from "../../menu/SettingsModal";
import { PrologueHud, ProloguePauseMenu } from "../../prologue/PrologueHud";
import type { Engine as RoomEngine, UIState as RoomUI } from "../../roomv2/game/engine";
import type { StoryNpcRuntimeContext } from "../../../game/narrative/chapter1/storyCast";
import { AnchoredPrompt } from "../hud/AnchoredPrompt";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { consumeRoomPreload, discardRoomPreload, peekReadyRoom } from "./roomPreloader";
import { RoomStoryBridge } from "./roomStoryBridge";
import { OutsideHud, useOutsideWorld } from "./useOutsideWorld";

const RoomV2Page = lazy(() => import("../../roomv2").then((module) => ({ default: module.RoomV2Page })));

export interface RoomChapterPageProps {
  session: ChapterSession;
  settings: GameSettings;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
  /** The main menu's hover blip, reused by the pause menu. */
  onHoverSound?: () => void;
  onReturnToMenu: () => void;
  /** Where checkpoints are written. Defaults to this device's local storage (the layer's default). */
  saveSource?: SaveGameSource;
}

export const RoomChapterPage: React.FC<RoomChapterPageProps> = ({
  session,
  settings,
  onUpdateSettings,
  onHoverSound,
  onReturnToMenu,
  saveSource,
}) => {
  // One bridge per page, created once, so the engine and the layer always share the same port.
  // A room built ahead on the main menu (same quality and language) is adopted; its bridge is the one
  // the engine was built with. Without one, the page builds the room itself, as before.
  const [preloaded] = useState(() => peekReadyRoom(settings.graphicsQuality === "high" ? "high" : "low", settings.language));
  const [bridge] = useState(() => preloaded?.bridge ?? new RoomStoryBridge());
  useEffect(() => {
    // Nothing to adopt: cancel a build still in progress so it cannot leave a second renderer behind.
    if (!preloaded) discardRoomPreload();
  }, [preloaded]);
  const [engineReady, setEngineReady] = useState(false);
  const [roomUI, setRoomUI] = useState<RoomUI | null>(null);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const engineRef = useRef<RoomEngine | null>(null);
  // The Saigon open world around the room: live through the window and the open door, walkable with no cut.
  const [roomEngine, setRoomEngine] = useState<RoomEngine | null>(null);
  const [storyContext, setStoryContext] = useState<Partial<StoryNpcRuntimeContext> | undefined>(undefined);
  const outside = useOutsideWorld(
    roomEngine,
    true,
    storyContext,
    (event) => bridge.transit(event),
    (npcId, replyId) => bridge.storyReply(npcId, replyId),
    (npcId) => bridge.storyStart(npcId),
  );

  // The chapter happens in the apartment, whatever scene a new or old session names.
  const layerSession = useMemo<ChapterSession>(() => ({ ...session, sceneId: "apartment" }), [session]);

  useEffect(() => {
    return () => {
      bridge.commands = null;
    };
  }, [bridge]);

  const handleReady = useCallback(
    (engine: RoomEngine) => {
      engineRef.current = engine;
      bridge.commands = engine;
      setEngineReady(true);
      setRoomEngine(engine);
    },
    [bridge],
  );

  const soundOn = settings.soundEnabled;
  useEffect(() => {
    engineRef.current?.audio.setMuted(!soundOn);
  }, [soundOn, engineReady]);

  const playing = engineReady && !!roomUI?.started && !roomUI.ended;

  const openPause = useCallback(() => {
    engineRef.current?.setCursorMode(false);
    if (document.pointerLockElement) document.exitPointerLock();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setSettingsOpen(false);
    setPaused(false);
    engineRef.current?.lock();
  }, []);

  const inStreetDialogue = Boolean(outside.outdoors && outside.storyDialogue);

  // Release pointer lock & free cursor cleanly while talking to a street Story NPC so the player
  // can both press [1]/[2]/[3] and hover/click replies without swinging the camera off the speaker.
  const prevStreetDialogueRef = useRef(false);
  useEffect(() => {
    const wasTalking = prevStreetDialogueRef.current;
    prevStreetDialogueRef.current = inStreetDialogue;
    if (inStreetDialogue && !wasTalking) {
      engineRef.current?.setCursorMode(true);
      if (document.pointerLockElement) document.exitPointerLock?.();
    } else if (!inStreetDialogue && wasTalking) {
      engineRef.current?.setCursorMode(false);
    }
  }, [inStreetDialogue]);

  // Escape closes an active outdoor NPC conversation first; otherwise opens/closes the host pause menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== "Escape") return;
      if (inStreetDialogue) {
        event.preventDefault();
        outside.closeStoryDialogue?.();
        return;
      }
      if (settingsOpen || bridge.overlayOpen()) return;
      if (paused) {
        event.preventDefault();
        resume();
      } else if (playing) {
        event.preventDefault();
        openPause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bridge, inStreetDialogue, openPause, outside, paused, playing, resume, settingsOpen]);

  const cursorMode = !!roomUI?.cursorMode;
  const showResume = playing && !paused && !inStreetDialogue && !roomUI?.locked && !cursorMode && !roomUI?.inspecting;

  return (
    <div className="absolute inset-0 bg-black" data-testid="room-chapter-page">
      <Suspense fallback={<div className="h-full w-full bg-black" aria-busy="true" />}>
        <RoomV2Page
          settings={settings}
          onBackToMenu={onReturnToMenu}
          embedded
          story={bridge}
          preloaded={preloaded?.engine}
          onAdopted={consumeRoomPreload}
          onUI={setRoomUI}
          renderPrompt={(label, anchor) => <AnchoredPrompt label={label} anchor={anchor} />}
          hideCrosshair={inStreetDialogue}
          onReady={handleReady}
          overlay={
            <RoomChapterLayer
              session={layerSession}
              settings={settings}
              bridge={bridge}
              saveSource={saveSource}
              engineReady={engineReady}
              clockPaused={paused || settingsOpen}
              onOpenSettings={openPause}
              onReturnToMenu={onReturnToMenu}
              onHoverSound={onHoverSound}
              outsideDoor={outside.ready}
              outdoors={outside.outdoors}
              outsideRadar={outside.radar ?? null}
              hideHud={inStreetDialogue}
              onStoryContext={setStoryContext}
            />
          }
        />
      </Suspense>

      {playing && !paused && !inStreetDialogue && (
        // The chapter layer draws the map, the status ring, the clock and cash itself.
        <PrologueHud objective={null} prompt={null} showResume={showResume} cursorMode={cursorMode} crosshair={false} />
      )}

      {playing && !paused && (
        <OutsideHud
          state={outside}
          suppressPrompt={Boolean(roomUI?.prompt)}
          voice={{ soundEnabled: settings.soundEnabled, englishFallback: settings.englishVoiceFallback }}
        />
      )}
      {paused && !settingsOpen && (
        <ProloguePauseMenu
          onHoverSound={onHoverSound}
          onResume={resume}
          onOpenSettings={() => setSettingsOpen(true)}
          onReturnToMenu={onReturnToMenu}
          note={null}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};
