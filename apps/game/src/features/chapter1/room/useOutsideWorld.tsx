import { useEffect, useRef, useState } from "react";
import type { Engine as RoomEngine } from "../../roomv2/game/engine";
import { attachOutsideWorld, type OutsideWorldHandle, type OutsideWorldHooks } from "./outsideWorld";
import type { ActiveStoryNpcDialogue, AmbientStreetBark } from "../../testbus/openworld/simulation/storyNpcs";
import type { CrowdReactionBark } from "../../testbus/openworld/simulation/humanPresence";
import type { WeatherPreset } from "../../testbus/openworld/world/AtmosphereSystem";
import type { TransitEvent } from "../../testbus/openworld/simulation/transit";
import { CinemaNpcHud } from "../../testbus/openworld/CinemaNpcHud";
import { DistrictArrivalBanner, StreetActionPrompt } from "../../testbus/openworld/StreetHudElements";
import type { SaigonRadarData } from "../hud/SaigonMinimap";
import type { StoryNpcRuntimeContext } from "../../../game/narrative/chapter1/storyCast";
import type { GameLocale } from "@scammaze/shared-types";
import { useGameLocale } from "../../../i18n";
import { mission02VoiceUrl } from "../voice/mission02Voice";
import { lineVoiceKey, playLineVoice, stopLineVoice } from "../device/lineVoice";

export interface OutsideWorldState {
  /** The street is live around the room (the door can open onto it). */
  ready: boolean;
  /** The player is out of the room. */
  outdoors: boolean;
  /** The street's action prompt while outside ("[E] Lên xe buýt ..."). */
  prompt: string | null;
  /** Where the player is while outside. */
  zone: string | null;
  /** District subtitle while outside (e.g. "Quận 10, TP.HCM"). */
  district?: string | null;
  /** Live weather preset outdoors. */
  weather?: WeatherPreset | null;
  /** Live Saigon GPS radar payload while outdoors (replaces indoor "No Signal" minimap). */
  radar?: SaigonRadarData | null;
  /** Active street Story NPC conversation when talking outside. */
  storyDialogue: ActiveStoryNpcDialogue | null;
  /** Ambient street callout when passing near a Story NPC. */
  ambientBark: AmbientStreetBark | null;
  /** Crowd shoulder-bump or personal-space reaction from any living pedestrian. */
  crowdReaction?: CrowdReactionBark | null;
  /** Choose a branching reply option (0..2) in active outside conversation. */
  selectStoryReply?: (index: number) => void;
  /** Close active outside conversation. */
  closeStoryDialogue?: () => void;
}

const IDLE: OutsideWorldState = {
  ready: false,
  outdoors: false,
  prompt: null,
  zone: null,
  district: null,
  weather: null,
  radar: null,
  storyDialogue: null,
  ambientBark: null,
  crowdReaction: null,
};

/**
 * Plugs the Saigon open world around a built room engine once it is running (1.2 s later, so the room's first
 * frames stay smooth). Not in tests (no WebGL). Disposed with the engine or when `enabled` turns false.
 */
export function useOutsideWorld(
  engine: RoomEngine | null,
  enabled: boolean,
  storyContext?: Partial<StoryNpcRuntimeContext>,
  onTransit?: (event: TransitEvent) => void,
  onStoryReply?: (npcId: string, replyId: string) => Partial<StoryNpcRuntimeContext> | void,
  onStoryStart?: (npcId: string) => Partial<StoryNpcRuntimeContext> | void,
  transitHost?: OutsideWorldHooks["transitHost"],
): OutsideWorldState {
  const [state, setState] = useState<OutsideWorldState>(IDLE);
  const handleRef = useRef<OutsideWorldHandle | null>(null);
  const latestCtxRef = useRef(storyContext);
  latestCtxRef.current = storyContext;
  // The route lives longer than any render, so the handler is read through a ref.
  const transitHostRef = useRef(transitHost);
  transitHostRef.current = transitHost;
  const transitRef = useRef(onTransit);
  transitRef.current = onTransit;
  const storyReplyRef = useRef(onStoryReply);
  storyReplyRef.current = onStoryReply;
  const storyStartRef = useRef(onStoryStart);
  storyStartRef.current = onStoryStart;

  useEffect(() => {
    if (handleRef.current && storyContext) {
      handleRef.current.world.setStoryContext(storyContext);
    }
  }, [
    storyContext?.elapsedMinutes,
    storyContext?.thesisProgress,
    storyContext?.fatigue,
    storyContext?.money,
    storyContext?.flags,
  ]);

  useEffect(() => {
    if (!engine || !enabled || import.meta.env.MODE === "test" || typeof engine.setOutside !== "function") return;
    let handle: OutsideWorldHandle | null = null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void attachOutsideWorld(engine, {
        onSnapshot: (snap, outdoors) => {
          setState((prev) => {
            const prompt = outdoors ? snap.prompt : null;
            const zone = outdoors ? snap.zone : null;
            const district = outdoors ? snap.district : null;
            const weather = outdoors ? snap.atmosphere.weather : null;
            const storyDialogue = outdoors ? snap.storyDialogue : null;
            const ambientBark = outdoors ? snap.ambientBark : null;
            const crowdReaction = outdoors ? snap.crowdReaction : null;
            const radar: SaigonRadarData | null = outdoors
              ? {
                  position: { x: snap.position.x, z: snap.position.z },
                  headingDeg: snap.headingDeg,
                  busPosition: snap.busPosition,
                  npcBlips: snap.npcBlips,
                  zone: snap.zone,
                  district: snap.district,
                }
              : null;

            if (
              !outdoors &&
              prev.ready &&
              !prev.outdoors &&
              prev.prompt === null &&
              prev.zone === null &&
              prev.storyDialogue === null &&
              prev.ambientBark === null &&
              prev.crowdReaction === null &&
              prev.radar === null
            ) {
              return prev;
            }
            return {
              ready: true,
              outdoors,
              prompt,
              zone,
              district,
              weather,
              radar,
              storyDialogue,
              ambientBark,
              crowdReaction,
            };
          });
        },
        transitHost: transitHostRef.current,
        onTransit: (event) => transitRef.current?.(event),
        onStoryReply: (npcId, replyId) => storyReplyRef.current?.(npcId, replyId) ?? undefined,
        onStoryStart: (npcId) => storyStartRef.current?.(npcId) ?? undefined,
      })
        .then((h) => {
          if (!h) return;
          if (cancelled) h.dispose();
          else {
            handle = h;
            handleRef.current = h;
            if (latestCtxRef.current) h.world.setStoryContext(latestCtxRef.current);
            setState((prev) => (prev.ready ? prev : { ...prev, ready: true }));
          }
        })
        .catch((error) => console.error("Outside world failed to load:", error));
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      handle?.dispose();
      handleRef.current = null;
      setState(IDLE);
    };
  }, [engine, enabled]);

  const selectStoryReply = (index: number) => {
    handleRef.current?.world.selectStoryReply(index);
  };
  const closeStoryDialogue = () => {
    handleRef.current?.world.closeStoryDialogue();
  };

  const isClosing = Boolean(state.storyDialogue?.closing);

  useEffect(() => {
    if (!state.outdoors || !state.storyDialogue) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Digit1") {
        handleRef.current?.world.selectStoryReply(0);
      } else if (e.code === "Digit2") {
        handleRef.current?.world.selectStoryReply(1);
      } else if (e.code === "Digit3") {
        handleRef.current?.world.selectStoryReply(2);
      } else if (e.code === "Escape") {
        handleRef.current?.world.closeStoryDialogue();
      } else if (e.code === "KeyE" && isClosing) {
        e.preventDefault();
        handleRef.current?.world.closeStoryDialogue();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.outdoors, Boolean(state.storyDialogue), isClosing]);

  return {
    ...state,
    selectStoryReply,
    closeStoryDialogue,
  };
}

export interface OutsideHudProps {
  state: OutsideWorldState;
  /** Suppresses the street prompt when the room door prompt is already displayed on screen. */
  suppressPrompt?: boolean;
  /** Sound settings of the chapter: the recorded street voice obeys them. */
  voice?: StreetVoiceSettings;
}

/** What the street voice needs from the player's settings. */
export interface StreetVoiceSettings {
  soundEnabled: boolean;
  englishFallback: boolean;
}

/**
 * Plays the recorded clip of the street line on screen, when the line has one. The subtitles are
 * always shown by `CinemaNpcHud`; a line without a recording simply stays silent, and a new line
 * replaces the one playing (one voice at a time).
 */
function useStreetVoice(
  dialogue: ActiveStoryNpcDialogue | null,
  ambientBark: AmbientStreetBark | null,
  locale: GameLocale,
  voice: StreetVoiceSettings | undefined,
): void {
  const soundOn = voice?.soundEnabled ?? true;
  const englishFallback = voice?.englishFallback ?? false;
  const lineKey = dialogue?.lineKey ?? null;
  const dialogueVoiceId = dialogue?.currentVoiceId ?? null;
  const barkVoiceId = dialogue === null ? (ambientBark?.voiceId ?? null) : null;

  useEffect(() => {
    if (!soundOn) return undefined;
    if (lineKey === null && barkVoiceId === null) return undefined;
    const voiceId = lineKey === null ? barkVoiceId : dialogueVoiceId;
    const clipUrl = mission02VoiceUrl(voiceId, locale, englishFallback);
    if (clipUrl === null) return undefined;
    const key = lineKey === null ? `street-bark:${voiceId}` : `street-line:${lineKey}`;
    void playLineVoice(key, "", locale, clipUrl, { synthetic: false });
    return () => {
      if (lineVoiceKey() === key) stopLineVoice();
    };
  }, [soundOn, englishFallback, locale, lineKey, dialogueVoiceId, barkVoiceId]);
}

/** Street prompt, cinematic district arrival banner, ambient/bump whispers, and cinema Story NPC dialogue while outside. */
export function OutsideHud({ state, suppressPrompt = false, voice }: OutsideHudProps) {
  const language = useGameLocale();
  const locale: GameLocale = language === "vi" ? "vi" : "en";
  useStreetVoice(state.storyDialogue, state.ambientBark, locale, voice);
  if (!state.outdoors) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[40]" data-testid="outside-hud">
      {/* Smooth GTA/RDR2-style location arrival banner (auto-fades cleanly after ~3.8s) */}
      <DistrictArrivalBanner
        zone={state.zone}
        district={state.district ?? null}
        weather={state.weather ?? null}
        hidden={Boolean(state.storyDialogue)}
      />

      {/* Unified tactile keycap interaction prompt (never overlaps door prompt or dialogue) */}
      {state.prompt && !state.storyDialogue && !suppressPrompt && (
        <StreetActionPrompt prompt={state.prompt} />
      )}

      {/* Cinema dialogue, player-line echo, speaking cadence, and pedestrian bump whispers */}
      <CinemaNpcHud
        language={language === "vi" ? "vi" : "en"}
        dialogue={state.storyDialogue}
        ambientBark={state.ambientBark}
        crowdReaction={state.crowdReaction ?? null}
        onSelectReply={state.selectStoryReply}
        onCloseDialogue={state.closeStoryDialogue}
      />
    </div>
  );
}
