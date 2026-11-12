// React integration of the Chapter 1 voice player (design.md section 5).
// Presentation only: it reads the chapter store and settings, drives one `VoiceDialoguePlayer`
// and returns a controller. It never dispatches to the store, so voice never changes state,
// evidence, decisions or outcomes. Playback ending alone never advances the dialogue.
import type { GameSettings } from "@scammaze/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGameLocale } from "../../../i18n/useGameLocale";
import type { AudioPort, PreviewPort, StopReason } from "../../../game/voice/audioPort";
import { chapter1VoiceManifest } from "../../../game/voice/chapter1.manifest";
import { isSpokenNode } from "../../../game/voice/buildVoiceJobs";
import { createDevSpeechPreview } from "../../../game/voice/devSpeechPreview";
import type { VoiceManifest } from "../../../game/voice/manifestTypes";
import { effectivePauseMs, voiceGain } from "../../../game/voice/mixPlan";
import { areOptionsVisible } from "../../../game/voice/optionsGate";
import type { GatePhase } from "../../../game/voice/optionsGate";
import { createVoiceDialoguePlayer } from "../../../game/voice/VoiceDialoguePlayer";
import type {
  VoiceDialoguePlayer,
  VoiceSettings,
  VoiceSnapshot,
  VoiceTarget,
} from "../../../game/voice/VoiceDialoguePlayer";
import { createWebAudioEngine } from "../../../game/voice/webAudioEngine";
import { selectCurrentAct, selectDialogueView } from "../../../game/narrative/selectors";
import type { ChapterStore } from "../../../game/narrative/store";
import type {
  ChapterState,
  DialogueGraph,
  DialogueNode,
  ScenarioDefinition,
} from "../../../game/narrative/types";
import { useChapterState } from "../useChapterState";

export type VoicePlaybackSettings = Pick<
  GameSettings,
  "soundEnabled" | "sfxVolume" | "voiceVolume" | "phoneVoiceFilter" | "englishVoiceFallback" | "reducedStress"
>;

/** Test seams. Every field is optional; production uses the real engine, preview and clock. */
export interface VoicePlaybackDeps {
  manifest?: VoiceManifest;
  /** Port factory, called once per mount. Default: `createWebAudioEngine`. */
  createPort?: () => AudioPort;
  /** Preview factory, called once per mount. Default: `createDevSpeechPreview`. */
  createPreview?: () => PreviewPort | null;
  /** Presentation clock in ms. Default: `performance.now()`. */
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
  log?: (message: string) => void;
}

export interface UseVoicePlaybackOptions {
  store: ChapterStore;
  /** Display scenario (its lines are only used by the developer preview). */
  scenario: ScenarioDefinition;
  settings: VoicePlaybackSettings;
  /** True while the pause overlay is on top. */
  paused: boolean;
  /** Defaults to the current UI language. */
  locale?: VoiceSettings["locale"];
  deps?: VoicePlaybackDeps;
}

export interface VoiceController {
  snapshot: VoiceSnapshot;
  muted: boolean;
  /** Call inside a user gesture (a click handler). */
  unlock: () => Promise<void>;
  replay: () => void;
  setMuted: (muted: boolean) => void;
  /** True while the player's options are held back for the voice line. */
  optionsWaiting: boolean;
  /** "Show replies now". */
  skipWait: () => void;
}

const IDLE_SNAPSHOT: VoiceSnapshot = {
  phase: "idle",
  targetKey: null,
  source: "none",
  label: "none",
  reason: null,
  muted: false,
  audible: false,
  durationMs: null,
  endedCount: 0,
};

const GATE_POLL_MS = 100;
/** How many option hops ahead of the current node are prefetched. */
const PREFETCH_HOPS = 3;

const defaultNow = (): number => performance.now();
const defaultSetTimer = (fn: () => void, ms: number): number => window.setTimeout(fn, ms);
const defaultClearTimer = (id: number): void => window.clearTimeout(id);
const defaultLog = (message: string): void => {
  console.debug(message);
};

const noopUnsubscribe = (): void => undefined;

interface NodeRef {
  graphId: DialogueGraph["id"];
  nodeId: string;
}

/** Spoken nodes reachable from `startIds` by following options, nearest first. */
function collectSpoken(graph: DialogueGraph, startIds: readonly string[], hops: number): NodeRef[] {
  const result: NodeRef[] = [];
  const seen = new Set<string>();
  let frontier = [...startIds];
  for (let depth = 0; depth <= hops && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id) || !Object.hasOwn(graph.nodes, id)) continue;
      seen.add(id);
      const node = graph.nodes[id];
      if (isSpokenNode(node)) result.push({ graphId: graph.id, nodeId: id });
      for (const option of node.options) {
        if (typeof option.next === "string") next.push(option.next);
      }
    }
    frontier = next;
  }
  return result;
}

function startNodeIds(graph: DialogueGraph): string[] {
  return [graph.startNodeId, ...(graph.startNodeWhen ?? []).map((entry) => entry.nodeId)];
}

/** Builds the voice target for a node, or null when the node is not spoken. */
function buildTarget(
  graph: DialogueGraph,
  node: DialogueNode,
  channel: VoiceTarget["channel"],
  reducedStress: boolean,
): VoiceTarget | null {
  if (!isSpokenNode(node) || node.tone === undefined) return null;
  const speakerId = node.speakerId ?? graph.persona.speakerId;
  if (speakerId === undefined) return null;
  const authored = node.pauseBeforeMs;
  const base = effectivePauseMs(node.tone, reducedStress);
  // An authored pause wins; reduced stress still adds the extra pause for tense tones.
  const pauseBeforeMs =
    typeof authored === "number" && Number.isFinite(authored)
      ? authored + (base - effectivePauseMs(node.tone, false))
      : base;
  return {
    key: `${graph.id}:${node.id}`,
    graphId: graph.id,
    nodeId: node.id,
    speakerId,
    tone: node.tone,
    channel,
    lineText: Object.hasOwn(graph.lines, node.lineId) ? graph.lines[node.lineId] : "",
    pauseBeforeMs,
  };
}

const callSelector = (state: ChapterState) => state.call;

export function useVoicePlayback(options: UseVoicePlaybackOptions): VoiceController {
  const { store, scenario, settings, paused, deps } = options;
  const uiLocale = useGameLocale();
  const locale = options.locale ?? uiLocale;
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const now = deps?.now ?? defaultNow;
  const setTimer = deps?.setTimer ?? defaultSetTimer;
  const clearTimer = deps?.clearTimer ?? defaultClearTimer;

  // --- One player per mount -------------------------------------------------------------------
  // Created in an effect so a development double mount gets a live player, not a disposed one.
  const [player, setPlayer] = useState<VoiceDialoguePlayer | null>(null);
  // The preview port exists only when the developer flag enabled it.
  const devPreviewRef = useRef(false);
  useEffect(() => {
    const d = depsRef.current;
    const preview = (d?.createPreview ?? createDevSpeechPreview)();
    devPreviewRef.current = preview !== null;
    const created = createVoiceDialoguePlayer({
      manifest: d?.manifest ?? chapter1VoiceManifest,
      port: (d?.createPort ?? createWebAudioEngine)(),
      preview,
      now: d?.now ?? defaultNow,
      setTimer: d?.setTimer ?? defaultSetTimer,
      clearTimer: d?.clearTimer ?? defaultClearTimer,
      log: d?.log ?? defaultLog,
    });
    setPlayer(created);
    return () => {
      created.stop("dispose");
      created.dispose();
      setPlayer((current) => (current === created ? null : current));
    };
  }, []);

  // --- Settings -------------------------------------------------------------------------------
  const { soundEnabled, sfxVolume, voiceVolume, phoneVoiceFilter, englishVoiceFallback, reducedStress } = settings;
  useEffect(() => {
    if (player === null) return;
    player.configure({
      locale,
      soundEnabled,
      masterVolume: sfxVolume,
      voiceVolume,
      phoneFilter: phoneVoiceFilter,
      englishVoiceFallback,
      devPreview: devPreviewRef.current,
    });
  }, [player, locale, soundEnabled, sfxVolume, voiceVolume, phoneVoiceFilter, englishVoiceFallback]);

  // --- Current target -------------------------------------------------------------------------
  const call = useChapterState(store, callSelector);
  const dialogueSelector = useCallback(
    (state: ChapterState) => selectDialogueView(state, scenario),
    [scenario],
  );
  const view = useChapterState(store, dialogueSelector);

  const node: DialogueNode | null = useMemo(() => {
    if (view === null || !Object.hasOwn(scenario.dialogues, view.graphId)) return null;
    const graph = scenario.dialogues[view.graphId];
    return Object.hasOwn(graph.nodes, view.nodeId) ? graph.nodes[view.nodeId] : null;
  }, [scenario, view]);

  const target: VoiceTarget | null = useMemo(() => {
    if (view === null || node === null) return null;
    const phoneCall =
      view.channel === "phone" &&
      view.callId !== null &&
      view.callId === call.current &&
      call.status === "active";
    const faceToFace = view.channel === "face-to-face" && view.callId === null;
    if (!phoneCall && !faceToFace) return null;
    return buildTarget(scenario.dialogues[view.graphId], node, view.channel, reducedStress);
  }, [view, node, call.current, call.status, scenario, reducedStress]);

  const targetKey = target?.key ?? null;
  const targetRef = useRef(target);
  targetRef.current = target;
  const stopReasonRef = useRef<StopReason>("node-changed");
  stopReasonRef.current = call.status === "ended" || call.status === "declined" ? "call-ended" : "node-changed";
  const hadTargetRef = useRef(false);

  useEffect(() => {
    if (player === null) return;
    const current = targetRef.current;
    if (current !== null) {
      hadTargetRef.current = true;
      player.show(current);
    } else if (hadTargetRef.current) {
      hadTargetRef.current = false;
      player.stop(stopReasonRef.current);
    }
  }, [player, targetKey]);

  // --- Pause overlay --------------------------------------------------------------------------
  useEffect(() => {
    if (player === null) return;
    if (paused) player.pause();
    else player.resume();
  }, [player, paused]);

  // --- Mute resets per call -------------------------------------------------------------------
  const callKey = call.status === "active" ? call.current : null;
  useEffect(() => {
    if (player === null || callKey === null) return;
    player.setMuted(false);
  }, [player, callKey]);

  // --- Prefetch -------------------------------------------------------------------------------
  const act = useChapterState(store, useCallback((state: ChapterState) => selectCurrentAct(state, scenario), [scenario]));
  const actId = act.id;
  useEffect(() => {
    if (player === null) return;
    // Acts 1 and 2 lead to the first call: warm its opening lines.
    if (actId === "act.1" || actId === "act.2") {
      const firstCall = Object.values(scenario.calls)[0];
      if (firstCall !== undefined && Object.hasOwn(scenario.dialogues, firstCall.graphId)) {
        const graph = scenario.dialogues[firstCall.graphId];
        player.prefetch(collectSpoken(graph, startNodeIds(graph), 1));
      }
    }
  }, [player, scenario, actId]);

  useEffect(() => {
    if (player === null || view === null || !Object.hasOwn(scenario.dialogues, view.graphId)) return;
    const graph = scenario.dialogues[view.graphId];
    const upcoming = collectSpoken(graph, [view.nodeId], PREFETCH_HOPS).filter(
      (ref) => ref.nodeId !== view.nodeId,
    );
    if (upcoming.length > 0) player.prefetch(upcoming);
  }, [player, scenario, view?.graphId, view?.nodeId]);

  // --- Snapshot -------------------------------------------------------------------------------
  const subscribe = useCallback(
    (listener: () => void) => (player === null ? noopUnsubscribe : player.subscribe(listener)),
    [player],
  );
  const getSnapshot = useCallback(() => (player === null ? IDLE_SNAPSHOT : player.getSnapshot()), [player]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // --- Choice gate ----------------------------------------------------------------------------
  const [skippedKey, setSkippedKey] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const startRef = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  if (startRef.current.key !== targetKey) startRef.current = { key: targetKey, at: now() };
  const endRef = useRef<{ count: number; at: number | null }>({ count: snapshot.endedCount, at: null });
  if (endRef.current.count !== snapshot.endedCount) {
    endRef.current = { count: snapshot.endedCount, at: now() };
  }

  const waitForVoice = target !== null && node?.waitForVoice === true;
  const snapshotIsCurrent = snapshot.targetKey === targetKey;
  const gainAudible = voiceGain({ soundEnabled, masterVolume: sfxVolume, voiceVolume }, snapshot.muted) > 0;
  const gatePhase: GatePhase =
    !snapshotIsCurrent
      ? "loading"
      : snapshot.phase === "paused"
        ? "playing"
        : snapshot.phase;
  const gateTime = now();
  const visible = areOptionsVisible({
    waitForVoice,
    phase: gatePhase,
    audible: snapshotIsCurrent ? snapshot.audible || snapshot.phase === "loading" : gainAudible,
    durationMs: snapshotIsCurrent ? snapshot.durationMs : null,
    elapsedSinceStartMs: gateTime - startRef.current.at,
    elapsedSinceEndMs:
      snapshotIsCurrent && snapshot.phase === "ended" && endRef.current.at !== null
        ? gateTime - endRef.current.at
        : null,
    skipped: skippedKey !== null && skippedKey === targetKey,
  });
  const optionsWaiting = waitForVoice && !visible;

  // Re-evaluate the time based parts of the gate while options are held back.
  const [pollCount, setPollCount] = useState(0);
  useEffect(() => {
    if (!optionsWaiting) return undefined;
    const id = setTimer(() => {
      setTick((n) => n + 1);
      setPollCount((n) => n + 1);
    }, GATE_POLL_MS);
    return () => clearTimer(id);
  }, [optionsWaiting, pollCount, setTimer, clearTimer]);

  // --- Controls -------------------------------------------------------------------------------
  const unlock = useCallback(async () => {
    await player?.unlock();
  }, [player]);
  const replay = useCallback(() => {
    player?.replay();
  }, [player]);
  const setMuted = useCallback(
    (muted: boolean) => {
      player?.setMuted(muted);
    },
    [player],
  );
  const skipWait = useCallback(() => {
    setSkippedKey(targetRef.current?.key ?? null);
  }, []);

  return {
    snapshot,
    muted: snapshot.muted,
    unlock,
    replay,
    setMuted,
    optionsWaiting,
    skipWait,
  };
}
