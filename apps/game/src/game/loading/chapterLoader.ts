import { getChapter as defaultGetChapter, type ChapterDefinition } from "../chapters/chapterRegistry";
import {
  createNewChapterSession,
  restoreChapterSession,
  type ChapterSession,
} from "../chapters/chapterSession";
import { restoreProgress, type RestoreProgressResult } from "../saves/chapterProgress";
import { createLocalStorageSaveSource, type SaveGameSource, type SavedGame } from "../saves/saveGame";
import { fetchAssetBytes, isAbortError, type FetchLike } from "./assetFetcher";
import { verifyAsset } from "./assetVerification";
import { probeWebGL2, type CapabilityResult } from "./deviceCapabilities";
import { AssetLoadError, createLoadingError, type LoadingError } from "./loadingErrors";

/**
 * Framework-free orchestration of "get a chapter ready to play".
 *
 * New game:  checking-device → loading-assets → initializing-state → ready
 * Continue:  restoring-save → checking-device → loading-assets → validating-save → ready
 *
 * Progress is only reported as a number while it is measured from real bytes of every file
 * in the chapter manifest. Otherwise it is null and the UI shows an indeterminate state.
 */

export type ChapterLoadRequest =
  | { kind: "new-game"; chapterId: string }
  | { kind: "continue" };

export type LoadingStage =
  | "starting"
  | "restoring-save"
  | "checking-device"
  | "loading-assets"
  | "initializing-state"
  | "validating-save"
  | "ready"
  | "error";

export interface ChapterSummary {
  id: string;
  number: number;
  title: string;
  subtitle: string;
}

export interface ChapterLoadSnapshot {
  stage: LoadingStage;
  chapter: ChapterSummary | null;
  /** 0..1 when measured from bytes, otherwise null (indeterminate). */
  progress: number | null;
  filesCompleted: number;
  filesTotal: number;
  /** Status text of the first file that has not finished yet. */
  currentAssetText: string | null;
  error: LoadingError | null;
  /** Set only in the "ready" stage. */
  session: ChapterSession | null;
}

export interface ChapterLoaderDeps {
  fetchImpl: FetchLike;
  saveSource: SaveGameSource;
  probeDevice: () => CapabilityResult;
  getChapter: (chapterId: string) => ChapterDefinition | undefined;
  /** Abort and report "stalled" if no bytes arrive for this long. */
  stallTimeoutMs: number;
}

export const DEFAULT_STALL_TIMEOUT_MS = 30_000;

export function createDefaultLoaderDeps(): ChapterLoaderDeps {
  return {
    fetchImpl: (url, init) => fetch(url, init),
    saveSource: createLocalStorageSaveSource(),
    probeDevice: probeWebGL2,
    getChapter: defaultGetChapter,
    stallTimeoutMs: DEFAULT_STALL_TIMEOUT_MS,
  };
}

export interface ChapterLoader {
  getSnapshot(): ChapterLoadSnapshot;
  subscribe(listener: () => void): () => void;
  /** Runs the pipeline once. Further calls are ignored. */
  start(): void;
  /** Aborts pending downloads and stops all notifications. Safe to call repeatedly. */
  cancel(): void;
}

export const INITIAL_SNAPSHOT: ChapterLoadSnapshot = Object.freeze({
  stage: "starting",
  chapter: null,
  progress: null,
  filesCompleted: 0,
  filesTotal: 0,
  currentAssetText: null,
  error: null,
  session: null,
});

function summarize(chapter: ChapterDefinition): ChapterSummary {
  return { id: chapter.id, number: chapter.number, title: chapter.title, subtitle: chapter.subtitle };
}

class StageFailure extends Error {
  readonly loadingError: LoadingError;
  constructor(loadingError: LoadingError) {
    super(loadingError.title);
    this.loadingError = loadingError;
  }
}

export function createChapterLoader(request: ChapterLoadRequest, deps: ChapterLoaderDeps): ChapterLoader {
  let snapshot: ChapterLoadSnapshot = INITIAL_SNAPSHOT;
  const listeners = new Set<() => void>();
  const abortController = new AbortController();
  let started = false;
  let cancelled = false;
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  const update = (patch: Partial<ChapterLoadSnapshot>) => {
    if (cancelled) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  const clearStallTimer = () => {
    if (stallTimer !== null) clearTimeout(stallTimer);
    stallTimer = null;
  };

  const armStallTimer = () => {
    clearStallTimer();
    stallTimer = setTimeout(() => {
      stalled = true;
      abortController.abort();
    }, deps.stallTimeoutMs);
  };

  const fail = (error: LoadingError): never => {
    throw new StageFailure(error);
  };

  const resolveSave = (): { chapter: ChapterDefinition; save: SavedGame } => {
    update({ stage: "restoring-save" });
    const result = deps.saveSource.read();
    if (result.status === "none") fail(createLoadingError("invalid-save", "No saved game was found."));
    if (result.status === "invalid") fail(createLoadingError("invalid-save", result.reason));
    const save = (result as { status: "valid"; save: SavedGame }).save;
    const chapter = deps.getChapter(save.chapterId);
    if (!chapter) fail(createLoadingError("invalid-save", `Saved chapter "${save.chapterId}" does not exist.`));
    return { chapter: chapter as ChapterDefinition, save };
  };

  const loadAssets = async (chapter: ChapterDefinition) => {
    const assets = chapter.assets;
    const loaded = assets.map(() => 0);
    const totals: Array<number | null | undefined> = assets.map(() => undefined);
    const done = assets.map(() => false);

    const publish = () => {
      const allSized = totals.every((total) => typeof total === "number");
      const totalBytes = allSized ? (totals as number[]).reduce((sum, value) => sum + value, 0) : 0;
      const loadedBytes = loaded.reduce((sum, value) => sum + value, 0);
      const firstPending = assets.findIndex((_, index) => !done[index]);
      update({
        stage: "loading-assets",
        progress: allSized && totalBytes > 0 ? Math.min(1, loadedBytes / totalBytes) : allSized ? 1 : null,
        filesCompleted: done.filter(Boolean).length,
        filesTotal: assets.length,
        currentAssetText: firstPending === -1 ? null : assets[firstPending].loadingText,
      });
    };

    publish();
    armStallTimer();

    await Promise.all(
      assets.map(async (asset, index) => {
        const buffer = await fetchAssetBytes(asset.url, {
          fetchImpl: deps.fetchImpl,
          signal: abortController.signal,
          onProgress: ({ loadedBytes, totalBytes }) => {
            loaded[index] = loadedBytes;
            totals[index] = totalBytes;
            armStallTimer();
            publish();
          },
        });
        const verification = verifyAsset(asset.kind, buffer);
        if (!verification.ok) {
          throw new AssetLoadError("asset-invalid", `${asset.url}: ${verification.reason}`);
        }
        done[index] = true;
        publish();
      }),
    );
    clearStallTimer();
  };

  const run = async () => {
    try {
      let chapter: ChapterDefinition;
      let save: SavedGame | null = null;

      if (request.kind === "continue") {
        ({ chapter, save } = resolveSave());
      } else {
        const found = deps.getChapter(request.chapterId);
        if (!found) fail(createLoadingError("invalid-chapter", `Unknown chapter id "${request.chapterId}".`));
        chapter = found as ChapterDefinition;
      }
      update({ chapter: summarize(chapter), filesTotal: chapter.assets.length });

      update({ stage: "checking-device" });
      const capability = deps.probeDevice();
      if (!capability.ok) fail(createLoadingError(capability.code, capability.detail));

      await loadAssets(chapter);

      let session: ChapterSession;
      if (save) {
        update({ stage: "validating-save", currentAssetText: null });
        const restored = restoreChapterSession(chapter, save);
        if (!restored.ok) fail(createLoadingError("invalid-save", restored.reason));
        session = (restored as { ok: true; session: ChapterSession }).session;
        if (session.progress !== undefined) {
          // A save is valid only when the chapter core accepts every saved action (Req. 15.6).
          const replayed = restoreProgress(session.progress);
          if (!replayed.ok) fail(createLoadingError("invalid-save", replayed.reason));
          const { state, pose } = replayed as Extract<RestoreProgressResult, { ok: true }>;
          session = { ...session, restored: { state, pose } };
        }
      } else {
        update({ stage: "initializing-state", currentAssetText: null });
        session = createNewChapterSession(chapter);
      }

      update({ stage: "ready", session });
    } catch (error) {
      clearStallTimer();
      if (cancelled) return;
      // Stop any downloads still running in parallel with the one that failed.
      abortController.abort();
      let loadingError: LoadingError;
      if (error instanceof StageFailure) {
        loadingError = error.loadingError;
      } else if (stalled) {
        loadingError = createLoadingError("stalled", `No data received for ${deps.stallTimeoutMs / 1000} s.`);
      } else if (error instanceof AssetLoadError) {
        loadingError = createLoadingError(error.code, error.message);
      } else if (isAbortError(error)) {
        loadingError = createLoadingError("network", "The download was interrupted.");
      } else {
        loadingError = createLoadingError("unknown", error instanceof Error ? error.message : undefined);
      }
      update({ stage: "error", error: loadingError, progress: null, session: null });
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started || cancelled) return;
      started = true;
      void run();
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearStallTimer();
      abortController.abort();
      listeners.clear();
    },
  };
}
