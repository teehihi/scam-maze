/**
 * Chapter_Page for Chapter 1 "The Urgent Call" (Requirements 1.4 to 1.6, 2.6, 3.4 to 3.6, 4.1,
 * 4.4 to 4.9). See design.md, "Rendering layer" and "Overlay and input rules".
 *
 * The page owns the Chapter_Store, the overlay stack and the input flag. It reads state through
 * `useChapterState` and writes only through `store.dispatch`. Punches stay inside the player
 * runtime and never reach the store (Requirement 2.6).
 *
 * The phone overlay and the face-to-face dialogue overlay are wired here (task 9.3,
 * Requirements 4.8, 7.1, 8.3, 10.7, 10.8). The evidence journal and the decision panel are wired
 * here (task 10.3, Requirements 4.9, 11.6, 13.1): the decision panel opens from the journal and
 * from the phone home screen while it is offered. The ending transition and the debrief are wired
 * here (task 11.2, Requirements 1.7, 14.1, 14.2). Checkpoint saves, the pause menu, Restart and
 * Replay are wired here (task 12.2, Requirements 15.12 to 15.14). A ringing or active call is
 * shown by `CallPresentation` on a locked `call` overlay entry, with the 3D phone in the canvas
 * when WebGL and the phone model are available (game-3d-phone-call-ui task 10.4).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import { usePrefersReducedMotion } from "../../components/ui/usePrefersReducedMotion";
import { CALL_PHONE_GLB } from "../../config/assetPaths";
import { getChapter } from "../../game/chapters/chapterRegistry";
import { checkBasicWebGLSupport } from "../../game/loading/deviceCapabilities";
import type { ChapterSession } from "../../game/chapters/chapterSession";
import type { DecisionId, EvidenceId, InteractableId, ObjectiveId } from "../../game/narrative/chapter1/ids";
import { buildDebrief } from "../../game/narrative/debrief";
import { createInitialState } from "../../game/narrative/reducer";
import {
  selectActiveObjectives,
  selectCallLog,
  selectClaimStatuses,
  selectDecisionPanel,
  selectDialogueView,
  selectJournalEntries,
  selectPhoneMessages,
} from "../../game/narrative/selectors";
import { createChapterStore, type ChapterStore } from "../../game/narrative/store";
import type { ChapterState } from "../../game/narrative/types";
import { createLocalStorageSaveSource, type SaveGameSource } from "../../game/saves/saveGame";
import { getDisplayPrompts, useDisplayScenario } from "../../i18n/narrative";
import { useGameLocale } from "../../i18n/useGameLocale";
import { usePlayerControls } from "../player";
import { CallPresentation } from "./call/CallPresentation";
import { hasPhoneModelFailed, reportPhoneModelFailure } from "./call/phoneModelStatus";
import { createPhoneScreenSink } from "./call/phoneScreenSink";
import { ChapterOneCanvas, type ChapterOneCallPhone, type ChapterOnePlayerPose } from "./ChapterOneCanvas";
import { EvidenceNotice } from "./hud/EvidenceNotice";
import { HudButtons } from "./hud/HudButtons";
import { InteractionPrompt } from "./hud/InteractionPrompt";
import { ObjectiveToast, type ObjectiveChangeKind } from "./hud/ObjectiveToast";
import { ObjectiveTracker } from "./hud/ObjectiveTracker";
import { ResumePrompt } from "./hud/ResumePrompt";
import { SaveFailureNotice } from "./hud/SaveFailureNotice";
import { interactionToAction } from "./interaction/interactionToAction";
import { ChapterTitleCard } from "./intro/ChapterTitleCard";
import { DebriefScreen } from "./debrief/DebriefScreen";
import { DecisionPanel } from "./decision/DecisionPanel";
import { DialoguePanel } from "./dialogue/DialoguePanel";
import { EndingTransition } from "./ending/EndingTransition";
import { focusDialogStart, topDialog, trapTabKey } from "./focusTrap";
import { EvidenceJournal } from "./journal/EvidenceJournal";
import { EMPTY_OVERLAYS, isOpen, pop, push, top, type Overlay, type OverlayKind, type OverlayStack } from "./overlays";
import { InspectionPanel } from "./panels/InspectionPanel";
import { PauseMenu } from "./pause/PauseMenu";
import { PhoneOverlay } from "./phone/PhoneOverlay";
import { UI } from "./theme";
import { useCallTriggers } from "./useCallTriggers";
import { useChapterState } from "./useChapterState";
import { useCheckpointSaver } from "./useCheckpointSaver";

export interface ChapterOnePageProps {
  session: ChapterSession;
  settings: GameSettings;
  onReturnToMenu: () => void;
  /** Where Checkpoints are written. Defaults to this device's local storage. */
  saveSource?: SaveGameSource;
}

/** Spawn pose for the canvas. Undefined fields mean the chapter spawn point. */
interface SpawnPose {
  position?: [number, number, number];
  yaw?: number;
}

const DEFAULT_SPAWN: SpawnPose = Object.freeze({});

/** Overlays that Escape never closes (Requirement 4.6; `call`: 3D phone call Requirement 7.5). */
const ESCAPE_LOCKED: ReadonlySet<OverlayKind> = new Set(["ending", "debrief", "call"]);

/** Queued items keep IDs only; text is resolved at render, so a language switch updates them. */
interface ToastItem {
  key: number;
  kind: ObjectiveChangeKind;
  objectiveId: ObjectiveId;
}

interface NoticeItem {
  key: number;
  evidenceId: EvidenceId;
}

/**
 * True while a Call rings or is active and the chapter has no outcome yet. Once an outcome is
 * set the core rejects END_CALL, so the phone must not stay locked on a call screen.
 */
function callInProgress(state: ChapterState): boolean {
  if (state.outcome !== null) return false;
  return state.call.status === "ringing" || state.call.current !== null;
}

/**
 * The overlay the chapter end requires, or `null` while the chapter has no Outcome: the ending
 * transition while `ended`, the debrief once `finished` (Requirements 14.1, 14.2).
 */
function endOverlayFor(state: ChapterState): Overlay | null {
  if (state.outcome === null) return null;
  return state.status === "finished" ? { kind: "debrief" } : { kind: "ending" };
}

/** True while a face-to-face conversation (no linked Call) is running. */
function faceToFaceInProgress(state: ChapterState): boolean {
  return state.conversation !== null && state.conversation.callId === null;
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
 * Collects objective changes and new evidence since the last seen event, so the HUD can show a
 * toast or notice for each. Starts at the current log length, so restored history is not replayed.
 */
function useHudNotices(store: ChapterStore) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  // The objective whose completion is announced to screen readers.
  const [announcement, setAnnouncement] = useState<ObjectiveId | null>(null);

  useEffect(() => {
    let seenEvents = store.getState().events.length;
    let seenEvidence = store.getState().discovered.length;
    let nextKey = 0;

    return store.subscribe(() => {
      const state = store.getState();
      // `replace` (restart or replay) can shorten the log: drop the queued items from the old
      // run and start counting again from there.
      if (state.events.length < seenEvents || state.discovered.length < seenEvidence) {
        seenEvents = Math.min(seenEvents, state.events.length);
        seenEvidence = Math.min(seenEvidence, state.discovered.length);
        setToasts([]);
        setNotices([]);
        setAnnouncement(null);
      }

      const newToasts: ToastItem[] = [];
      for (const event of state.events.slice(seenEvents)) {
        for (const id of event.derived.objectivesCompleted) {
          newToasts.push({ key: nextKey++, kind: "completed", objectiveId: id });
        }
        for (const id of event.derived.objectivesActivated) {
          newToasts.push({ key: nextKey++, kind: "activated", objectiveId: id });
        }
      }
      seenEvents = state.events.length;

      const newNotices: NoticeItem[] = state.discovered
        .slice(seenEvidence)
        .map((id) => ({ key: nextKey++, evidenceId: id }));
      seenEvidence = state.discovered.length;

      if (newToasts.length > 0) {
        setToasts((queue) => [...queue, ...newToasts]);
        const lastCompleted = [...newToasts].reverse().find((toast) => toast.kind === "completed");
        if (lastCompleted) setAnnouncement(lastCompleted.objectiveId);
      }
      if (newNotices.length > 0) setNotices((queue) => [...queue, ...newNotices]);
    });
  }, [store]);

  const dismissToast = useCallback(() => setToasts((queue) => queue.slice(1)), []);
  const dismissNotice = useCallback(() => setNotices((queue) => queue.slice(1)), []);

  return { toast: toasts[0] ?? null, notice: notices[0] ?? null, announcement, dismissToast, dismissNotice };
}

export const ChapterOnePage: React.FC<ChapterOnePageProps> = ({
  session,
  settings,
  onReturnToMenu,
  saveSource: saveSourceProp,
}) => {
  const chapter = getChapter(session.chapterId);

  // Created once per mount; a passed source (for example in tests) takes precedence.
  const [defaultSaveSource] = useState(() => createLocalStorageSaveSource());
  const saveSource = saveSourceProp ?? defaultSaveSource;

  // Created once per mount: a fresh chapter or the state replayed by the loader.
  const [store] = useState(() => createChapterStore(session.restored?.state ?? createInitialState()));
  // Begin for a fresh chapter, Continue for a restored one in progress. Replay resets it to Begin.
  const [titleMode, setTitleMode] = useState<"begin" | "continue">(() =>
    store.getState().status === "not-started" ? "begin" : "continue",
  );

  // Read once at mount and kept stable: a new array would re-create the player runtime.
  // Restart and Replay reset it to the chapter spawn point and remount the canvas (`canvasKey`),
  // because the player runtime keeps its position from mount.
  const [spawn, setSpawn] = useState<SpawnPose>(() => {
    const pose = session.restored?.pose;
    return pose ? { position: [pose.position[0], pose.position[1], pose.position[2]], yaw: pose.yaw } : DEFAULT_SPAWN;
  });
  const [canvasKey, setCanvasKey] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);

  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  // Display text only. The store and reducer keep the canonical scenario, so the language never
  // changes Chapter_State. The reference changes only when the language changes; the selectors
  // below are memoized by (state, scenario), so each selector callback is stable per language
  // and a language switch gives new snapshots and a re-render.
  const scenario = useDisplayScenario();
  const activeObjectivesSelector = useCallback((state: ChapterState) => selectActiveObjectives(state, scenario), [scenario]);
  const dialogueViewSelector = useCallback((state: ChapterState) => selectDialogueView(state, scenario), [scenario]);
  const phoneMessagesSelector = useCallback((state: ChapterState) => selectPhoneMessages(state, scenario), [scenario]);
  const callLogSelector = useCallback((state: ChapterState) => selectCallLog(state, scenario), [scenario]);
  const journalEntriesSelector = useCallback((state: ChapterState) => selectJournalEntries(state, scenario), [scenario]);
  const claimStatusesSelector = useCallback((state: ChapterState) => selectClaimStatuses(state, scenario), [scenario]);
  const decisionPanelSelector = useCallback((state: ChapterState) => selectDecisionPanel(state, scenario), [scenario]);

  const status = useChapterState(store, (state) => state.status);
  const activeObjectives = useChapterState(store, activeObjectivesSelector);
  const discovered = useChapterState(store, (state) => state.discovered);
  const phoneUnread = useChapterState(store, (state) => state.phone.unread.length);
  const call = useChapterState(store, (state) => state.call);
  const callBusy = useChapterState(store, callInProgress);
  const faceToFaceActive = useChapterState(store, faceToFaceInProgress);
  const dialogueView = useChapterState(store, dialogueViewSelector);
  const phoneMessages = useChapterState(store, phoneMessagesSelector);
  const callLog = useChapterState(store, callLogSelector);
  const journalEntries = useChapterState(store, journalEntriesSelector);
  const claimStatuses = useChapterState(store, claimStatusesSelector);
  const decisionPanel = useChapterState(store, decisionPanelSelector);
  const outcome = useChapterState(store, (state) => state.outcome);
  // Rebuilt only when the state or the language changes; `null` until an Outcome is set.
  const chapterState = useChapterState(store);
  const debriefView = useMemo(() => buildDebrief(chapterState, scenario), [chapterState, scenario]);

  const [sceneReady, setSceneReady] = useState(false);
  // A restored session that has already ended goes straight to the ending or the debrief.
  const [titleCardOpen, setTitleCardOpen] = useState(() => endOverlayFor(store.getState()) === null);
  const [overlays, setOverlays] = useState<OverlayStack>(() => {
    const end = endOverlayFor(store.getState());
    return end ? Object.freeze([end]) : EMPTY_OVERLAYS;
  });
  const [focusedId, setFocusedId] = useState<InteractableId | null>(null);
  const [journalSeen, setJournalSeen] = useState(() => store.getState().discovered.length);

  const overlayOpen = titleCardOpen || overlays.length > 0;
  // False while any overlay is open, including the `call` entry: the player is disabled for the
  // whole call and `usePlayerControls` releases pointer lock (Requirements 6.1, 6.2).
  const inputEnabled = status === "playing" && !overlayOpen;

  // --- 3D call phone (game-3d-phone-call-ui, Requirements 1.7, 8.1, 8.2, 8.7, 8.8) ------------
  const [webglAvailable] = useState(() => checkBasicWebGLSupport());
  const [webglLost, setWebglLost] = useState(false);
  const [phoneModelFailed, setPhoneModelFailed] = useState(() => hasPhoneModelFailed());
  const [phoneScreenSink] = useState(createPhoneScreenSink);
  const callOpenedAtRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const modelAllowed = webglAvailable && !webglLost && !phoneModelFailed;
  const phoneModelEnabled = webglAvailable && !phoneModelFailed;
  const paused = top(overlays)?.kind === "pause";
  const callOverlayOpen = isOpen(overlays, "call");
  const callRinging = call.status === "ringing";
  const callPhone = useMemo<ChapterOneCallPhone | null>(
    () =>
      callOverlayOpen && callBusy && modelAllowed
        ? { ringing: callRinging, reducedMotion, openedAt: callOpenedAtRef.current, screenSink: phoneScreenSink }
        : null,
    [callBusy, callOverlayOpen, callRinging, modelAllowed, phoneScreenSink, reducedMotion],
  );

  /** A model load failure is reported once per page session; the call falls back to 2D. */
  const handlePhoneModelError = useCallback((error: unknown) => {
    reportPhoneModelFailure(CALL_PHONE_GLB, error);
    setPhoneModelFailed(true);
  }, []);
  const handleWebGLContextChange = useCallback((lost: boolean) => setWebglLost(lost), []);

  const gameViewRef = useRef<HTMLDivElement>(null);
  const { keysRef, isLocked, lockPointer, consumeMovement, consumePunchTrigger, consumeInspectTrigger, consumeInteractTrigger } =
    usePlayerControls(gameViewRef, { enabled: inputEnabled });

  const poseGetterRef = useRef<(() => ChapterOnePlayerPose) | null>(null);

  // Focus management (Requirements 17.2, 17.3): the element focused when each overlay opened,
  // and the layer the overlays render into.
  const overlayLayerRef = useRef<HTMLDivElement>(null);
  const openersRef = useRef(new Map<OverlayKind, HTMLElement>());

  // Latest values for event handlers registered once.
  const focusedRef = useRef<InteractableId | null>(null);
  const inputEnabledRef = useRef(inputEnabled);
  const overlaysRef = useRef(overlays);
  const titleCardOpenRef = useRef(titleCardOpen);
  useEffect(() => {
    inputEnabledRef.current = inputEnabled;
    overlaysRef.current = overlays;
    titleCardOpenRef.current = titleCardOpen;
  }, [inputEnabled, overlays, titleCardOpen]);

  useCallTriggers(store, overlayOpen);
  const { toast, notice, announcement, dismissToast, dismissNotice } = useHudNotices(store);

  // Requirement 15.14: a failed write shows a notice; gameplay continues without saving.
  const handleWriteFailure = useCallback(() => setSaveFailed(true), []);
  const dismissSaveFailure = useCallback(() => setSaveFailed(false), []);
  const { saveNow } = useCheckpointSaver({
    store,
    saveSource,
    poseGetterRef,
    chapterId: session.chapterId,
    sceneId: session.sceneId,
    onWriteFailure: handleWriteFailure,
  });

  // --- Overlay stack -------------------------------------------------------------------------

  /** Computes the next stack from the latest one and keeps the ref in step with the state. */
  const updateOverlays = useCallback((change: (stack: OverlayStack) => OverlayStack) => {
    const next = change(overlaysRef.current);
    if (next === overlaysRef.current) return;
    overlaysRef.current = next;
    setOverlays(next);
  }, []);

  /**
   * Pushes an overlay. Opening the phone dispatches OPEN_PHONE; the core rejects it harmlessly
   * when the phone is already open or the chapter is not playing.
   */
  const openOverlay = useCallback(
    (overlay: Overlay) => {
      if (overlay.kind === "journal") setJournalSeen(store.getState().discovered.length);
      // Remember where focus was, so closing this overlay can return it there (Requirement 17.3).
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) openersRef.current.set(overlay.kind, active);
      else openersRef.current.delete(overlay.kind);
      if (overlay.kind === "phone" && !isOpen(overlaysRef.current, "phone")) {
        store.dispatch({ type: "OPEN_PHONE" });
      }
      updateOverlays((stack) => push(stack, overlay));
    },
    [store, updateOverlays],
  );

  /** Removes the overlay of `kind` wherever it is. Closing the phone dispatches CLOSE_PHONE. */
  const removeOverlay = useCallback(
    (kind: OverlayKind) => {
      if (!isOpen(overlaysRef.current, kind)) return;
      if (kind === "phone") store.dispatch({ type: "CLOSE_PHONE" });
      updateOverlays((stack) => Object.freeze(stack.filter((entry) => entry.kind !== kind)));
    },
    [store, updateOverlays],
  );

  const closeTop = useCallback(() => {
    const current = top(overlaysRef.current);
    if (current?.kind === "phone") store.dispatch({ type: "CLOSE_PHONE" });
    updateOverlays((stack) => pop(stack));
  }, [store, updateOverlays]);

  /**
   * The phone cannot close while a call rings or is active, and the face-to-face dialogue cannot
   * close while the conversation runs: the player answers with the options, which always include
   * a fallback (design, "Overlay and input rules").
   */
  const canClose = useCallback(
    (overlay: Overlay) => {
      if (ESCAPE_LOCKED.has(overlay.kind)) return false;
      const state = store.getState();
      if (overlay.kind === "phone" && callInProgress(state)) return false;
      if (overlay.kind === "dialogue" && faceToFaceInProgress(state)) return false;
      return true;
    },
    [store],
  );

  /**
   * P and J (and the HUD buttons): open when nothing else is open, close when that overlay is the
   * top-most one and may close (Requirements 4.8, 4.9).
   */
  const toggleOverlay = useCallback(
    (kind: "phone" | "journal") => {
      if (titleCardOpenRef.current || store.getState().status !== "playing") return;
      const stack = overlaysRef.current;
      const current = top(stack);
      if (stack.length === 0) {
        openOverlay({ kind });
      } else if (current?.kind === kind && canClose(current)) {
        closeTop();
      }
    },
    [canClose, closeTop, openOverlay, store],
  );

  /** The phone's own close button. Ignored while a call rings or is active. */
  const handleClosePhone = useCallback(() => {
    if (!canClose({ kind: "phone" })) return;
    removeOverlay("phone");
  }, [canClose, removeOverlay]);

  // A ringing call, or an active call such as the official line started from the decision
  // panel, pushes the locked `call` overlay (no OPEN_PHONE). When the call ends, the entry is
  // removed wherever it is (also under a pause), so the stack equals the pre-call stack
  // (game-3d-phone-call-ui Requirements 1.1, 6.8, 6.9, 7.5).
  useEffect(() => {
    if (titleCardOpen || status !== "playing") return;
    const open = isOpen(overlays, "call");
    if (callBusy && !open) {
      callOpenedAtRef.current = performance.now();
      openOverlay({ kind: "call" });
    } else if (!callBusy && open) {
      removeOverlay("call");
    }
  }, [callBusy, openOverlay, overlays, removeOverlay, status, titleCardOpen]);

  // The face-to-face dialogue overlay follows the conversation: it closes when the conversation
  // ends and reopens if one is running (for example after a restore).
  useEffect(() => {
    const dialogueOpen = isOpen(overlays, "dialogue");
    if (!faceToFaceActive) {
      if (dialogueOpen) removeOverlay("dialogue");
      return;
    }
    if (!dialogueOpen && !titleCardOpen && status === "playing") openOverlay({ kind: "dialogue" });
  }, [faceToFaceActive, openOverlay, overlays, removeOverlay, status, titleCardOpen]);

  // Chapter end (Requirements 1.7, 14.1, 14.2): once an Outcome is set, every other overlay
  // closes, including the locked `call` overlay (the money-moved path sets the Outcome during an
  // active call; `callInProgress` is false from then on). The ending shows while `ended`, the
  // debrief once `finished`. No CLOSE_PHONE is dispatched: the core accepts only FINISH_CHAPTER now.
  useEffect(() => {
    const end = endOverlayFor(store.getState());
    if (!end) return;
    setTitleCardOpen(false);
    updateOverlays((stack) => (stack.length === 1 && stack[0].kind === end.kind ? stack : Object.freeze([end])));
  }, [outcome, status, store, updateOverlays]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      if (titleCardOpenRef.current) return;

      if (event.key === "Escape") {
        const current = top(overlaysRef.current);
        if (current) {
          // Requirement 4.6: close the top-most overlay, except locked ones.
          if (canClose(current)) {
            event.preventDefault();
            closeTop();
          }
        } else if (store.getState().status === "playing") {
          // Requirement 4.7: open the pause menu.
          event.preventDefault();
          openOverlay({ kind: "pause" });
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "KeyP") {
        event.preventDefault();
        toggleOverlay("phone");
      } else if (event.code === "KeyJ") {
        event.preventDefault();
        toggleOverlay("journal");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canClose, closeTop, openOverlay, store, toggleOverlay]);

  // Tab and Shift+Tab stay inside the top-most overlay while one is open (Requirement 17.2).
  useEffect(() => {
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || overlaysRef.current.length === 0) return;
      const dialog = topDialog(overlayLayerRef.current);
      if (dialog) trapTabKey(dialog, event);
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, []);

  // Requirement 17.3: when the top-most overlay closes, focus returns to the element that opened
  // it if that element is still in the overlay now on top; otherwise to the start of that
  // overlay, or to the game view once no overlay is left. New overlays (for example the ending
  // replacing the stack) and the title card move focus themselves, so they are skipped here.
  const previousOverlaysRef = useRef(overlays);
  useEffect(() => {
    const previous = previousOverlaysRef.current;
    previousOverlaysRef.current = overlays;
    const closed = top(previous);
    if (!closed || isOpen(overlays, closed.kind)) return;

    const opener = openersRef.current.get(closed.kind) ?? null;
    for (const entry of previous) {
      if (!isOpen(overlays, entry.kind)) openersRef.current.delete(entry.kind);
    }
    if (titleCardOpen || overlays.some((entry) => !isOpen(previous, entry.kind))) return;

    const dialog = topDialog(overlayLayerRef.current);
    if (dialog) {
      if (opener?.isConnected && dialog.contains(opener)) opener.focus({ preventScroll: true });
      else focusDialogStart(dialog);
      return;
    }
    // The HUD buttons are not used as a target: a focused HUD button would also react to
    // Space (jump) and Enter during play.
    gameViewRef.current?.focus({ preventScroll: true });
  }, [overlays, titleCardOpen]);

  // --- Title card ----------------------------------------------------------------------------

  const handleBegin = useCallback(() => {
    if (!sceneReady) return;
    if (store.getState().status === "not-started") {
      const result = store.dispatch({ type: "START_CHAPTER" });
      if (!result.accepted) return;
    }
    setTitleCardOpen(false);
  }, [sceneReady, store]);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  // --- Interaction ---------------------------------------------------------------------------

  const handleFocusChange = useCallback((id: InteractableId | null) => {
    focusedRef.current = id;
    setFocusedId(id);
  }, []);

  /** One E press gives one call here; the action comes from scenario data (Requirements 3.4, 3.5). */
  const handleInteract = useCallback(() => {
    if (!inputEnabledRef.current) return;
    const action = interactionToAction(focusedRef.current);
    if (!action) return;
    const result = store.dispatch(action);
    if (!result.accepted) return;
    if (action.type === "INTERACT_OBJECT") {
      // Requirement 3.6: show the authored inspection text.
      openOverlay({ kind: "inspection", objectId: action.objectId });
    } else if (action.type === "TALK_TO_NPC") {
      // Requirement 10.7: talking to Sam opens the face-to-face dialogue.
      openOverlay({ kind: "dialogue" });
    }
  }, [openOverlay, store]);

  // --- Phone and dialogue --------------------------------------------------------------------

  const handleInspectEvidence = useCallback(
    (evidenceId: EvidenceId) => store.dispatch({ type: "INSPECT_EVIDENCE", evidenceId }),
    [store],
  );

  // The bank app checks the "account suspended" claim (the selectors' VERIFY_METHOD_CLAIM).
  const handleVerifyBankApp = useCallback(
    () => store.dispatch({ type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" }),
    [store],
  );

  const handleAnswerCall = useCallback(() => store.dispatch({ type: "ANSWER_CALL" }), [store]);

  /** Declines a ringing call or hangs up an active one. */
  const handleEndCall = useCallback(() => store.dispatch({ type: "END_CALL" }), [store]);

  const handleSelectOption = useCallback(
    (optionId: string) => store.dispatch({ type: "SELECT_DIALOGUE_OPTION", optionId }),
    [store],
  );

  // --- Journal and decision ------------------------------------------------------------------

  /** Opens the decision panel on top of the journal or the phone (Requirement 13.1). */
  const handleOpenDecision = useCallback(() => {
    if (!selectDecisionPanel(store.getState(), scenario).offered) return;
    openOverlay({ kind: "decision" });
  }, [openOverlay, scenario, store]);

  /**
   * Step 1 of the official route: call Northgate on the official number. The accepted action
   * starts the official-line call, and the call effect above pushes the `call` overlay. The
   * decision panel stays below it, so step 2 is shown when the call ends.
   */
  const handleStartOfficialCall = useCallback(
    () => store.dispatch({ type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" }),
    [store],
  );

  /** Records the Decision. Once accepted, the decision, journal and phone overlays close. */
  const handleDecide = useCallback(
    (decision: DecisionId) => {
      const result = store.dispatch({ type: "MAKE_DECISION", decision });
      if (!result.accepted) return;
      removeOverlay("decision");
      removeOverlay("journal");
      removeOverlay("phone");
    },
    [removeOverlay, store],
  );

  // --- Ending and debrief --------------------------------------------------------------------

  /** Continue on the ending transition: FINISH_CHAPTER; the chapter-end effect shows the debrief. */
  const handleContinueToDebrief = useCallback(() => store.dispatch({ type: "FINISH_CHAPTER" }), [store]);

  // --- Restart, replay and save ---------------------------------------------------------------

  /**
   * Restart (pause menu, after confirmation) and Replay (debrief), Requirement 15.13: delete the
   * chapter progress, start from the initial Chapter_State with no overlays and the title card in
   * Begin mode, and put the player back at the chapter spawn point by remounting the canvas. The
   * Call_Trigger timers reset because the state is back to `not-started`.
   */
  const restartChapter = useCallback(() => {
    saveSource.clear?.();
    store.replace(createInitialState());
    updateOverlays(() => EMPTY_OVERLAYS);
    focusedRef.current = null;
    setFocusedId(null);
    setJournalSeen(0);
    setSpawn(DEFAULT_SPAWN);
    setCanvasKey((key) => key + 1);
    // The remounted canvas reports readiness again; Begin waits for it.
    setSceneReady(false);
    setTitleMode("begin");
    setTitleCardOpen(true);
  }, [saveSource, store, updateOverlays]);

  /** Writes a Checkpoint with the current pose, then leaves the chapter. */
  const handleSaveAndReturn = useCallback(() => {
    saveNow();
    onReturnToMenu();
  }, [onReturnToMenu, saveNow]);

  // Requirement 4.5: a click on the game view while the resume prompt shows locks the pointer.
  const showResume = inputEnabled && !isLocked;
  const handleGameViewClick = useCallback(() => {
    if (inputEnabledRef.current && !document.pointerLockElement) lockPointer();
  }, [lockPointer]);

  // Keeps HUD button clicks from reaching the controls' window mousedown (which locks the pointer).
  const stopMouseDown = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);

  // --- Render --------------------------------------------------------------------------------

  // Overlays below a `call` entry stay mounted (they keep their state) but hidden, so they are
  // not drawn over the phone and Tab skips them.
  const callIndex = overlays.findIndex((overlay) => overlay.kind === "call");

  const renderOverlay = (overlay: Overlay) => {
    switch (overlay.kind) {
      case "call":
        // Caller name and number come from the Call definition in Scenario_Data (plain text).
        return (
          <CallPresentation
            key="call"
            store={store}
            scenario={scenario}
            paused={paused}
            modelAllowed={modelAllowed}
            screenSink={phoneScreenSink}
            onAnswer={handleAnswerCall}
            onEnd={handleEndCall}
            onSelectOption={handleSelectOption}
          />
        );
      case "inspection": {
        const def = scenario.interactables[overlay.objectId];
        const evidence = def.reveals
          .filter((id) => discovered.includes(id))
          .map((id) => ({ id, title: scenario.evidence[id].title }));
        return (
          <InspectionPanel
            key="inspection"
            label={def.label}
            inspectionText={def.inspectionText}
            evidence={evidence}
            onClose={closeTop}
          />
        );
      }
      case "pause":
        return (
          <PauseMenu
            key="pause"
            chapterNumber={chapter?.number ?? session.chapterNumber}
            onResume={closeTop}
            onRestart={restartChapter}
            onSaveAndReturn={handleSaveAndReturn}
          />
        );
      case "phone":
        return (
          <PhoneOverlay
            key="phone"
            messages={phoneMessages}
            callLog={callLog}
            bankApp={scenario.phone.bankApp}
            onInspectEvidence={handleInspectEvidence}
            onVerifyBankApp={handleVerifyBankApp}
            onClose={handleClosePhone}
            onDecide={decisionPanel.offered ? handleOpenDecision : undefined}
          />
        );
      case "dialogue": {
        if (!dialogueView || dialogueView.channel !== "face-to-face") return null;
        const persona = scenario.dialogues[dialogueView.graphId].persona;
        return (
          <div key="dialogue" className={UI.backdrop}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialogue-overlay-heading"
              className={`${UI.panel} max-w-lg space-y-4`}
              data-testid="dialogue-overlay"
            >
              <div>
                <p className={UI.label}>{t("dialogue.caption")}</p>
                <h2 id="dialogue-overlay-heading" className={UI.heading}>
                  {persona.name}
                </h2>
              </div>
              <DialoguePanel view={dialogueView} onSelectOption={handleSelectOption} />
            </div>
          </div>
        );
      }
      case "journal":
        return (
          <EvidenceJournal
            key="journal"
            entries={journalEntries}
            claims={claimStatuses}
            decisionOffered={decisionPanel.offered}
            onDecide={handleOpenDecision}
            onClose={() => removeOverlay("journal")}
          />
        );
      case "decision":
        return (
          <DecisionPanel
            key="decision"
            panel={decisionPanel}
            onStartOfficialCall={handleStartOfficialCall}
            onDecide={handleDecide}
            onClose={() => removeOverlay("decision")}
          />
        );
      case "ending":
        if (!debriefView) return null;
        return <EndingTransition key="ending" outcome={debriefView.outcome} onContinue={handleContinueToDebrief} />;
      case "debrief":
        if (!debriefView) return null;
        return (
          <DebriefScreen key="debrief" view={debriefView} onReplay={restartChapter} onReturnToMenu={onReturnToMenu} />
        );
    }
  };

  const hudVisible = !titleCardOpen && status === "playing";
  const journalUnread = Math.max(0, discovered.length - journalSeen);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#171521] select-none">
      <div
        ref={gameViewRef}
        tabIndex={-1}
        data-testid="chapter-game-view"
        className="absolute inset-0 outline-none"
        onClick={handleGameViewClick}
      >
        <ChapterOneCanvas
          key={canvasKey}
          settings={settings}
          enabled={inputEnabled}
          focusedId={inputEnabled ? focusedId : null}
          onFocusChange={handleFocusChange}
          onInteract={handleInteract}
          onSceneReady={handleSceneReady}
          spawnPosition={spawn.position}
          spawnYaw={spawn.yaw}
          consumeMovement={consumeMovement}
          consumePunchTrigger={consumePunchTrigger}
          consumeInspectTrigger={consumeInspectTrigger}
          consumeInteractTrigger={consumeInteractTrigger}
          keysRef={keysRef}
          poseGetterRef={poseGetterRef}
          callPhone={callPhone}
          phoneModelEnabled={phoneModelEnabled}
          onPhoneModelError={handlePhoneModelError}
          onWebGLContextChange={handleWebGLContextChange}
        />
      </div>

      {hudVisible && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 z-10">
            <ObjectiveTracker
              objectives={activeObjectives}
              announcement={
                announcement === null
                  ? null
                  : t("page.announce.objectiveCompleted", { objective: scenario.objectives[announcement].text })
              }
            />
          </div>

          <div className="pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
            {toast && (
              <ObjectiveToast
                key={toast.key}
                kind={toast.kind}
                text={scenario.objectives[toast.objectiveId].text}
                onDismiss={dismissToast}
              />
            )}
            {notice && (
              <EvidenceNotice key={notice.key} title={scenario.evidence[notice.evidenceId].title} onDismiss={dismissNotice} />
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-2 px-4">
            <ResumePrompt visible={showResume} />
            {inputEnabled && <InteractionPrompt objectId={focusedId} prompts={getDisplayPrompts(locale)} />}
          </div>

          <div className="absolute bottom-4 right-4 z-10" onMouseDown={stopMouseDown}>
            <HudButtons
              onPhone={() => toggleOverlay("phone")}
              onJournal={() => toggleOverlay("journal")}
              phoneOpen={overlays.some((overlay) => overlay.kind === "phone")}
              journalOpen={overlays.some((overlay) => overlay.kind === "journal")}
              phoneUnread={phoneUnread}
              journalUnread={journalUnread}
            />
          </div>
        </>
      )}

      {overlays.length > 0 && (
        <div ref={overlayLayerRef} onMouseDown={stopMouseDown}>
          {overlays.map((overlay, index) => (
            <div key={overlay.kind} className="contents" hidden={callIndex !== -1 && index < callIndex}>
              {renderOverlay(overlay)}
            </div>
          ))}
        </div>
      )}

      {saveFailed && (
        <div className="absolute right-4 top-4 z-50" onMouseDown={stopMouseDown}>
          <SaveFailureNotice onDismiss={dismissSaveFailure} />
        </div>
      )}

      {titleCardOpen && (
        <ChapterTitleCard
          chapterNumber={chapter?.number ?? session.chapterNumber}
          title={scenario.title}
          subtitle={scenario.subtitle}
          ready={sceneReady}
          mode={titleMode}
          onBegin={handleBegin}
        />
      )}
    </div>
  );
};
