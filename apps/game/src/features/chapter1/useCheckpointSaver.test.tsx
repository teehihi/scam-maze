// Integration tests for the Checkpoint_Saver hook (task 12.4). Requirements 15.1, 15.2, 15.14
// and 18.6.
//
// The hook runs against a real Chapter_Store and an in-memory SaveGameSource, so every write
// goes through `encodeProgress` and can be replayed with `restoreProgress`.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../game/narrative/store";
import type { CoreAction } from "../../game/narrative/types";
import { restoreProgress } from "../../game/saves/chapterProgress";
import {
  SAVE_FORMAT_VERSION_V2,
  type SaveGameSource,
  type SaveReadResult,
  type SavedGameV2,
  type SavedPlayerPose,
} from "../../game/saves/saveGame";
import { DEBRIEF_CHECKPOINT_ID, useCheckpointSaver } from "./useCheckpointSaver";

const START: CoreAction = { type: "START_CHAPTER" };
const WALLET: CoreAction = { type: "INTERACT_OBJECT", objectId: "obj.wallet" };
const RING_SCAM: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const VERIFY_OPTION: CoreAction = { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.open.verify" };
const STOP_AND_WAIT: CoreAction = { type: "MAKE_DECISION", decision: "stop-and-wait" };
const FINISH: CoreAction = { type: "FINISH_CHAPTER" };

/** In-memory save source. `setWritable(false)` makes writes fail like blocked storage. */
function createMemorySaveSource() {
  let saved: SavedGameV2 | null = null;
  let writable = true;
  const source = {
    read: vi.fn((): SaveReadResult => (saved ? { status: "valid", save: saved } : { status: "none" })),
    write: vi.fn((save: SavedGameV2) => {
      if (!writable) return false;
      saved = save;
      return true;
    }),
    clear: vi.fn(() => {
      saved = null;
      return true;
    }),
  } satisfies SaveGameSource;
  return {
    source,
    saved: () => saved,
    setWritable: (value: boolean) => {
      writable = value;
    },
  };
}

function setup(pose: SavedPlayerPose | null = null) {
  const store = createChapterStore(createInitialState());
  const memory = createMemorySaveSource();
  const onWriteFailure = vi.fn();
  const poseGetterRef = { current: pose ? () => pose : null };
  const hook = renderHook(() =>
    useCheckpointSaver({
      store,
      saveSource: memory.source,
      poseGetterRef,
      chapterId: "chapter-1",
      sceneId: "street",
      onWriteFailure,
    }),
  );
  return { store, memory, onWriteFailure, hook };
}

function dispatchAll(store: ChapterStore, actions: readonly CoreAction[]) {
  act(() => {
    for (const action of actions) {
      const result = store.dispatch(action);
      if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    }
  });
}

const writeCount = (memory: ReturnType<typeof createMemorySaveSource>) => memory.source.write.mock.calls.length;
const lastWrite = (memory: ReturnType<typeof createMemorySaveSource>) => {
  const call = memory.source.write.mock.calls.at(-1);
  if (!call) throw new Error("Nothing was written");
  return call[0];
};

describe("useCheckpointSaver", () => {
  it("writes nothing before START_CHAPTER", () => {
    const { store, memory } = setup();
    // A rejected action does not notify; a replace to the initial state does.
    act(() => {
      store.dispatch(WALLET);
      store.replace(createInitialState());
    });
    expect(writeCount(memory)).toBe(0);
  });

  it("writes a Checkpoint on START_CHAPTER and on each later objective change", () => {
    const { store, memory } = setup();
    dispatchAll(store, [START]);
    expect(writeCount(memory)).toBe(1);
    const first = lastWrite(memory);
    expect(first).toMatchObject({ formatVersion: SAVE_FORMAT_VERSION_V2, chapterId: "chapter-1", sceneId: "street" });
    expect(first.progress.checkpointId).toBe("obj.look-around");

    // OPEN_PHONE changes no objective, so nothing is written.
    dispatchAll(store, [{ type: "OPEN_PHONE" }, { type: "CLOSE_PHONE" }]);
    expect(writeCount(memory)).toBe(1);

    // The wallet completes "look around": a new Checkpoint that replays to the same state.
    dispatchAll(store, [WALLET]);
    expect(writeCount(memory)).toBe(2);
    const restored = restoreProgress(lastWrite(memory).progress);
    if (!restored.ok) throw new Error(restored.reason);
    expect(restored.state.objectives).toEqual(store.getState().objectives);
    expect(restored.state.discovered).toEqual(store.getState().discovered);
  });

  it("defers a change made while a call rings and writes it when the call ends", () => {
    const { store, memory } = setup();
    dispatchAll(store, [START, WALLET]);
    const before = writeCount(memory);

    // Ringing activates "answer the call", but a Checkpoint must wait.
    dispatchAll(store, [RING_SCAM]);
    expect(store.getState().objectives.active).toContain("obj.answer-call");
    expect(writeCount(memory)).toBe(before);

    // Declining changes no objective; the pending difference is written now.
    dispatchAll(store, [END_CALL]);
    expect(writeCount(memory)).toBe(before + 1);
    expect(lastWrite(memory).progress.checkpointId).toBe("obj.answer-call");
    expect(lastWrite(memory).progress.actions).toEqual([START, WALLET, RING_SCAM, END_CALL]);
  });

  it("writes nothing during an active call and once after it ends", () => {
    const { store, memory } = setup();
    dispatchAll(store, [START, WALLET]);
    const before = writeCount(memory);

    dispatchAll(store, [RING_SCAM, ANSWER]);
    expect(store.getState().call.status).toBe("active");
    expect(writeCount(memory)).toBe(before);

    dispatchAll(store, [VERIFY_OPTION]);
    expect(writeCount(memory)).toBe(before + 1);
  });

  it('writes checkpoint "debrief" once after FINISH_CHAPTER', () => {
    const { store, memory } = setup();
    dispatchAll(store, [START, WALLET, RING_SCAM, ANSWER, VERIFY_OPTION, STOP_AND_WAIT]);
    const before = writeCount(memory);

    dispatchAll(store, [FINISH]);
    expect(writeCount(memory)).toBe(before + 1);
    expect(lastWrite(memory).progress.checkpointId).toBe(DEBRIEF_CHECKPOINT_ID);
    const restored = restoreProgress(lastWrite(memory).progress);
    expect(restored.ok && restored.state.status).toBe("finished");

    // Further notifications in the finished state do not write again.
    act(() => store.replace(store.getState()));
    expect(writeCount(memory)).toBe(before + 1);
  });

  it("reports a write failure once per failure streak and keeps going", () => {
    const { store, memory, onWriteFailure } = setup();
    memory.setWritable(false);
    dispatchAll(store, [START, WALLET]);
    expect(writeCount(memory)).toBe(2);
    expect(onWriteFailure).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("playing");

    // A success ends the streak; the next failure is reported again.
    memory.setWritable(true);
    dispatchAll(store, [RING_SCAM, ANSWER, VERIFY_OPTION]);
    expect(memory.saved()).not.toBeNull();
    expect(onWriteFailure).toHaveBeenCalledTimes(1);

    memory.setWritable(false);
    dispatchAll(store, [STOP_AND_WAIT, FINISH]);
    expect(onWriteFailure).toHaveBeenCalledTimes(2);
  });

  it("saveNow writes the current state and pose only while playing with no call in progress", () => {
    const pose: SavedPlayerPose = { position: [1, 0, 2], yaw: 0.5 };
    const { store, memory, hook } = setup(pose);

    expect(hook.result.current.saveNow()).toBe(false);
    expect(writeCount(memory)).toBe(0);

    dispatchAll(store, [START, WALLET]);
    const before = writeCount(memory);
    let ok = false;
    act(() => {
      ok = hook.result.current.saveNow();
    });
    expect(ok).toBe(true);
    expect(writeCount(memory)).toBe(before + 1);
    expect(lastWrite(memory).progress.checkpointId).toBe("obj.look-around");
    expect(lastWrite(memory).progress.playerPose?.yaw).toBe(0.5);

    dispatchAll(store, [RING_SCAM]);
    expect(hook.result.current.saveNow()).toBe(false);
    expect(writeCount(memory)).toBe(before + 1);
  });
});
