import { chapterTransit } from "./chapterTransit";
/**
 * RoomChapterLayer (base): the overlay controller of the Room v2 chapter.
 * See .kiro/specs/chapter-01-double-deception/design.md, "RoomChapterLayer responsibilities", and
 * Requirements 1.2, 2.3, 2.4, 12.6, 15.5, 15.6, 17.6, 22.2.
 *
 * It is rendered as the `overlay` of `RoomV2Page`. It owns the Chapter_Store, the overlay stack,
 * the HUD and the checkpoint saver. It reads the engine only through the `RoomStoryBridge` (the
 * engine calls the bridge; the layer attaches handlers) and writes story state only with
 * `store.dispatch`. Presentation commands come from `roomPresentation` and are sent as diffs.
 *
 * Not here (extension points for later tasks): the call UI, voice and narration playback (task
 * 10.2) and the decision panel, ending and debrief (task 10.3). Hosts add them through
 * `renderExtension` (rendered inside the overlay layer, with the store, the scenario and the stack
 * helpers), `extensionBlocking` (true while an extension overlay is open), `onOpenDecision` and
 * `onIntroBegin`.
 *
 * Timers: there are no timers for story pacing. Calls ring when `selectRingableCall` returns a
 * call and the room is free. The only delay is `ringSettleMs`, a presentation beat of a few
 * hundred milliseconds between "the room became free" and "the phone rings", so the ring does not
 * land on the same frame in which the intro or an overlay closes. It is cancelled when the room
 * stops being free, and 0 disables it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, NotebookText, PhoneIncoming, PhoneMissed, Save, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ClaimId, DeductionId, DeviceActionId, EvidenceId, InteractableId, ObjectiveId } from "../../../game/narrative/chapter1/ids";
import { ACTIVE_SCENARIO } from "../../../game/narrative/activeScenario";
import { createInitialState } from "../../../game/narrative/reducer";
import {
  selectActiveObjectives,
  selectClaimStatuses,
  selectCombinationOptions,
  selectDecisionPanel,
  selectDialogueView,
  selectJournalEntries,
  selectLaptopView,
  selectPhoneMessages,
  selectPhoneRecords,
  selectRingableCall,
} from "../../../game/narrative/selectors";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction, Objective, ScenarioDefinition } from "../../../game/narrative/types";
import { createLocalStorageSaveSource, type SaveGameSource, type SavedPlayerPose } from "../../../game/saves/saveGame";
import type { AudioPort } from "../../../game/voice/audioPort";
import { effectivePauseMs, voiceGain } from "../../../game/voice/mixPlan";
import { createWebAudioEngine, type WebAudioEngine } from "../../../game/voice/webAudioEngine";
import { INTRO_SEQUENCE, INTRO_TYPING_MS } from "../../../game/narrative/chapter1/dialogues/intro";
import { formatNumber } from "../../../i18n/format";
import { useDisplayScenario } from "../../../i18n/narrative";
import { useGameLocale } from "../../../i18n/useGameLocale";
import type { RoomPropId } from "../../roomv2/game/outside";
import { createPhoneScreenSink, type PhoneScreenSink } from "../call/phoneScreenSink";
import { ComfortProvider } from "../comfort/ComfortProvider";
import { focusDialogStart, topDialog, trapTabKey } from "../focusTrap";
import { EvidenceNotice } from "../hud/EvidenceNotice";
import { ObjectiveToast, type ObjectiveChangeKind } from "../hud/ObjectiveToast";
import { ObjectiveTracker } from "../hud/ObjectiveTracker";
import { ChapterStatusCluster, ChapterTaskButton, ChapterTopBar } from "../hud/ChapterStatusHud";
import type { SaigonRadarData } from "../hud/SaigonMinimap";
import { TaskListPanel } from "../hud/TaskListPanel";
import { TaskMarker, type TaskMarkerSource } from "../hud/TaskMarker";
import { TaskTracker } from "../hud/TaskTracker";
import { hudOffset, hudScaleStyle, useHudScale } from "../hud/hudScale";
import { KEYCAP, KEYCAP_HOVER, SHADOW } from "../../prologue/PrologueHud";
import { Mission01VoiceCaption } from "../voice/Mission01VoiceCaption";
import { useMission01Voice, type VoiceView } from "../voice/useMission01Voice";
import type { BrowserState } from "./desktop/browser/browserState";
import { setLineVoiceHeld } from "../device/lineVoice";
import { useLineVoiceActive } from "../device/useLineVoice";
import { effectiveWorkMinutes, fatigueLevel, workSlowdown } from "../../../game/narrative/fatigue";
import { EventArrivalNotice } from "../hud/EventArrivalNotice";
import { PlannerOverlay } from "../world/PlannerOverlay";
import { DeviceApp } from "../device/DeviceApp";
import { deviceAppEntries } from "../device/deviceApps";
import { selectDeviceView } from "../../../game/narrative/device";
import type { StoryNpcRuntimeContext } from "../../../game/narrative/chapter1/storyCast";
import { ThesisPanel, type ThesisPanelProps } from "../world/ThesisPanel";
import { useWorldClock } from "../world/useWorldClock";
import { elapsedMinutes, gameplayConfig, selectClosedMissions, selectOpenMissions, selectPendingEvents, selectThesisView } from "../../../game/narrative/world";
import { CHAPTER_PROTAGONIST, CHAPTER_1_INITIAL_STATE, simulatedClock } from "../../../game/narrative/resources";
import { setGameClockOverride } from "../../../game/clock/gameClock";
import { SaveFailureNotice } from "../hud/SaveFailureNotice";
import { SaveTrimmedNotice } from "../hud/SaveTrimmedNotice";
import { ChapterIntroOverlay } from "../intro/ChapterIntroOverlay";
import type { NarrationLine } from "../intro/useIntroNarration";
import { EvidenceJournal } from "../journal/EvidenceJournal";
import { relatedDeductionStatements } from "../journal/relatedDeductions";
import { EMPTY_OVERLAYS, isOpen, pop, push, top, type Overlay, type OverlayKind, type OverlayStack } from "../overlays";
import { PhoneOverlay } from "../phone/PhoneOverlay";
import { CINE } from "../theme";
import { MovementHints } from "../hud/MovementHints";
import { deriveUiMode } from "./uiMode";
import { useChapterState } from "../useChapterState";
import { useCheckpointSaver } from "../useCheckpointSaver";
import type { VoicePlaybackDeps } from "../voice/useVoicePlayback";
import { BankApp } from "./laptop/BankApp";
import { CompareView } from "./laptop/CompareView";
import { LaptopOverlay, type LaptopExtraTab } from "./laptop/LaptopOverlay";
import { LaptopDesktop } from "./desktop/LaptopDesktop";
import { BrowserApp } from "./desktop/browser/BrowserApp";
import { MailClient } from "./desktop/apps/MailClient";
import { BankingApp } from "./desktop/banking/BankingApp";
import { FilesApp } from "./desktop/files/FilesApp";
import { CalendarApp } from "./desktop/calendar/CalendarApp";
import { DRAFT_TASK_ID, ThesisWindow } from "./desktop/thesis/ThesisWindow";
import { DECLINE_ACTION } from "./incomingCall";
import { INCOMING_RING_TIMEOUT_MS, useIncomingCall } from "./useIncomingCall";
import type { ThesisWritingHost } from "./desktop/thesis/writing/WritingMode";
import type { WritingDraft } from "./desktop/thesis/writing/writingSprints";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { effectiveReducedMotion } from "../comfort/ComfortProvider";
import { selectBlockedTransfers } from "../../../game/narrative/blocked";
import { BROWSER_APP_ID, type DesktopState } from "./desktop/desktopState";
import { ReviewSecurityPage } from "./laptop/ReviewSecurityPage";
import { ScreenQuadContext, type ScreenQuadSource } from "./useScreenQuad";
import { buildBankAppView, buildCompareViewModel, buildReviewSecurityView } from "./laptop/laptopView";
import {
  applyPresentation,
  roomPresentation,
  type LaptopFrameKeys,
  type PresentationSink,
  type RoomPresentation,
} from "./roomPresentation";
import { RoomCallLayer } from "./RoomCallLayer";
import { doorForcedOpen } from "./outsideWorld";
import { RoomEndingLayer } from "./RoomEndingLayer";
import { RoomPhoneModelLayer, detectPhoneModelSupport } from "./RoomPhoneModelLayer";
import type { RoomStoryBridge } from "./roomStoryBridge";
import { useNarrationPlayback, type NarrationSequence } from "./useNarrationPlayback";

/** Presentation beat before the first ring after the room became free. Not story pacing. */
export const DEFAULT_RING_SETTLE_MS = 600;

/** Overlays that Escape never closes. */
const ESCAPE_LOCKED: ReadonlySet<OverlayKind> = new Set(["ending", "debrief", "call"]);

/** Room props that run an authored interaction with `INTERACT_OBJECT`. */
const PROP_TO_OBJECT: Partial<Record<RoomPropId, InteractableId>> = {
  note: "obj.note",
  receipts: "obj.receipts",
  calendar: "obj.calendar",
};

const INTRO_CONTROLS = ["move", "look", "interact", "journal", "schedule"] as const;

/** Brings up the carried phone. */
const PHONE_KEY = "P";
/** A notice that stays until its state changes (the ringing call). */
const NOOP = () => undefined;
/** Top of the call notices while the Writing Mode panel is open (it spans about 72 to 200 px). */
const WRITING_NOTICE_TOP_PX = 214;
/** Unified cinema keybind rail item matching PrologueHud & ChapterStatusHud (no clashing web-app pill chrome). */
const HUD_CHIP_CLASS =
  `group relative flex items-center gap-2 rounded-md border border-transparent px-2 py-1 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-[#f3efe4]/90 ${SHADOW} transition-all duration-150 hover:border-white/15 hover:bg-black/40 hover:text-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5]`;
const HUD_CHIP_STYLE = { fontSize: CINE.fontPx.small } as const;

export interface RoomLayerApi {
  store: ChapterStore;
  /** Display scenario for the current language. */
  scenario: ScenarioDefinition;
  overlays: OverlayStack;
  /** Pushes an overlay. Refused (false) while another overlay is open, unless `stack` is true. */
  openOverlay: (overlay: Overlay, options?: { stack?: boolean }) => boolean;
  removeOverlay: (kind: OverlayKind) => void;
  closeTop: () => void;
  /** Writes a checkpoint now (only while playing and no call is in progress). */
  saveNow: () => boolean;
  introOpen: boolean;
}

export interface RoomChapterLayerProps {
  session: ChapterSession;
  settings: GameSettings;
  /** The bridge that was passed to the engine as `RoomOptions.story`. */
  bridge: RoomStoryBridge;
  /** Where checkpoints are written. Defaults to this device's local storage. */
  saveSource?: SaveGameSource;
  /**
   * True once `bridge.commands` is set (the host's `onReady`). The intro waits for it, and the
   * presentation is sent in full when it turns true.
   */
  engineReady?: boolean;
  /** See the file comment. Default `DEFAULT_RING_SETTLE_MS`. */
  ringSettleMs?: number;
  /** Called once with the store (hosts and tests use it to read state). */
  onStoreReady?: (store: ChapterStore) => void;
  /** Called when the player begins, after `START_CHAPTER` (task 10.2 unlocks audio here). */
  onIntroBegin?: () => void;
  /** Called when the player asks to decide from the journal. The layer opens the decision panel itself. */
  onOpenDecision?: () => void;
  /** Called by "Return to menu" on the debrief. */
  onReturnToMenu?: () => void;
  /** Plays the hover sound (the call's reply highlight). */
  onHoverSound?: () => void;
  /** True while an extension overlay (call, decision, ending, debrief) is open. Blocks rings. */
  extensionBlocking?: boolean;
  /** Rendered inside the overlay layer. */
  renderExtension?: (api: RoomLayerApi) => React.ReactNode;
  /**
   * Test seam for the voice player (call voice and narration). When set, no Web Audio engine is
   * created and the call sounds are off. Default: one shared Web Audio engine per mount.
   */
  voiceDeps?: VoicePlaybackDeps;
  /**
   * Task 10.4: the 3D phone model may show the call screen. Default: true only when WebGL 2
   * starts and the model did not fail earlier in this session; false uses the 2D screen. A model
   * load failure or a lost WebGL context switches it off for the call regardless of this prop.
   */
  modelAllowed?: boolean;
  /** Task 10.4: the sink the 3D phone layer publishes to. Default: a private sink. */
  phoneScreenSink?: PhoneScreenSink;
  /** True while the host shows its own pause menu or settings: the free-roam clock stops. */
  clockPaused?: boolean;
  /** Opens the host's pause menu (with Settings). Shows the settings button in the top-right corner. */
  onOpenSettings?: () => void;
  /**
   * The front door leads out to the street (the Chapter 1 page with the Saigon open world). It opens whenever no
   * call or overlay is running. Without it the door stays locked until the chapter is finished (the prologue).
   */
  outsideDoor?: boolean;
  /** True while the player has walked outside Room 6.07 onto Saigon streets. */
  outdoors?: boolean;
  /** Live rotating Saigon GPS radar telemetry while outdoors (replaces indoor standby disc). */
  outsideRadar?: SaigonRadarData | null;
  /** Hides room HUD overlays (mission list, bottom chips, top bar) during immersive street conversations. */
  hideHud?: boolean;
  /** Publishes live narrative state to the surrounding Saigon 3D Story NPCs. */
  onStoryContext?: (ctx: Partial<StoryNpcRuntimeContext>) => void;
}

const INTRO_NARRATION: NarrationSequence = { graphId: "dlg.intro", nodeIds: INTRO_SEQUENCE };

/** A port view whose `dispose` does nothing, so a second player can share an engine it does not own. */
function nonOwningPort(port: AudioPort): AudioPort {
  return {
    get supported() {
      return port.supported;
    },
    resume: () => port.resume(),
    load: (url) => port.load(url),
    start: (clip, options) => port.start(clip, options),
    dispose: () => undefined,
  };
}

type Announcement =
  | { key: number; kind: "notification" }
  | { key: number; kind: "evidence"; evidenceId: EvidenceId }
  | { key: number; kind: "deduction"; deductionId: DeductionId };

interface ToastItem {
  key: number;
  kind: ObjectiveChangeKind;
  objectiveId: ObjectiveId;
}

interface NoticeItem {
  key: number;
  evidenceId: EvidenceId;
}

/** True while a call rings or is active and the chapter has no outcome yet. */
function callInProgress(state: ChapterState): boolean {
  if (state.outcome !== null) return false;
  return state.call.status === "ringing" || state.call.current !== null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Collects objective changes, new evidence, new deductions and the notification delivery since the
 * last seen state. Starts at the current state, so restored history is not announced again.
 */
function useHudNotices(store: ChapterStore) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [completed, setCompleted] = useState<ObjectiveId | null>(null);

  useEffect(() => {
    const initial = store.getState();
    let seenEvents = initial.events.length;
    let seenEvidence = initial.discovered.length;
    let seenDeductions = initial.deductions.length;
    let delivered = initial.flags.notification_delivered === true;
    let nextKey = 0;

    return store.subscribe(() => {
      const state = store.getState();
      // `replace` (restart) can shorten the log: drop queued items and count again from there.
      if (state.events.length < seenEvents || state.discovered.length < seenEvidence) {
        seenEvents = Math.min(seenEvents, state.events.length);
        seenEvidence = Math.min(seenEvidence, state.discovered.length);
        seenDeductions = Math.min(seenDeductions, state.deductions.length);
        delivered = state.flags.notification_delivered === true;
        setToasts([]);
        setNotices([]);
        setAnnouncements([]);
        setCompleted(null);
      }

      const newToasts: ToastItem[] = [];
      for (const event of state.events.slice(seenEvents)) {
        for (const id of event.derived.objectivesCompleted) newToasts.push({ key: nextKey++, kind: "completed", objectiveId: id });
        for (const id of event.derived.objectivesActivated) newToasts.push({ key: nextKey++, kind: "activated", objectiveId: id });
      }
      seenEvents = state.events.length;

      const newEvidence = state.discovered.slice(seenEvidence);
      seenEvidence = state.discovered.length;
      const newDeductions = state.deductions.slice(seenDeductions);
      seenDeductions = state.deductions.length;
      const nowDelivered = state.flags.notification_delivered === true;
      const batch: Announcement[] = [];
      if (nowDelivered && !delivered) batch.push({ key: nextKey++, kind: "notification" });
      delivered = nowDelivered;
      for (const evidenceId of newEvidence) batch.push({ key: nextKey++, kind: "evidence", evidenceId });
      for (const deductionId of newDeductions) batch.push({ key: nextKey++, kind: "deduction", deductionId });

      if (newToasts.length > 0) {
        setToasts((queue) => [...queue, ...newToasts]);
        const lastCompleted = [...newToasts].reverse().find((toast) => toast.kind === "completed");
        if (lastCompleted) setCompleted(lastCompleted.objectiveId);
      }
      if (newEvidence.length > 0) setNotices((queue) => [...queue, ...newEvidence.map((evidenceId) => ({ key: nextKey++, evidenceId }))]);
      if (batch.length > 0) setAnnouncements(batch);
    });
  }, [store]);

  const dismissToast = useCallback(() => setToasts((queue) => queue.slice(1)), []);
  const dismissNotice = useCallback(() => setNotices((queue) => queue.slice(1)), []);
  return { toast: toasts[0] ?? null, notice: notices[0] ?? null, announcements, completed, dismissToast, dismissNotice };
}

/** What the engine asks for every frame or event. Rebuilt on state, overlay and language changes only. */
interface PortCache {
  labels: Record<string, string | null>;
  actions: Record<string, Array<{ key: string; label: string }> | null>;
  inspect: Record<string, string[] | null>;
  leave: Record<string, boolean>;
  doorLocked: boolean;
  overlayOpen: boolean;
}

const EMPTY_CACHE: PortCache = { labels: {}, actions: {}, inspect: {}, leave: {}, doorLocked: false, overlayOpen: false };

function lookup<T>(record: Record<string, T>, id: string, fallback: T): T {
  return Object.hasOwn(record, id) ? record[id] : fallback;
}

const RoomChapterLayerView: React.FC<RoomChapterLayerProps> = ({
  session,
  settings,
  bridge,
  saveSource: saveSourceProp,
  engineReady = true,
  ringSettleMs = DEFAULT_RING_SETTLE_MS,
  onStoreReady,
  onIntroBegin,
  onOpenDecision,
  onReturnToMenu,
  onHoverSound,
  extensionBlocking = false,
  renderExtension,
  voiceDeps: voiceDepsProp,
  modelAllowed: modelAllowedProp,
  phoneScreenSink,
  clockPaused = false,
  onOpenSettings,
  outsideDoor = false,
  outdoors = false,
  outsideRadar = null,
  hideHud = false,
  onStoryContext,
}) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const scenario = useDisplayScenario();
  const text = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  const [defaultSaveSource] = useState(() => createLocalStorageSaveSource());
  const saveSource = saveSourceProp ?? defaultSaveSource;

  // Created once per mount: a fresh chapter or the state replayed by the loader.
  const [store] = useState(() => createChapterStore(session.restored?.state ?? createInitialState(ACTIVE_SCENARIO), ACTIVE_SCENARIO));
  const onStoreReadyRef = useRef(onStoreReady);
  onStoreReadyRef.current = onStoreReady;
  useEffect(() => {
    onStoreReadyRef.current?.(store);
  }, [store]);

  const status = useChapterState(store, (state) => state.status);
  const discoveredCount = useChapterState(store, (state) => state.discovered.length);
  const resources = useChapterState(store, (state) => state.resources);

  // --- Intro --------------------------------------------------------------------------------
  // A restored run that already ended has no intro (the ending and debrief belong to task 10.3).
  const [introOpen, setIntroOpen] = useState(() => {
    const state = store.getState();
    return state.status === "not-started" || state.status === "playing";
  });
  const [introMode] = useState<"begin" | "continue">(() => (store.getState().status === "not-started" ? "begin" : "continue"));
  const introOpenRef = useRef(introOpen);
  introOpenRef.current = introOpen;

  const introLines = useMemo<NarrationLine[] | undefined>(() => {
    if (!Object.hasOwn(scenario.dialogues, "dlg.intro")) {
      // "LAST SUBMISSION: 72 GIỜ CUỐI" has no narration graph yet: the opening is text only.
      const initial = scenario.initial ?? CHAPTER_1_INITIAL_STATE;
      const values = {
        age: CHAPTER_PROTAGONIST.age,
        progress: initial.resources.thesisProgress,
        hours: Math.round(initial.resources.timeMinutes / 60),
      };
      void values;
      // The opening is cinematic: Alex's own voice and subtitles tell it, and nothing is written in the
      // middle of the screen. The goals stay in the objective tracker, the schedule and the journal.
      return [{ text: "", src: null }];
    }
    const graph = scenario.dialogues["dlg.intro"];
    const lines: NarrationLine[] = [];
    // The voice plays through the narration player; the text is typed over the owner's timing for
    // the locale, starting after the player's pause before the line.
    const timing = INTRO_TYPING_MS[locale === "vi" ? "vi" : "en"];
    INTRO_SEQUENCE.forEach((nodeId, i) => {
      if (!Object.hasOwn(graph.nodes, nodeId)) return;
      const node = graph.nodes[nodeId];
      if (!Object.hasOwn(graph.lines, node.lineId)) return;
      const delayMs = node.tone ? effectivePauseMs(node.tone, settings.reducedStress) : 0;
      lines.push({ text: graph.lines[node.lineId], src: null, durationMs: timing[i], delayMs });
    });
    return lines;
  }, [scenario, locale, settings.reducedStress, text]);

  const handleBegin = useCallback(() => {
    if (store.getState().status === "not-started") {
      const result = store.dispatch({ type: "START_CHAPTER" });
      if (!result.accepted) return;
    }
    setIntroOpen(false);
    onIntroBegin?.();
  }, [onIntroBegin, store]);

  // --- Overlay stack ------------------------------------------------------------------------
  const [overlays, setOverlays] = useState<OverlayStack>(EMPTY_OVERLAYS);
  const overlaysRef = useRef<OverlayStack>(EMPTY_OVERLAYS);
  const openersRef = useRef(new Map<OverlayKind, HTMLElement>());
  const overlayLayerRef = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState<RoomPropId | null>(null);
  const transitMoving = useRef(false);
  const inspectingRef = useRef<RoomPropId | null>(null);
  // A call that rings or is active blocks the room like any overlay (its UI is mounted below).
  const callOpen = useChapterState(store, (state) => state.call.status === "ringing" || state.call.status === "active");
  const blocking = extensionBlocking || callOpen;

  // --- 3D phone model (task 10.4): one sink shared by the model layer and the call screen.
  const [ownPhoneSink] = useState(createPhoneScreenSink);
  const callSink = phoneScreenSink ?? ownPhoneSink;
  const [detectedModelSupport] = useState(() => (modelAllowedProp === undefined ? detectPhoneModelSupport() : false));
  const [modelFailed, setModelFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const modelAllowed = (modelAllowedProp ?? detectedModelSupport) && !modelFailed && !contextLost;
  const callRinging = useChapterState(store, (state) => state.call.status === "ringing");
  const handleModelError = useCallback(() => setModelFailed(true), []);
  // A lost context unmounts the canvas, so no restore event can arrive: try again on the next call.
  useEffect(() => {
    if (!callOpen) setContextLost(false);
  }, [callOpen]);
  const extensionBlockingRef = useRef(blocking);
  extensionBlockingRef.current = blocking;

  // --- Audio: one Web Audio engine per mount, shared by the call voice, the call sounds and the
  // narration. Created in an effect (so a development double mount gets a live engine) and
  // disposed on unmount. Tests pass `voiceDeps` instead; then there is no engine. Audio never
  // dispatches to the store.
  const engineRef = useRef<WebAudioEngine | null>(null);
  const [engine, setEngine] = useState<WebAudioEngine | null>(null);
  useEffect(() => {
    if (voiceDepsProp !== undefined) return undefined;
    const created = (engineRef.current ??= createWebAudioEngine());
    setEngine(created);
    return () => {
      created.dispose();
      if (engineRef.current === created) engineRef.current = null;
      setEngine((current) => (current === created ? null : current));
    };
  }, [voiceDepsProp]);
  const voiceDeps = useMemo<VoicePlaybackDeps>(
    () => voiceDepsProp ?? { createPort: () => (engineRef.current ??= createWebAudioEngine()) },
    [voiceDepsProp],
  );
  // The narration player shares the port but must not dispose it: the call player owns it.
  const narrationDeps = useMemo<VoicePlaybackDeps>(
    () => ({
      ...voiceDeps,
      createPort: () => nonOwningPort((voiceDeps.createPort ?? createWebAudioEngine)()),
    }),
    [voiceDeps],
  );

  // --- Intro narration through the voice player. The intro overlay owns the stepping (a click
  // reveals the line, the next click moves on) and reports the line index; a call stops it.
  const narration = useNarrationPlayback({
    scenario,
    sequence: Object.hasOwn(scenario.dialogues, "dlg.intro") ? INTRO_NARRATION : null,
    active: introOpen && introMode === "begin" && engineReady && !callOpen,
    paused: overlays.length > 0,
    autoAdvance: false,
    settings: {
      soundEnabled: settings.soundEnabled,
      sfxVolume: settings.sfxVolume,
      voiceVolume: settings.voiceVolume,
      phoneVoiceFilter: false,
      englishVoiceFallback: settings.englishVoiceFallback,
      reducedStress: settings.reducedStress,
      subtitlesEnabled: settings.subtitlesEnabled,
    },
    deps: narrationDeps,
  });
  const goToIntroLine = narration.goTo;
  // The rain and the city are lowered under the intro narration so the voice stays on top (owner).
  const introNarrating = introOpen && introMode === "begin" && engineReady && !callOpen;
  useEffect(() => {
    if (!engineReady) return undefined;
    bridge.commands?.duckForVoice?.(introNarrating);
    return () => bridge.commands?.duckForVoice?.(false);
  }, [bridge, engineReady, introNarrating]);

  // --- Alex's Mission 01 voice: one line at a time on the shared engine, once per run, never after a load.
  // The list a device app shows now (an inbox, the bank app): Alex's email and bank lines wait for it.
  const [deviceView, setDeviceView] = useState<VoiceView | null>(null);
  // A line of a chat or a phone call (a clip or the computer voice) is the one voice at that moment:
  // Alex's story voice waits for it and continues after it. A game hold pauses the line as well.
  const lineVoiceActive = useLineVoiceActive();
  useEffect(() => {
    setLineVoiceHeld(clockPaused);
    return () => setLineVoiceHeld(false);
  }, [clockPaused]);
  const alexVoice = useMission01Voice({
    store,
    scenario,
    port: engine,
    locale,
    settings: { soundEnabled: settings.soundEnabled, voiceVolume: settings.voiceVolume },
    held: clockPaused,
    introVisible: introOpen && introMode === "begin" && engineReady,
    // A street conversation (Mission 02: the driver, Cô Ba) is the scene: Alex's inner voice waits
    // until it closes, so a line reached by a reply follows the conversation instead of cutting in.
    callOpen: callOpen || lineVoiceActive || hideHud,
    viewing: deviceView,
  });
  // --- Port cache (the bridge reads it on every hover frame) --------------------------------
  const cacheRef = useRef<PortCache>(EMPTY_CACHE);
  const latestRef = useRef({ text, scenario, outsideDoor });
  latestRef.current = { text, scenario, outsideDoor };

  const rebuildCache = useCallback(() => {
    const state = store.getState();
    const { text: tr, scenario: sc, outsideDoor: doorOut } = latestRef.current;
    const ringing = state.call.status === "ringing";
    const busy = callInProgress(state);
    const overlayOpen = introOpenRef.current || overlaysRef.current.length > 0 || extensionBlockingRef.current;
    const doorLocked = state.status !== "finished" && !doorForcedOpen() && !(doorOut && !busy && !ringing && !overlayOpen);
    const cache: PortCache = {
      labels: {
        door: doorLocked ? tr("room.prompt.doorLocked") : null,
        phone: busy && !ringing ? null : ringing ? tr("room.prompt.phoneRinging") : tr("room.prompt.phoneRecords"),
        laptop: tr("room.prompt.laptopUse"),
      },
      actions: {
        phone: ringing
          ? [
              { key: "F", label: tr("room.prompt.phoneRinging") },
              { key: "R", label: tr("room.prompt.phoneDecline") },
            ]
          : null,
      },
      inspect: {},
      leave: { phone: !busy && !overlayOpen, laptop: !overlayOpen },
      doorLocked,
      overlayOpen,
    };
    for (const [prop, objectId] of Object.entries(PROP_TO_OBJECT)) {
      if (objectId && Object.hasOwn(sc.interactables, objectId)) cache.inspect[prop] = [sc.interactables[objectId].inspectionText];
    }
    // The device and calendar captions of the new chapter replace the room's own text (a different story).
    if (Object.keys(sc.deviceActions).length === 0) {
      cache.inspect.phone = [tr("room.inspect.phone")];
      cache.inspect.laptop = [tr("room.inspect.laptop")];
      cache.inspect.calendar = [tr("room.inspect.calendar")];
    }
    cacheRef.current = cache;
  }, [store]);
  // The door prompt and lock follow the host's outside world as soon as it is ready.
  useEffect(() => {
    rebuildCache();
  }, [outsideDoor, rebuildCache]);

  const updateOverlays = useCallback(
    (change: (stack: OverlayStack) => OverlayStack) => {
      const next = change(overlaysRef.current);
      if (next === overlaysRef.current) return;
      overlaysRef.current = next;
      setOverlays(next);
      rebuildCache();
    },
    [rebuildCache],
  );

  const openOverlay = useCallback(
    (overlay: Overlay, options?: { stack?: boolean }): boolean => {
      const stack = overlaysRef.current;
      if (introOpenRef.current) return false;
      if (stack.length > 0 && !options?.stack && !isOpen(stack, overlay.kind)) return false;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) openersRef.current.set(overlay.kind, active);
      else openersRef.current.delete(overlay.kind);
      updateOverlays((current) => push(current, overlay));
      return true;
    },
    [updateOverlays],
  );

  /** Closing the laptop or the phone leaves the inspect pose too. */
  const leaveInspect = useCallback(
    (kind: OverlayKind) => {
      // The phone put away over the open laptop leaves the laptop where it is.
      if (kind === "phone" && isOpen(overlaysRef.current, "laptop")) return;
      if (kind === "laptop" || kind === "phone") bridge.commands?.closeInspect();
    },
    [bridge],
  );

  const removeOverlay = useCallback(
    (kind: OverlayKind) => {
      if (!isOpen(overlaysRef.current, kind)) return;
      updateOverlays((stack) => Object.freeze(stack.filter((entry) => entry.kind !== kind)));
      leaveInspect(kind);
    },
    [leaveInspect, updateOverlays],
  );

  const closeTop = useCallback(() => {
    const current = top(overlaysRef.current);
    if (!current) return;
    updateOverlays((stack) => pop(stack));
    leaveInspect(current.kind);
  }, [leaveInspect, updateOverlays]);

  const canClose = useCallback((overlay: Overlay) => !ESCAPE_LOCKED.has(overlay.kind), []);

  // --- Checkpoints --------------------------------------------------------------------------
  // `useCheckpointSaver` writes when the active or completed objectives change and no call is in
  // progress. Each act starts with an objective change and the decision completes `obj.decide`, so
  // this covers "each act start and after each decision". A change during a call is written when
  // the call ends (the saver's own rule). The room has no player pose, so the pose getter is null.
  const [saveFailed, setSaveFailed] = useState(false);
  const poseGetterRef = useRef<(() => SavedPlayerPose) | null>(null);
  const handleWriteFailure = useCallback(() => setSaveFailed(true), []);
  const { saveNow } = useCheckpointSaver({
    store,
    saveSource,
    poseGetterRef,
    chapterId: session.chapterId,
    sceneId: session.sceneId,
    onWriteFailure: handleWriteFailure,
  });
  const [saveTrimmedOpen, setSaveTrimmedOpen] = useState(() => session.saveTrimmed === true);

  // --- Dispatch helpers ---------------------------------------------------------------------
  const dispatch = useCallback((action: CoreAction) => store.dispatch(action), [store]);
  const dispatchVoid = useCallback((action: CoreAction) => void store.dispatch(action), [store]);

  // --- Bridge handlers ----------------------------------------------------------------------
  useEffect(() => {
    rebuildCache();
    return store.subscribe(rebuildCache);
  }, [rebuildCache, store, scenario, text]);

  useEffect(() => {
    rebuildCache();
  }, [blocking, introOpen, rebuildCache]);

  useEffect(() => {
    const canOpenDevice = (): boolean => {
      const state = store.getState();
      return !introOpenRef.current && state.status === "playing" && state.outcome === null;
    };
    bridge.attach({
      onProp(id, phase) {
        if (phase === "inspect-ready") {
          inspectingRef.current = id;
          setInspecting(id);
          if (!canOpenDevice()) return;
          if (id === "laptop") openOverlay({ kind: "laptop" });
          else if (id === "phone" && !callInProgress(store.getState())) openOverlay({ kind: "phone" });
        } else if (phase === "inspect-end") {
          if (inspectingRef.current === id) {
            inspectingRef.current = null;
            setInspecting(null);
          }
          // The engine left the pose by itself: the overlay that belonged to it goes too.
          if (id === "laptop" || id === "phone") {
            if (isOpen(overlaysRef.current, id)) {
              updateOverlays((stack) => Object.freeze(stack.filter((entry) => entry.kind !== id)));
            }
          }
        } else if (phase === "interact") {
          const objectId = Object.hasOwn(PROP_TO_OBJECT, id) ? PROP_TO_OBJECT[id] : undefined;
          if (objectId && !introOpenRef.current) store.dispatch({ type: "INTERACT_OBJECT", objectId });
        }
      },
      onInspectKey(id, key) {
        if (id !== "phone" || introOpenRef.current) return false;
        const state = store.getState();
        if (state.call.status !== "ringing") return false;
        const upper = key.toUpperCase();
        if (upper === "F") return store.dispatch({ type: "ANSWER_CALL" }).accepted;
        if (upper === "R") return store.dispatch({ type: "END_CALL" }).accepted;
        return false;
      },
      label: (id) => lookup(cacheRef.current.labels, id, null),
      inspectLines: (id) => lookup(cacheRef.current.inspect, id, null),
      actions: (id) => lookup(cacheRef.current.actions, id, null),
      canLeaveInspect: (id) => lookup(cacheRef.current.leave, id, true),
      doorLocked: () => cacheRef.current.doorLocked,
      overlayOpen: () => cacheRef.current.overlayOpen,
      ...chapterTransit(store, scenario, (moving) => { transitMoving.current = moving; }),
      onStoryStart(npcId) {
        if (npcId === "unverified_driver") {
          if (store.getState().status === "playing") {
            store.dispatch({ type: "USE_DEVICE_ITEM", itemId: "map.bus06-stop", actionId: "ask-driver" });
          }
          return;
        }
        if (npcId !== "interviewee_q5" || store.getState().status !== "playing") return undefined;
        const before = store.getState();
        // Late or already-rescheduled visits stay in their own conversation branch; the player's reply
        // is what accepts or starts that interview. A normal on-time visit starts as they walk up.
        if (before.persistent.interviewMissed || before.persistent.interviewRescheduled) {
          return { flags: before.persistent };
        }
        const result = store.dispatch({ type: "USE_DEVICE_ITEM", itemId: "interview.coba", actionId: "start" });
        if (!result.accepted) return { flags: before.persistent };
        // Hand the reducer's fresh flags back so the physical dialogue opens on the right branch
        // on its very first turn instead of one render late.
        return { flags: result.state.persistent };
      },
      onStoryReply(npcId, replyId) {
        if (npcId === "unverified_driver") {
          // The street conversation is the physical equivalent of asking the driver at the stop.
          // The authored action is `once`, so repeated replies are harmless.
          if (store.getState().status === "playing") {
            store.dispatch({ type: "USE_DEVICE_ITEM", itemId: "map.bus06-stop", actionId: "ask-driver" });
          }
          return;
        }
        if (npcId !== "interviewee_q5" || store.getState().status !== "playing") return;
        const actionByReply: Record<string, string> = {
          coba_transfer_check: "ask-transfer",
          coba_process: "ask-process",
          coba_exception: "ask-exception",
          // Late acceptance is deliberately two-step: reschedule now, then reopen the conversation
          // and explicitly begin the rescheduled interview.
          coba_late_reschedule: "reschedule",
          coba_start_rescheduled: "start-rescheduled",
        };
        const actionId = actionByReply[replyId];
        if (!actionId) return undefined;
        const result = store.dispatch({ type: "USE_DEVICE_ITEM", itemId: "interview.coba", actionId });
        return result.accepted ? { flags: result.state.persistent } : undefined;
      },
    });
    return () => bridge.detach();
  }, [bridge, openOverlay, store, updateOverlays]);

  // --- Presentation commands (diffs) --------------------------------------------------------
  const sinkRef = useRef<PresentationSink | null>(null);
  sinkRef.current = {
    setPhoneMode: (mode) => bridge.commands?.setPhoneMode(mode),
    ring: (on) => bridge.commands?.ring(on),
    setLaptopFrame: (frame: LaptopFrameKeys | null) =>
      bridge.commands?.setLaptopFrame(frame ? { badge: text(frame.badgeKey), headline: text(frame.headlineKey) } : null),
    chime: () => bridge.commands?.chime(),
    setMood: (mood) => bridge.commands?.setMood(mood),
  };
  const presentationRef = useRef<RoomPresentation | null>(null);
  const appliedLocaleRef = useRef(locale);

  useEffect(() => {
    if (!engineReady) return;
    presentationRef.current = null;
    const apply = () => {
      const next = roomPresentation(store.getState(), scenario);
      if (sinkRef.current) applyPresentation(presentationRef.current, next, sinkRef.current);
      presentationRef.current = next;
    };
    apply();
    return store.subscribe(apply);
  }, [engineReady, scenario, store]);

  // The laptop card text is drawn as given, so a language change sends it again.
  useEffect(() => {
    if (appliedLocaleRef.current === locale) return;
    appliedLocaleRef.current = locale;
    const frame = presentationRef.current?.laptopFrame ?? null;
    if (engineReady && frame) sinkRef.current?.setLaptopFrame(frame);
  }, [engineReady, locale]);

  // --- Cursor mode while a layer is open ----------------------------------------------------
  const anyOverlay = introOpen || overlays.length > 0 || blocking;
  const cursorAppliedRef = useRef(false);
  useEffect(() => {
    if (!engineReady || cursorAppliedRef.current === anyOverlay) return;
    cursorAppliedRef.current = anyOverlay;
    bridge.commands?.setCursorMode?.(anyOverlay);
  }, [anyOverlay, bridge, engineReady]);

  // The engine can take the pointer again while a layer stays open (after a call ends, when the
  // decision panel opens over it, or when Ctrl hides the cursor). The mouse is needed by every
  // layer, so any lock that appears while one is open is released at once.
  const [pointerLocked, setPointerLocked] = useState(() => typeof document !== "undefined" && document.pointerLockElement != null);
  const anyOverlayRef = useRef(anyOverlay);
  anyOverlayRef.current = anyOverlay;
  useEffect(() => {
    const sync = () => {
      const locked = document.pointerLockElement != null;
      setPointerLocked(locked);
      if (locked && anyOverlayRef.current) {
        bridge.commands?.setCursorMode?.(true);
        document.exitPointerLock?.();
      }
    };
    document.addEventListener("pointerlockchange", sync);
    return () => document.removeEventListener("pointerlockchange", sync);
  }, [bridge]);
  useEffect(() => {
    // A layer that opens or changes while the pointer is already locked frees it as well.
    if (!anyOverlay || !engineReady || document.pointerLockElement == null) return;
    bridge.commands?.setCursorMode?.(true);
    document.exitPointerLock?.();
  }, [anyOverlay, bridge, engineReady, overlays, blocking]);

  // "Press Ctrl to use the mouse": shown for `CINE.mouseHintMs` after the pointer lock starts or an
  // overlay closes, then it fades out (reduced motion: it just disappears). The next lock shows it
  // again. Presentation only.
  const reducedMotionPref = useReducedMotion();
  const mouseHintEligible = pointerLocked && !anyOverlay;
  const [mouseHintPhase, setMouseHintPhase] = useState<"hidden" | "shown" | "fading">("hidden");
  useEffect(() => {
    if (!mouseHintEligible) {
      setMouseHintPhase("hidden");
      return undefined;
    }
    setMouseHintPhase("shown");
    let fadeId: number | undefined;
    const id = window.setTimeout(() => {
      if (reducedMotionPref) {
        setMouseHintPhase("hidden");
        return;
      }
      setMouseHintPhase("fading");
      fadeId = window.setTimeout(() => setMouseHintPhase("hidden"), CINE.motion.baseMs);
    }, CINE.mouseHintMs);
    return () => {
      window.clearTimeout(id);
      if (fadeId !== undefined) window.clearTimeout(fadeId);
    };
  }, [mouseHintEligible, reducedMotionPref]);

  // --- Rings: only while the room is free ---------------------------------------------------
  const ringableSelector = useCallback((state: ChapterState) => selectRingableCall(state, scenario), [scenario]);
  const ringable = useChapterState(store, ringableSelector);
  const free = engineReady && !introOpen && overlays.length === 0 && inspecting === null && !blocking;
  // --- World clock: time passes while the player is free in the room -------------------------
  const transitClockPaused = useCallback(() => transitMoving.current, []);
  useWorldClock({ store, scenario, running: free && !clockPaused && status === "playing", isPaused: transitClockPaused });
  const pendingEventsSelector = useCallback((state: ChapterState) => selectPendingEvents(state, scenario), [scenario]);
  const phoneDeviceSelector = useCallback((state: ChapterState) => selectDeviceView(state, scenario, "phone"), [scenario]);
  const laptopDeviceSelector = useCallback((state: ChapterState) => selectDeviceView(state, scenario, "laptop"), [scenario]);
  const phoneDevice = useChapterState(store, phoneDeviceSelector);
  const laptopDevice = useChapterState(store, laptopDeviceSelector);
  // What the simulated student portal shows about the story. Read-only: the portal never writes state.
  const portalAccountLocked = useChapterState(store, (state) => state.persistent.accountCompromised);
  const portalDraftFinished = useChapterState(store, (state) => state.persistent.draftFinished);
  const portalTasksDone = useChapterState(store, (state) => state.world.thesisTasksDone);
  const portalAccessVerified = useChapterState(store, (state) => state.persistent.schoolAccessVerified);
  const portalSubmissionDeadlineMissed = useChapterState(store, (state) => state.persistent.submissionDeadlineMissed);
  // The bank app: transfers the bank blocked (derived, read-only) and what the player reported.
  const bankDevice = useChapterState(store, (state) => state.device);
  const bankEvents = useChapterState(store, (state) => state.world.events);
  const bankReported = useChapterState(store, (state) => state.persistent.bankReported);
  const blockedTransfers = useMemo(() => selectBlockedTransfers({ device: bankDevice, world: { events: bankEvents } }, scenario), [bankDevice, bankEvents, scenario]);
  const bankFacts = useMemo(() => ({ bankReported, accountCompromised: portalAccountLocked }), [bankReported, portalAccountLocked]);
  const portalFacts = useMemo(
    () => ({ accountLocked: portalAccountLocked, draftFinished: portalDraftFinished, tasksDone: portalTasksDone, accessVerified: portalAccessVerified, submissionDeadlineMissed: portalSubmissionDeadlineMissed }),
    [portalAccountLocked, portalDraftFinished, portalTasksDone, portalAccessVerified, portalSubmissionDeadlineMissed],
  );
  const thesisSelector = useCallback((state: ChapterState) => selectThesisView(state, scenario), [scenario]);
  const thesisView = useChapterState(store, thesisSelector);
  const openMissionsSelector = useCallback((state: ChapterState) => selectOpenMissions(state, scenario), [scenario]);
  const pendingEvents = useChapterState(store, pendingEventsSelector);
  const openMissions = useChapterState(store, openMissionsSelector);
  const closedMissionsSelector = useCallback((state: ChapterState) => selectClosedMissions(state, scenario), [scenario]);
  const closedMissions = useChapterState(store, closedMissionsSelector);
  // Task mode: the missions have concrete steps (LAST SUBMISSION). Older content keeps the objective tracker.
  const taskMode = useMemo(() => (scenario.missions ?? []).some((mission) => mission.paths.some((path) => (path.steps?.length ?? 0) > 0)), [scenario]);
  // The tracker and the marker follow the mission the player tracks, else the first required one with a step to do.
  const [trackedMissionId, setTrackedMissionId] = useState<string | null>(null);
  // A sub-task the player picked in the list. It only counts while it belongs to the tracked mission and is not done.
  const [trackedStepId, setTrackedStepId] = useState<string | null>(null);
  const hudScale = useHudScale();
  const trackMission = useCallback((missionId: string) => {
    setTrackedMissionId(missionId);
    setTrackedStepId(null);
  }, []);
  const trackStep = useCallback((missionId: string, stepId: string) => {
    setTrackedMissionId(missionId);
    setTrackedStepId(stepId);
  }, []);
  const baseTrackedMission =
    openMissions.find((mission) => mission.id === trackedMissionId) ??
    openMissions.find((mission) => !mission.optional && mission.current !== null) ??
    openMissions.find((mission) => mission.current !== null) ??
    openMissions[0] ??
    null;
  const pickedStep = baseTrackedMission && trackedStepId !== null ? baseTrackedMission.steps.find((step) => step.id === trackedStepId && !step.done) : undefined;
  const trackedMission = baseTrackedMission && pickedStep ? { ...baseTrackedMission, current: pickedStep } : baseTrackedMission;
  // The laptop app of the current step (its icon carries the task marker on the desktop).
  const currentStep = trackedMission?.current ?? null;
  const laptopTaskAppId = taskMode && currentStep?.target === "laptop" && currentStep.app ? (currentStep.app === "thesis" ? "thesis" : `device-${currentStep.app}`) : null;
  const seenEventsRef = useRef<Set<string> | null>(null);
  if (seenEventsRef.current === null) seenEventsRef.current = new Set(pendingEvents.map((event) => event.id));
  const arrivalCounterRef = useRef(0);
  const [arrival, setArrival] = useState<{ key: number; title: string; onPhone?: boolean } | null>(null);
  useEffect(() => {
    const seen = seenEventsRef.current;
    if (seen === null) return;
    const fresh = pendingEvents.filter((event) => !seen.has(event.id));
    if (fresh.length === 0) return;
    for (const event of fresh) seen.add(event.id);
    arrivalCounterRef.current += 1;
    setArrival({ key: arrivalCounterRef.current, title: fresh[fresh.length - 1].title });
  }, [pendingEvents]);
  // New mail, chats, listings and job offers also arrive with a notice (items that start on the device do not).
  const arrivedItems = useChapterState(store, (state) => state.device.items);
  const seenItemsRef = useRef<Set<string> | null>(null);
  if (seenItemsRef.current === null) seenItemsRef.current = new Set(Object.keys(arrivedItems));
  useEffect(() => {
    const seen = seenItemsRef.current;
    if (seen === null) return;
    const fresh = Object.keys(arrivedItems).filter((id) => !seen.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) seen.add(id);
    const notable = (scenario.deviceItems ?? []).filter(
      (item) => fresh.includes(item.id) && (item.app === "mail" || item.app === "messages" || item.app === "housing" || item.app === "jobs"),
    );
    if (notable.length === 0) return;
    arrivalCounterRef.current += 1;
    const latest = notable[notable.length - 1];
    setArrival({ key: arrivalCounterRef.current, title: latest.title, onPhone: latest.app === "messages" });
  }, [arrivedItems, scenario]);
  const dismissArrival = useCallback(() => setArrival(null), []);

  // --- From Mission 01 to Mission 02: the draft is saved, then Minh calls ----------------------
  // No "mission complete" screen: a small notice that the draft is saved, then the phone rings.
  const draftDone = useChapterState(store, (state) => state.world.thesisTasksDone.includes(DRAFT_TASK_ID));
  const draftDoneSeenRef = useRef(draftDone);
  const [progressNoticeKey, setProgressNoticeKey] = useState<number | null>(null);
  useEffect(() => {
    if (draftDone && !draftDoneSeenRef.current) setProgressNoticeKey((key) => (key ?? 0) + 1);
    draftDoneSeenRef.current = draftDone;
  }, [draftDone]);
  const dismissProgressNotice = useCallback(() => setProgressNoticeKey(null), []);
  const thesisPercent = useChapterState(store, (state) => state.resources.thesisProgress);
  const incoming = useIncomingCall({ store, scenario, enabled: taskMode && !introOpen && !callOpen });
  const incomingCaller = incoming.callerId === null ? null : (phoneDevice.apps.contacts.find((item) => item.id === incoming.callerId) ?? null);
  const incomingRinging = incoming.phase === "ringing" && incomingCaller !== null;
  // The phone vibrates and rings while the call is waiting to be picked up.
  useEffect(() => {
    if (!engineReady || !incomingRinging) return undefined;
    const commands = bridge.commands;
    commands?.ring(true);
    return () => commands?.ring(false);
  }, [bridge, engineReady, incomingRinging]);
  const declineIncoming = useCallback(() => {
    if (incoming.callerId !== null) store.dispatch({ type: "USE_DEVICE_ITEM", itemId: incoming.callerId, actionId: DECLINE_ACTION });
  }, [incoming.callerId, store]);
  const [missedNoticeSeen, setMissedNoticeSeen] = useState<string | null>(null);
  const dismissMissedNotice = useCallback(() => setMissedNoticeSeen(incoming.callerId), [incoming.callerId]);
  const gameplay = gameplayConfig(scenario);
  // The parked story ("The Urgent Call") has laptop device actions and its own fixed room clock.
  const legacyLaptop = Object.keys(scenario.deviceActions).length > 0;
  const storyClockOn = gameplay.clockRuns || !legacyLaptop;
  // The simulated time of day shows on the wall clock, the 3D screens, the phone status bar and the laptop.
  const narrativeState = useChapterState(store, (s) => s);
  const currentElapsedMinutes = elapsedMinutes(narrativeState, scenario);
  useEffect(() => {
    if (!onStoryContext) return;
    onStoryContext({
      elapsedMinutes: currentElapsedMinutes,
      thesisProgress: narrativeState.resources.thesisProgress,
      fatigue: narrativeState.resources.fatigue,
      money: narrativeState.resources.cash,
      flags: narrativeState.persistent,
    });
  }, [
    onStoryContext,
    currentElapsedMinutes,
    narrativeState.resources.thesisProgress,
    narrativeState.resources.fatigue,
    narrativeState.resources.cash,
    narrativeState.persistent,
  ]);
  const clockMinuteOfDay = useChapterState(store, (state) => {
    const clock = simulatedClock(state.resources.timeMinutes);
    return clock.hour * 60 + clock.minute;
  });
  const effectiveClockMinute = clockMinuteOfDay;
  const clockText = `${String(Math.floor(effectiveClockMinute / 60)).padStart(2, "0")}:${String(effectiveClockMinute % 60).padStart(2, "0")}`;
  useEffect(() => {
    if (!storyClockOn) return;
    setGameClockOverride(effectiveClockMinute * 60);
    if (engineReady) bridge.commands?.setStoryClock?.(effectiveClockMinute * 60);
  }, [storyClockOn, effectiveClockMinute, engineReady, bridge]);
  useEffect(
    () => () => {
      setGameClockOverride(null);
      bridge.commands?.setStoryClock?.(null);
    },
    [bridge],
  );
  // Tiredness makes each percent of thesis work take longer, so a session is whole percents at that rate.
  const perPercentMinutes = effectiveWorkMinutes(gameplay.thesisMinutesPerPercent, resources.fatigue, gameplay.fatigue);
  const sessionPercent = Math.floor(gameplay.thesisSessionMinutes / gameplay.thesisMinutesPerPercent);
  const fatigueOn = gameplay.fatigue.enabled;
  // `onTask` also reports whether the core accepted the review, which the laptop desk uses to show
  // a rejection; the Schedule panel ignores the extra argument and the returned value.
  const thesisProps: ThesisPanelProps = {
    progress: resources.thesisProgress,
    sessionMinutes: sessionPercent * perPercentMinutes,
    sessionPercent,
    fatigue: fatigueOn
      ? { level: fatigueLevel(resources.fatigue, gameplay.fatigue), slowdownPercent: Math.round((workSlowdown(resources.fatigue, gameplay.fatigue) - 1) * 100) }
      : undefined,
    rest: fatigueOn
      ? { napMinutes: gameplay.fatigue.nap.minutes, sleepMinutes: gameplay.fatigue.sleep.minutes, onRest: (mode) => void store.dispatch({ type: "REST", mode }) }
      : undefined,
    freeWorkMaxPercent: gameplay.thesisFreeWorkMaxPercent,
    timeLeftMinutes: resources.timeMinutes,
    tasks: thesisView.tasks,
    onWork: (minutes) => void store.dispatch({ type: "WORK_ON_THESIS", minutes }),
    onTask: (taskId: string, approachId?: string): boolean =>
      store.dispatch({
        type: "COMPLETE_THESIS_TASK",
        taskId,
        ...(approachId === undefined ? {} : { approachId }),
      }).accepted,
  };
  // The draft deadline is the mission's own deadline from the scenario, read from the same core clock.
  const draftDeadlineMinutesLeft = openMissions.find((mission) => mission.id === "m01.missing-access")?.minutesLeft ?? undefined;
  // Unread mail, chats, listings and job offers while the desk is open: shown as a chip, never opened.
  const thesisDistractions = (["mail", "messages", "housing", "jobs"] as const)
    .filter((app) => laptopDevice.unread[app] > 0)
    .map((app) => ({ key: app, appId: app === "messages" ? "device-mail" : `device-${app}`, label: text(`device.apps.${app}`), count: laptopDevice.unread[app] }));

  useEffect(() => {
    if (!free || ringable === null) return;
    const ring = () => {
      // The reducer checks the ring rules again; a rejected ring changes nothing.
      store.dispatch({ type: "RING_CALL", callId: ringable, reason: ringable === "call.alex" ? "first-interaction" : "follow-up" });
    };
    if (ringSettleMs <= 0) {
      ring();
      return;
    }
    const id = window.setTimeout(ring, ringSettleMs);
    return () => window.clearTimeout(id);
  }, [free, ringable, ringSettleMs, store]);

  // --- Keys: Escape (capture), J, H, Tab trap -----------------------------------------------
  const [hintOn, setHintOn] = useState(false);
  /** Set by the laptop desktop while it is open; see the Escape handler below. */
  const laptopEscapeRef = useRef<(() => boolean) | null>(null);
  const [decideRequest, setDecideRequest] = useState(0);
  const handleDecide = useCallback(() => {
    onOpenDecision?.();
    setDecideRequest((count) => count + 1);
  }, [onOpenDecision]);

  const [journalSeen, setJournalSeen] = useState(() => store.getState().discovered.length);

  const toggleJournal = useCallback(() => {
    if (introOpenRef.current || store.getState().status !== "playing") return;
    const stack = overlaysRef.current;
    if (stack.length === 0) {
      if (openOverlay({ kind: "journal" })) setJournalSeen(store.getState().discovered.length);
    } else if (top(stack)?.kind === "journal") {
      closeTop();
    }
  }, [closeTop, openOverlay, store]);

  const togglePlanner = useCallback(() => {
    if (introOpenRef.current || store.getState().status !== "playing") return;
    const stack = overlaysRef.current;
    if (stack.length === 0) openOverlay({ kind: "planner" });
    else if (top(stack)?.kind === "planner") closeTop();
  }, [closeTop, openOverlay, store]);
  // The chapter's phone is carried: P brings it up low on the right (like in GTA) and puts it away.
  const phoneCarried = taskMode;
  const togglePhone = useCallback(() => {
    if (!phoneCarried || introOpenRef.current) return;
    const state = store.getState();
    if (state.status !== "playing" || callInProgress(state)) return;
    const stack = overlaysRef.current;
    if (stack.length === 0) openOverlay({ kind: "phone" });
    // At the laptop the phone comes up over it, so the bank's code can be read (owner).
    else if (stack.length === 1 && stack[0].kind === "laptop") openOverlay({ kind: "phone" }, { stack: true });
    else if (top(stack)?.kind === "phone") closeTop();
  }, [closeTop, openOverlay, phoneCarried, store]);
  // Task button on the map: marked while a mission is open that the task list has not shown yet.
  const [tasksSeen, setTasksSeen] = useState<ReadonlySet<string>>(() => new Set());
  const tasksUnseen = openMissions.some((mission) => !tasksSeen.has(mission.id));
  const toggleTasks = useCallback(() => {
    if (introOpenRef.current || store.getState().status !== "playing") return;
    const stack = overlaysRef.current;
    if (stack.length === 0) {
      if (openOverlay({ kind: "tasks" })) setTasksSeen(new Set(selectOpenMissions(store.getState(), scenario).map((mission) => mission.id)));
    } else if (top(stack)?.kind === "tasks") closeTop();
  }, [closeTop, openOverlay, scenario, store]);
  /** The Notes control of a call: opens the journal on top of the call. The call keeps going. */
  const openJournal = useCallback(() => {
    if (introOpenRef.current || store.getState().status !== "playing" || overlaysRef.current.length > 0) return;
    if (openOverlay({ kind: "journal" })) setJournalSeen(store.getState().discovered.length);
  }, [openOverlay, store]);

  useEffect(() => {
    // Capture phase: the layer sees Escape before the laptop overlay's own handler and before the
    // engine, and stops it, so one press closes exactly one overlay.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || introOpenRef.current) return;
      const current = top(overlaysRef.current);
      if (!current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || !canClose(current)) return;
      // The laptop's desktop uses Escape first: it leaves an open app for the desktop, and only
      // closes the laptop when it is already on the desktop.
      if (current.kind === "laptop" && laptopEscapeRef.current?.()) return;
      closeTop();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target) || introOpenRef.current) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "KeyJ") {
        event.preventDefault();
        toggleJournal();
      } else if (event.code === "KeyK") {
        event.preventDefault();
        togglePlanner();
      } else if (event.code === "KeyT") {
        event.preventDefault();
        toggleTasks();
      } else if (event.code === "KeyP" && phoneCarried) {
        event.preventDefault();
        togglePhone();
      } else if (event.code === "KeyH") {
        // Hints are a HUD toggle only: no story state changes.
        if (store.getState().status !== "playing" || overlaysRef.current.length > 0) return;
        event.preventDefault();
        setHintOn((on) => !on);
      }
    };
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || overlaysRef.current.length === 0) return;
      // The laptop overlay traps Tab by itself.
      if (top(overlaysRef.current)?.kind === "laptop") return;
      const dialog = topDialog(overlayLayerRef.current);
      if (dialog) trapTabKey(dialog, event);
    };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onTab);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onTab);
    };
  }, [canClose, closeTop, phoneCarried, store, toggleJournal, togglePhone, togglePlanner, toggleTasks]);

  // Focus returns to the element that opened the overlay when it closes (Requirement 22.1).
  const previousOverlaysRef = useRef<OverlayStack>(EMPTY_OVERLAYS);
  useEffect(() => {
    const previous = previousOverlaysRef.current;
    previousOverlaysRef.current = overlays;
    const closed = top(previous);
    if (!closed || isOpen(overlays, closed.kind)) return;
    const opener = openersRef.current.get(closed.kind) ?? null;
    openersRef.current.delete(closed.kind);
    const dialog = topDialog(overlayLayerRef.current);
    if (dialog) {
      if (opener?.isConnected && dialog.contains(opener)) opener.focus({ preventScroll: true });
      else focusDialogStart(dialog);
    } else if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, [overlays]);

  // --- HUD state ----------------------------------------------------------------------------
  const activeObjectivesSelector = useCallback((state: ChapterState) => selectActiveObjectives(state, scenario), [scenario]);
  const laptopViewSelector = useCallback((state: ChapterState) => selectLaptopView(state, scenario), [scenario]);
  const phoneRecordsSelector = useCallback((state: ChapterState) => selectPhoneRecords(state, scenario), [scenario]);
  const phoneMessagesSelector = useCallback((state: ChapterState) => selectPhoneMessages(state, scenario), [scenario]);
  const journalEntriesSelector = useCallback((state: ChapterState) => selectJournalEntries(state, scenario), [scenario]);
  const claimStatusesSelector = useCallback((state: ChapterState) => selectClaimStatuses(state, scenario), [scenario]);
  const combinationSelector = useCallback((state: ChapterState) => selectCombinationOptions(state, scenario), [scenario]);
  const decisionPanelSelector = useCallback((state: ChapterState) => selectDecisionPanel(state, scenario), [scenario]);

  const activeObjectives = useChapterState(store, activeObjectivesSelector);
  const laptopView = useChapterState(store, laptopViewSelector);
  const phoneRecords = useChapterState(store, phoneRecordsSelector);
  const phoneMessages = useChapterState(store, phoneMessagesSelector);
  const journalEntries = useChapterState(store, journalEntriesSelector);
  const claimStatuses = useChapterState(store, claimStatusesSelector);
  const combination = useChapterState(store, combinationSelector);
  const decisionPanel = useChapterState(store, decisionPanelSelector);
  const chapterState = useChapterState(store);
  const relatedDeductions = useMemo(() => relatedDeductionStatements(chapterState, scenario), [chapterState, scenario]);

  const callStatus = useChapterState(store, (state) => state.call.status);
  const hasReplyOptions = useChapterState(store, (state) => {
    const view = selectDialogueView(state, scenario);
    return view !== null && view.options.length > 0;
  });
  const uiMode = deriveUiMode({
    callStatus,
    hasReplyOptions,
    overlayKind: top(overlays)?.kind ?? null,
    inspecting,
  });
  const callFocused = uiMode === "call" || uiMode === "decision";
  // The laptop is a focused desktop surface: suppress the room HUD while it is open, and let
  // LaptopDesktop provide its own clock and controls. The carried phone remains a separate overlay.
  const hudWithPhone = taskMode && !callFocused && overlays.length === 1 && overlays[0].kind === "phone";
  const trackerHidden = !hudWithPhone && (callFocused || uiMode === "investigation" || overlays.length > 0);

  const { toast, notice, announcements, completed, dismissToast, dismissNotice } = useHudNotices(store);
  // Open missions show the objective of their current path next to the authored objectives.
  const trackerObjectives = useMemo(
    () => [
      ...activeObjectives,
      ...openMissions.map((mission): Objective => ({ id: mission.id as ObjectiveId, text: mission.objective, activateWhen: [], completeWhen: [] })),
    ],
    [activeObjectives, openMissions],
  );
  const currentHint = activeObjectives.find((objective) => objective.hint !== undefined)?.hint ?? null;

  // --- Overlay content ----------------------------------------------------------------------
  const closeLaptop = useCallback(() => removeOverlay("laptop"), [removeOverlay]);
  // Desktop UI state (open apps, active window) is kept here so it survives closing the laptop. It is
  // not game state and is not saved.
  const desktopUiRef = useRef<DesktopState | undefined>(undefined);
  const handleDesktopState = useCallback((next: DesktopState) => {
    desktopUiRef.current = next;
  }, []);
  const registerLaptopEscape = useCallback((handler: (() => boolean) | null) => {
    laptopEscapeRef.current = handler;
  }, []);
  // Thesis Writing Mode: presentation state only. The typed draft survives closing the laptop for this
  // page session; the sprint itself comes from the saved event log (accepted work sessions).
  const [writingActive, setWritingActive] = useState(false);
  const [writingRelaxed, setWritingRelaxed] = useState(false);
  const writingDraftRef = useRef<WritingDraft | null>(null);
  const completedWorkSessions = useChapterState(store, (state) =>
    state.events.reduce((count, event) => (event.action.type === "WORK_ON_THESIS" ? count + 1 : count), 0),
  );
  const osReducedMotion = usePrefersReducedMotion();
  const writingReducedMotion = effectiveReducedMotion(settings.reducedMotion, osReducedMotion);
  const keyVolume = settings.soundEnabled ? settings.sfxVolume : 0;
  const writingHost: ThesisWritingHost = {
    active: writingActive,
    setActive: setWritingActive,
    completedSessions: completedWorkSessions,
    draft: writingDraftRef.current,
    onDraft: (draft) => {
      writingDraftRef.current = draft;
    },
    relaxed: writingRelaxed,
    onRelaxed: setWritingRelaxed,
    onKey: (kind) => bridge.commands?.typeOnKeyboard?.(kind, keyVolume),
  };
  const closePhone = useCallback(() => removeOverlay("phone"), [removeOverlay]);
  // The phone's browser (tabs, bookmarks, history) is UI state: it survives putting the phone down and is not saved.
  const phoneBrowserRef = useRef<BrowserState | undefined>(undefined);
  const handlePhoneBrowser = useCallback((next: BrowserState) => {
    phoneBrowserRef.current = next;
  }, []);
  const closeJournal = useCallback(() => removeOverlay("journal"), [removeOverlay]);
  const closePlanner = useCallback(() => removeOverlay("planner"), [removeOverlay]);
  const closeTasks = useCallback(() => removeOverlay("tasks"), [removeOverlay]);

  // Device content (mail, bank, calendar, housing, jobs, files) is shared state: the phone and the
  // laptop show the same items. The parked story's bank, compare and security tabs only appear for
  // a scenario that defines laptop device actions.
  const openDeviceItem = useCallback((itemId: string) => void store.dispatch({ type: "OPEN_DEVICE_ITEM", itemId }), [store]);
  const useDeviceItem = useCallback(
    (itemId: string, actionId: string) => void store.dispatch({ type: "USE_DEVICE_ITEM", itemId, actionId }),
    [store],
  );
  const laptopTabs: LaptopExtraTab[] = [
    ...(legacyLaptop
      ? [
          { id: "bank", label: text("laptop.apps.bank"), content: <BankApp view={buildBankAppView(laptopView)} dispatch={dispatchVoid} /> },
          { id: "compare", label: text("laptop.apps.compare"), content: <CompareView view={buildCompareViewModel(laptopView)} dispatch={dispatchVoid} /> },
        ]
      : []),
    ...deviceAppEntries(laptopDevice, "laptop", text).flatMap((entry): LaptopExtraTab[] => {
      const generic: LaptopExtraTab = {
        id: `device-${entry.app}`,
        label: entry.label,
        badge: entry.badge,
        content: <DeviceApp app={entry.app} view={laptopDevice} onOpenItem={openDeviceItem} onUseItem={useDeviceItem} onView={setDeviceView} />,
      };
      // The interactive desktop has its own banking app and file explorer.
      if (!legacyLaptop && entry.app === "bank") {
        return [
          {
            ...generic,
            content: <BankingApp view={laptopDevice} phoneView={phoneDevice} blocked={blockedTransfers} facts={bankFacts} onUseItem={useDeviceItem} />,
          },
        ];
      }
      if (!legacyLaptop && entry.app === "calendar") return [{ ...generic, content: <CalendarApp view={laptopDevice} /> }];
      if (!legacyLaptop && entry.app === "files") {
        return [{ ...generic, content: <FilesApp view={laptopDevice} onOpenItem={openDeviceItem} onUseItem={useDeviceItem} /> }];
      }
      // The interactive desktop has its own mail client, and a Browser window that mail links open.
      if (legacyLaptop || entry.app !== "mail") return [generic];
      return [
        { ...generic, content: <MailClient view={laptopDevice} onOpenItem={openDeviceItem} onUseItem={useDeviceItem} onView={setDeviceView} /> },
        {
          id: BROWSER_APP_ID,
          label: text("laptop.apps.browser"),
          content: null,
          render: ({ browser, dispatchBrowser }) => (
            <BrowserApp state={browser} dispatch={dispatchBrowser} view={laptopDevice} facts={portalFacts} onOpenItem={openDeviceItem} onUseItem={useDeviceItem} />
          ),
        },
      ];
    }),
    {
      id: "thesis",
      label: text("laptop.apps.thesis"),
      content: legacyLaptop ? (
        <ThesisPanel {...thesisProps} />
      ) : (
        <ThesisWindow
          {...thesisProps}
          onWork={(minutes) => store.dispatch({ type: "WORK_ON_THESIS", minutes }).accepted}
          quality={thesisView.quality}
          draftDeadlineMinutesLeft={draftDeadlineMinutesLeft}
          distractions={thesisDistractions}
          writing={writingHost}
        />
      ),
    },
    ...(legacyLaptop
      ? [
          {
            id: "security",
            label: text("laptop.apps.security"),
            content: <ReviewSecurityPage view={buildReviewSecurityView(laptopView)} dispatch={dispatchVoid} />,
          },
        ]
      : []),
  ];

  const renderOverlay = (overlay: Overlay): React.ReactNode => {
    switch (overlay.kind) {
      case "laptop":
        // Chapter 1 has no laptop device actions: its laptop is the interactive desktop. The parked
        // story keeps the original sidebar overlay.
        if (!legacyLaptop) {
          // In the Writing Mode the desktop stays mounted (its state and the writing editor live in it)
          // but is not shown: the writing editor and the 3D keyboard take the view.
          return (
            <div key="laptop" className="contents" style={writingActive ? { display: "none" } : undefined} data-testid="laptop-desktop-host">
              <LaptopDesktop
                apps={laptopTabs}
                onClose={closeLaptop}
                clockText={storyClockOn ? clockText : undefined}
                initialState={desktopUiRef.current}
                onStateChange={handleDesktopState}
                registerEscape={registerLaptopEscape}
                taskAppId={laptopTaskAppId}
              />
            </div>
          );
        }
        return (
          <LaptopOverlay
            key="laptop"
            view={laptopView}
            dispatch={dispatchVoid}
            onClose={closeLaptop}
            extraTabs={laptopTabs}
            showNotifications={legacyLaptop}
            clockText={storyClockOn ? clockText : undefined}
          />
        );
      case "phone":
        return (
          <PhoneOverlay
            key="phone"
            records={phoneRecords}
            messages={phoneMessages}
            onInspectEvidence={(evidenceId: EvidenceId) => dispatchVoid({ type: "INSPECT_EVIDENCE", evidenceId })}
            onDeviceAction={(deviceActionId: DeviceActionId) => dispatchVoid({ type: "DEVICE_ACTION", deviceActionId })}
            onCallSavedContact={(claimId: ClaimId) => dispatchVoid({ type: "VERIFY_CLAIM", claimId, method: "saved-official-contact" })}
            device={{ view: phoneDevice, onOpenItem: openDeviceItem, onUseItem: useDeviceItem, onView: setDeviceView }}
            mobile={legacyLaptop ? undefined : { blocked: blockedTransfers, bank: bankFacts, portal: portalFacts }}
            browserState={phoneBrowserRef.current}
            onBrowserState={handlePhoneBrowser}
            onClose={closePhone}
            held={phoneCarried ? { screenSink: callSink, mode: modelAllowed ? "model" : "fallback" } : undefined}
            incomingCall={incomingRinging && incomingCaller ? { caller: incomingCaller, onAccept: incoming.answer, onDecline: declineIncoming } : undefined}
          />
        );
      case "planner":
        return (
          <PlannerOverlay
            key="planner"
            events={pendingEvents}
            missions={openMissions}
            thesis={thesisProps}
            onRespond={(eventId, response) => dispatchVoid({ type: "RESPOND_EVENT", eventId, response })}
            onClose={closePlanner}
          />
        );
      case "tasks":
        return (
          <TaskListPanel
            key="tasks"
            open={openMissions}
            closed={closedMissions}
            trackedId={trackedMission?.id ?? null}
            trackedStepId={trackedMission?.current?.id ?? null}
            onTrack={trackMission}
            onTrackStep={trackStep}
            onClose={closeTasks}
            onHoverSound={onHoverSound}
          />
        );
      case "journal":
        return (
          <EvidenceJournal
            key="journal"
            entries={journalEntries}
            claims={claimStatuses}
            decisionOffered={decisionPanel.offered}
            onDecide={handleDecide}
            onClose={closeJournal}
            combination={combination}
            onCombine={(evidenceIds) => dispatch({ type: "COMBINE_EVIDENCE", evidenceIds })}
            relatedDeductions={relatedDeductions}
            hint={currentHint}
          />
        );
      default:
        // `call`, `decision`, `ending`, `debrief` come from `renderExtension` (tasks 10.2, 10.3).
        return null;
    }
  };

  const api: RoomLayerApi = {
    store,
    scenario,
    overlays,
    openOverlay,
    removeOverlay,
    closeTop,
    saveNow,
    introOpen,
  };

  const stopMouseDown = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);
  const laptopOpen = isOpen(overlays, "laptop");
  const hudVisible = !introOpen && status === "playing" && !hideHud && !laptopOpen;
  const phoneUp = phoneCarried && isOpen(overlays, "phone");
  // Unread on the phone: messages and mail that track unread (the chip's badge).
  const phoneUnread = phoneCarried ? phoneDevice.unread.messages + phoneDevice.unread.mail : 0;
  // A call takes the phone: the held phone gives way to the call screen.
  useEffect(() => {
    if (callOpen && phoneCarried && isOpen(overlaysRef.current, "phone")) removeOverlay("phone");
  }, [callOpen, phoneCarried, removeOverlay]);
  // The carried phone is not on the nightstand.
  useEffect(() => {
    if (!engineReady || !phoneCarried) return undefined;
    const commands = bridge.commands;
    commands?.setPhoneCarried?.(true);
    return () => commands?.setPhoneCarried?.(false);
  }, [bridge, engineReady, phoneCarried]);
  // The open laptop covers the room: the room behind it holds still and draws fewer frames.
  useEffect(() => {
    if (!engineReady || !laptopOpen) return undefined;
    const commands = bridge.commands;
    commands?.setBackdrop?.(true);
    return () => commands?.setBackdrop?.(false);
  }, [bridge, engineReady, laptopOpen]);
  // The Writing Mode ends with the laptop; while it is on, the room shows the keyboard and the hands.
  useEffect(() => {
    if (!laptopOpen && writingActive) setWritingActive(false);
  }, [laptopOpen, writingActive]);
  const writingCameraReduced = useRef(writingReducedMotion);
  writingCameraReduced.current = writingReducedMotion;
  useEffect(() => {
    if (!engineReady || !laptopOpen || !writingActive) return undefined;
    const commands = bridge.commands;
    commands?.setWriting?.(true, writingCameraReduced.current);
    return () => commands?.setWriting?.(false, writingCameraReduced.current);
  }, [bridge, engineReady, laptopOpen, writingActive]);
  // The marker over the prop of the current step, while the player walks around indoors (never leaked
  // onto Saigon streets, no overlay, call or inspect pose). The phone is already in Alex's hand during
  // the task flow, so never leave a route marker at its old nightstand position. The tracker still
  // names the phone step; only the stale world-space guide is hidden.
  const currentMarkerTarget = trackedMission?.current?.target ?? null;
  const markerTarget =
    taskMode && hudVisible && !outdoors && !trackerHidden && inspecting === null && !(phoneCarried && currentMarkerTarget === "phone")
      ? currentMarkerTarget
      : null;
  // The marker moves itself (DOM writes per frame); the layer only keeps the whole-metre distance for the tracker.
  const [taskDistance, setTaskDistance] = useState<number | null>(null);
  const markerSource = useCallback<TaskMarkerSource>(
    (prop, listener) => {
      const commands = bridge.commands;
      if (!commands?.watchTaskMarker) return () => undefined;
      commands.watchTaskMarker(prop, listener);
      return () => commands.watchTaskMarker?.(null);
    },
    [bridge],
  );
  const journalUnread = Math.max(0, discoveredCount - journalSeen);
  const completedObjective = completed !== null && Object.hasOwn(scenario.objectives, completed) ? scenario.objectives[completed] : null;
  const objectiveText = (id: ObjectiveId): string => (Object.hasOwn(scenario.objectives, id) ? scenario.objectives[id].text : id);

  const announcementText = (item: Announcement): string => {
    if (item.kind === "notification") return text("room.announce.notification");
    if (item.kind === "evidence") {
      const title = Object.hasOwn(scenario.evidence, item.evidenceId) ? scenario.evidence[item.evidenceId].title : item.evidenceId;
      return text("room.announce.evidence", { title });
    }
    const statement = Object.hasOwn(scenario.deductions, item.deductionId) ? scenario.deductions[item.deductionId].statement : item.deductionId;
    return text("room.announce.deduction", { statement });
  };

  // Lets the laptop and phone-records overlays follow the projected 3D screen (see useScreenQuad).
  const screenSource = useMemo<ScreenQuadSource>(
    () => ({
      watch: (device, listener) => {
        bridge.commands?.watchScreen?.(device, listener);
        return () => bridge.commands?.watchScreen?.(null);
      },
    }),
    [bridge],
  );

  const currentFatigue = fatigueOn ? fatigueLevel(resources.fatigue, gameplay.fatigue) : undefined;
  const hasUnreadHudBadge = phoneUnread > 0 || journalUnread > 0 || pendingEvents.length > 0;
  const chipRailCalm = !callFocused && !hasUnreadHudBadge && overlays.length === 0 && !hintOn;

  return (
    <ScreenQuadContext.Provider value={screenSource}>
    <ComfortProvider settings={settings}>
      <div data-testid="room-chapter-layer" data-ui-mode={uiMode} className="contents">
        {/* Diegetic peripheral fatigue atmosphere (subtle ocular warmth/vignette when tired or exhausted) */}
        {!introOpen && !settings.reducedStress && (currentFatigue === "tired" || currentFatigue === "exhausted") && (
          <div
            aria-hidden="true"
            data-testid="fatigue-atmosphere"
            className="pointer-events-none fixed inset-0 z-[4] transition-opacity duration-1000"
            style={{
              background:
                currentFatigue === "exhausted"
                  ? "radial-gradient(ellipse at 50% 48%, rgba(16,12,24,0) 56%, rgba(18,11,22,0.42) 100%)"
                  : "radial-gradient(ellipse at 50% 48%, rgba(16,12,24,0) 64%, rgba(18,13,24,0.22) 100%)",
            }}
          />
        )}

        {/* Polite live region: new notification, new evidence, recorded deduction (Requirement 22.2). */}
        <div role="status" aria-live="polite" aria-atomic="false" className="sr-only" data-testid="room-live-region">
          {announcements.map((item) => (
            <p key={item.key}>{announcementText(item)}</p>
          ))}
        </div>

        <div role="status" aria-live="polite" className="sr-only" data-testid="world-live-region">
          {arrival ? text("planner.arrival", { title: arrival.title }) : ""}
        </div>
        {/* Outside the HUD: Alex's captions also show over the intro, when the HUD is hidden. */}
        <Mission01VoiceCaption cue={alexVoice.current} subtitlesEnabled={settings.subtitlesEnabled} getPositionMs={alexVoice.positionMs} />
        {hudVisible && (
          <>
            {engineReady && markerTarget !== null && <TaskMarker target={markerTarget} source={markerSource} onDistance={setTaskDistance} />}
            {/* Top left, like the neighborhood HUD: the map with the status ring, the clock beside it, the objective under it. */}
            <div
              className="pointer-events-none absolute left-[clamp(1rem,3vw,2.5rem)] top-4 z-10 flex flex-col items-start gap-3"
              data-testid="objective-tracker-slot"
              style={{
                ...hudScaleStyle(hudScale, "top left"),
                // Focused overlays own the screen: the room HUD steps aside, then returns.
                opacity: trackerHidden ? 0 : 1,
                visibility: trackerHidden ? "hidden" : "visible",
                transition: `opacity ${CINE.motion.baseMs}ms ${CINE.motion.ease}, visibility ${CINE.motion.baseMs}ms`,
              }}
            >
              <ChapterStatusCluster
                resources={resources}
                fatigueLevel={currentFatigue}
                outsideRadar={outdoors ? outsideRadar : null}
                mapCorner={<ChapterTaskButton unseen={tasksUnseen} onOpen={taskMode ? toggleTasks : togglePlanner} onHoverSound={onHoverSound} />}
              />
              {taskMode && trackedMission ? (
                <TaskTracker
                  mission={trackedMission}
                  distance={markerTarget === null ? null : taskDistance}
                  onOpenList={toggleTasks}
                  onHoverSound={onHoverSound}
                />
              ) : null}
              {taskMode && trackedMission && hintOn && (
                <p role="note" aria-label={text("room.hud.hintPanelLabel")} data-testid="room-hint" className={`pl-[34px] font-menu text-sm italic leading-snug text-zinc-400 ${SHADOW}`}>
                  {currentHint ?? text("room.hints.none")}
                </p>
              )}
              {taskMode && trackedMission ? null : (
                <ObjectiveTracker
                  objectives={trackerObjectives}
                  store={store}
                  scenario={scenario}
                  announcement={completed === null ? null : text("room.objectiveToast.done", { objective: objectiveText(completed) })}
                  completed={completedObjective ? [completedObjective] : []}
                  hint={currentHint}
                  hintOn={hintOn}
                />
              )}
            </div>

            {/* Top right: cash, then settings. */}
            <div
              className="absolute right-[clamp(1rem,3vw,2.5rem)] top-4 z-10"
              style={{
                ...hudScaleStyle(hudScale, "top right"),
                opacity: trackerHidden ? 0 : 1,
                visibility: trackerHidden ? "hidden" : "visible",
                transition: `opacity ${CINE.motion.baseMs}ms ${CINE.motion.ease}, visibility ${CINE.motion.baseMs}ms`,
              }}
            >
              <ChapterTopBar cash={resources.cash} onOpenSettings={onOpenSettings} onHoverSound={onHoverSound} />
            </div>

            {/* Visual only: the live region above announces the same events once. */}
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
              style={hudScaleStyle(hudScale, "top center")}>
              {toast && <ObjectiveToast key={toast.key} kind={toast.kind} text={objectiveText(toast.objectiveId)} onDismiss={dismissToast} />}
            </div>

            {/* Bottom right: unified cinema keybind rail (quiet during calm free-roam, wakes up on hover or unread badge). */}
            <div
              className={`absolute bottom-4 right-[clamp(1rem,3vw,2.5rem)] z-10 flex flex-col-reverse items-end gap-2 transition-opacity duration-300 ${
                chipRailCalm ? "opacity-65 hover:opacity-100 focus-within:opacity-100" : "opacity-100"
              }`}
              style={{ ...hudScaleStyle(hudScale, "bottom right"), ...(callFocused ? { zIndex: 45 } : {}) }}
              data-testid="hud-chip-row"
              onMouseDown={stopMouseDown}
            >
              <div className="flex items-center gap-1.5">
                {phoneCarried && (
                  <button
                    type="button"
                    className={HUD_CHIP_CLASS}
                    style={HUD_CHIP_STYLE}
                    aria-pressed={phoneUp}
                    aria-keyshortcuts={PHONE_KEY}
                    data-testid="hud-phone-chip"
                    onClick={togglePhone}
                  >
                    <kbd aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
                      {PHONE_KEY}
                    </kbd>
                    <Smartphone className="h-3.5 w-3.5 text-zinc-200" aria-hidden="true" />
                    <span>{text("hud.phone")}</span>
                    {phoneUnread > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[#b9a5f5] px-1 text-[10px] font-bold leading-4 text-[#171521]"
                        >
                          {phoneUnread}
                        </span>
                        <span className="sr-only">{text("hud.unreadMessages", { count: phoneUnread, number: formatNumber(locale, phoneUnread) })}</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  className={HUD_CHIP_CLASS}
                  style={HUD_CHIP_STYLE}
                  aria-pressed={isOpen(overlays, "journal")}
                  aria-keyshortcuts="J"
                  onClick={toggleJournal}
                >
                  <kbd aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
                    J
                  </kbd>
                  <span>{text("hud.journal")}</span>
                  {journalUnread > 0 && (
                    <>
                      <span
                        aria-hidden="true"
                        className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[#b9a5f5] px-1 text-[10px] font-bold leading-4 text-[#171521]"
                      >
                        {journalUnread}
                      </span>
                      <span className="sr-only">
                        {text("hud.newEntries", { count: journalUnread, number: formatNumber(locale, journalUnread) })}
                      </span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={HUD_CHIP_CLASS}
                  style={HUD_CHIP_STYLE}
                  aria-pressed={isOpen(overlays, "planner")}
                  aria-keyshortcuts="K"
                  data-testid="hud-planner-chip"
                  onClick={togglePlanner}
                >
                  <kbd aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
                    K
                  </kbd>
                  <CalendarClock className="h-3.5 w-3.5 text-zinc-200" aria-hidden="true" />
                  <span>{text("planner.chip")}</span>
                  {pendingEvents.length > 0 && (
                    <>
                      <span
                        aria-hidden="true"
                        className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[#b9a5f5] px-1 text-[10px] font-bold leading-4 text-[#171521]"
                      >
                        {pendingEvents.length}
                      </span>
                      <span className="sr-only">
                        {text("planner.pendingCount", { count: pendingEvents.length, number: formatNumber(locale, pendingEvents.length) })}
                      </span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className={HUD_CHIP_CLASS}
                  style={HUD_CHIP_STYLE}
                  aria-pressed={hintOn}
                  aria-keyshortcuts="H"
                  aria-label={hintOn ? text("room.hints.hide") : text("room.hints.show")}
                  data-testid="hud-hints-chip"
                  onClick={() => setHintOn((on) => !on)}
                >
                  <kbd aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
                    H
                  </kbd>
                  <span aria-hidden="true">{text("room.hints.heading")}</span>
                </button>
                {/* Only while a call is active and nothing is on top of it. Same rail style as Journal and Hint. */}
                {callStatus === "active" && overlays.length === 0 && (
                  <button
                    type="button"
                    className={HUD_CHIP_CLASS}
                    style={HUD_CHIP_STYLE}
                    aria-label={text("room.call.notesLabel")}
                    aria-keyshortcuts="J"
                    data-testid="room-call-notes"
                    onClick={openJournal}
                  >
                    <NotebookText className="h-3.5 w-3.5 text-[#c9bbf7]" aria-hidden="true" />
                    <span>{text("room.call.notes")}</span>
                  </button>
                )}
              </div>
              {mouseHintPhase !== "hidden" && (
                <p
                  className={`pointer-events-none px-2 py-0.5 font-menu text-xs font-medium tracking-[0.06em] text-zinc-300/85 ${SHADOW}`}
                  style={{
                    maxWidth: CINE.widthPx.toast,
                    opacity: mouseHintPhase === "fading" ? 0 : 1,
                    transition: reducedMotionPref ? "none" : `opacity ${CINE.motion.baseMs}ms ${CINE.motion.ease}`,
                  }}
                  role="note"
                  data-testid="room-mouse-hint"
                >
                  {text("room.hud.mouseLockedHint")}
                </p>
              )}
            </div>

            {arrival && (
              <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2" style={{ top: hudOffset(96, hudScale), ...hudScaleStyle(hudScale, "top center") }} aria-hidden="true">
                <EventArrivalNotice
                  key={arrival.key}
                  title={arrival.title}
                  onDismiss={dismissArrival}
                  keyHint={phoneCarried && arrival.onPhone ? { key: PHONE_KEY, label: text("hud.phone") } : undefined}
                />
              </div>
            )}
            <MovementHints active={uiMode === "exploration" && overlays.length === 0 && !introOpen} />
          </>
        )}

        {/* The draft is saved, and then a call: small notices above the laptop too, never a full-screen panel. */}
        {taskMode && (progressNoticeKey !== null || incomingRinging || (incoming.phase === "missed" && missedNoticeSeen !== incoming.callerId)) && (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            // Below the Writing Mode panel while Alex types (the panel holds the top of the screen).
            style={{ top: writingActive ? WRITING_NOTICE_TOP_PX : hudOffset(96, hudScale), zIndex: CINE.toast.zIndex, ...hudScaleStyle(hudScale, "top center") }}
            data-testid="room-call-notice-slot"
            data-below-writing={writingActive ? "true" : undefined}
            role="status"
            aria-live="polite"
          >
            {incomingRinging && incomingCaller ? (
              !phoneUp && (
                <button type="button" className="pointer-events-auto block rounded-2xl text-left" onClick={togglePhone} data-testid="incoming-call-notice">
                  <EventArrivalNotice
                    title={incomingCaller.title}
                    text={text("room.incomingCall.ringing", { name: incomingCaller.title })}
                    icon={<PhoneIncoming className="h-3.5 w-3.5" />}
                    onDismiss={NOOP}
                    durationMs={INCOMING_RING_TIMEOUT_MS + 1000}
                    keyHint={{ key: PHONE_KEY, label: text("hud.phone") }}
                  />
                </button>
              )
            ) : incoming.phase === "missed" && incomingCaller && missedNoticeSeen !== incoming.callerId ? (
              <div data-testid="missed-call-notice">
                <EventArrivalNotice
                  title={incomingCaller.title}
                  text={text("room.incomingCall.missed", { name: incomingCaller.title })}
                  icon={<PhoneMissed className="h-3.5 w-3.5" />}
                  onDismiss={dismissMissedNotice}
                />
              </div>
            ) : progressNoticeKey !== null ? (
              <div data-testid="progress-saved-notice">
                <EventArrivalNotice
                  key={progressNoticeKey}
                  title={text("room.progressSaved", { percent: thesisPercent })}
                  text={text("room.progressSaved", { percent: thesisPercent })}
                  icon={<Save className="h-3.5 w-3.5" />}
                  onDismiss={dismissProgressNotice}
                  durationMs={4500}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Keep diegetic event feedback above the device even while the room HUD steps away. */}
        {notice && (
          <div
            aria-hidden="true"
            data-testid="evidence-notice-slot"
            className="pointer-events-none absolute right-4"
            style={{ top: hudOffset(72, hudScale), zIndex: CINE.toast.zIndex, ...hudScaleStyle(hudScale, "top right") }}
          >
            <EvidenceNotice
              key={notice.key}
              title={Object.hasOwn(scenario.evidence, notice.evidenceId) ? scenario.evidence[notice.evidenceId].title : notice.evidenceId}
              onDismiss={dismissNotice}
            />
          </div>
        )}

        <div ref={overlayLayerRef} onMouseDown={stopMouseDown}>
          {/* Before the overlays in the DOM, so the journal opened from a call is the top dialog. */}
          <RoomPhoneModelLayer
            active={callOpen || phoneUp}
            placement={callOpen ? "call" : "held"}
            modelAllowed={modelAllowed}
            ringing={callRinging}
            screenSink={callSink}
            onModelError={handleModelError}
            onContextChange={setContextLost}
          />
          <RoomCallLayer
            store={store}
            scenario={scenario}
            settings={settings}
            paused={overlays.length > 0}
            modelAllowed={modelAllowed}
            screenSink={callSink}
            engine={engine}
            voiceDeps={voiceDeps}
            onHoverSound={onHoverSound}
          />
          {overlays.map((overlay) => (
            <React.Fragment key={overlay.kind}>{renderOverlay(overlay)}</React.Fragment>
          ))}
          {renderExtension?.(api)}
          <RoomEndingLayer
            store={store}
            scenario={scenario}
            settings={settings}
            overlays={overlays}
            openOverlay={openOverlay}
            removeOverlay={removeOverlay}
            free={free && !callOpen}
            decideRequest={decideRequest}
            narrationDeps={narrationDeps}
            saveSource={saveSource}
            onReturnToMenu={onReturnToMenu}
          />
        </div>

        {saveFailed && (
          <div className="absolute right-4 z-50" style={{ bottom: hudOffset(80, hudScale), ...hudScaleStyle(hudScale, "bottom right") }} onMouseDown={stopMouseDown}>
            <SaveFailureNotice onDismiss={() => setSaveFailed(false)} />
          </div>
        )}

        {saveTrimmedOpen && !introOpen && (
          <div className="absolute left-1/2 z-50 -translate-x-1/2" style={{ top: hudOffset(80, hudScale), ...hudScaleStyle(hudScale, "top center") }} onMouseDown={stopMouseDown}>
            <SaveTrimmedNotice onDismiss={() => setSaveTrimmedOpen(false)} />
          </div>
        )}

        {introOpen && (
          <ChapterIntroOverlay
            ready={engineReady}
            mode={introMode}
            lines={introLines}
            cinematic={!Object.hasOwn(scenario.dialogues, "dlg.intro")}
            holdForVoice={alexVoice.introSpeaking}
            onLineChange={goToIntroLine}
            controlIds={INTRO_CONTROLS}
            voiceGain={voiceGain(
              { soundEnabled: settings.soundEnabled, masterVolume: settings.sfxVolume, voiceVolume: settings.voiceVolume },
              false,
            )}
            onBegin={handleBegin}
          />
        )}
      </div>
    </ComfortProvider>
    </ScreenQuadContext.Provider>
  );
};
/**
 * Memoized: the host page re-renders on every engine UI update (the aimed prop's prompt moves with
 * the camera, so that is almost every frame while the player turns). The layer's props stay the
 * same then, so it skips those renders.
 */
export const RoomChapterLayer = React.memo(RoomChapterLayerView);
