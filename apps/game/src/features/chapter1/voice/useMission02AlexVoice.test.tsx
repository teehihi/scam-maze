// Alex's Mission 02 story lines through the shared Alex voice queue (`useMission01Voice`): a
// placeholder is a caption only and loads nothing, lines wait for a call or a street conversation,
// a later moment drops a stale waiting line, a restored game replays nothing, and an Alex line of
// Mission 01 and one of Mission 02 never overlap.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { MISSION_02_CONFIG, MISSION_02_EVENTS, MISSION_02_MISSIONS } from "../../../game/narrative/chapter1/mission02";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import type { AudioPort, LoadedClip, PlaybackHandle } from "../../../game/voice/audioPort";
import { mission01VoiceUrl } from "./mission01Voice";
import { CAPTION_ONLY_MS, useMission01Voice, type UseMission01VoiceOptions } from "./useMission01Voice";

const S = LAST_SUBMISSION_SCENARIO;
const M02: ScenarioDefinition = {
  ...S,
  events: (S.events ?? []).filter((event) => MISSION_02_EVENTS.some((def) => def.id === event.id)),
  missions: (S.missions ?? []).filter((mission) => MISSION_02_MISSIONS.some((def) => def.id === mission.id)),
};
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const OPEN_AT = advance(MISSION_02_CONFIG.opensAtMinute + 5);
const LATE = advance(MISSION_02_CONFIG.interviewEndMinute + 1);
const BUS = [use("travel.bus06", "pay-fare"), use("travel.bus06", "arrive")];

function reduce(actions: CoreAction[]): ChapterState {
  return actions.reduce((state, action) => {
    const result = chapterReducer(state, action, M02);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, createInitialState(M02));
}

function fakePort() {
  const loads: string[] = [];
  const starts: string[] = [];
  const handles: Array<{ end: () => void; ended?: boolean }> = [];
  const port: AudioPort = {
    supported: true,
    resume: async () => "running",
    load: async (url) => {
      loads.push(url);
      return { id: url, durationMs: 4000 } satisfies LoadedClip;
    },
    start: (clip, o) => {
      starts.push(clip.id);
      handles.push({ end: () => o.onEnded() });
      return { stop: () => undefined, setGain: () => undefined, positionMs: () => 0 } satisfies PlaybackHandle;
    },
    dispose: () => undefined,
  };
  return { port, loads, starts, handles };
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => void (await Promise.resolve()));
};
const dispatch = async (store: ChapterStore, action: CoreAction) => {
  await act(async () => void store.dispatch(action));
  await flush();
};
function mount(store: ChapterStore, port: AudioPort, patch: Partial<UseMission01VoiceOptions> = {}) {
  const base: UseMission01VoiceOptions = {
    store,
    scenario: M02,
    port,
    locale: "en",
    settings: { soundEnabled: true, voiceVolume: 0.8 },
    held: false,
    introVisible: false,
    callOpen: false,
    viewing: null,
  };
  return renderHook((props: Partial<UseMission01VoiceOptions>) => useMission01Voice({ ...base, ...patch, ...props }), { initialProps: {} });
}
/** Lets a caption-only line run out. */
const endCaption = async () => {
  await act(async () => void vi.advanceTimersByTime(CAPTION_ONLY_MS + 10));
  await flush();
};
/** Ends the line that is playing now: its recorded clip when one is playing, else its caption. */
const endLine = async (fake: ReturnType<typeof fakePort>) => {
  const playing = fake.handles.find((handle) => !handle.ended);
  if (playing) {
    playing.ended = true;
    await act(async () => void playing.end());
    await flush();
    return;
  }
  await endCaption();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Mission 02 Alex lines in the voice queue", () => {
  it("shows a placeholder line as a caption only, without loading any file", async () => {
    const fake = fakePort();
    // `m02Confirmed` has no recording yet (the mission's opening line already counts as played).
    const store = createChapterStore(reduce([START, OPEN_AT]), M02);
    const view = mount(store, fake.port);
    await dispatch(store, use("contact.coba", "confirm"));
    expect(view.result.current.current).toBe("m02Confirmed");
    expect(fake.loads).toEqual([]);
    expect(fake.starts).toEqual([]);
    await endCaption();
    expect(view.result.current.current).toBeNull();
  });

  it("plays each line once, in the order the moments happen", async () => {
    const fake = fakePort();
    const store = createChapterStore(reduce([START, OPEN_AT]), M02);
    const view = mount(store, fake.port);
    const heard: string[] = [];
    const listen = () => {
      const cue = view.result.current.current;
      if (cue !== null && heard.at(-1) !== cue) heard.push(cue);
    };
    await dispatch(store, use("map.bus06-stop", "read-board"));
    listen();
    await dispatch(store, use("contact.coba", "confirm"));
    listen();
    await endLine(fake);
    listen();
    await endLine(fake);
    // The same moment again (the board was already read) says nothing.
    await dispatch(store, use("map.bus06-stop", "ask-driver"));
    listen();
    await endLine(fake);
    expect(heard).toEqual(["m02RouteChecked", "m02Confirmed", "m02DriverOffer"]);
    // The two recorded lines were played from their files; the placeholder loaded nothing.
    expect(fake.loads.filter((url) => url.includes("alex_m02_"))).toEqual([
      "/audio/mission02/en/alex_m02_route_checked_en.mp3",
      "/audio/mission02/en/alex_m02_driver_offer_en.mp3",
    ]);
  });

  it("waits while a call or a street conversation is open, then speaks", async () => {
    const fake = fakePort();
    const store = createChapterStore(reduce([START, OPEN_AT]), M02);
    const view = mount(store, fake.port, { callOpen: true });
    await dispatch(store, use("map.bus06-stop", "ask-driver"));
    expect(view.result.current.current).toBeNull();
    view.rerender({ callOpen: false });
    await flush();
    expect(view.result.current.current).toBe("m02DriverOffer");
  });

  it("drops a waiting late-arrival line once Cô Ba has agreed to reschedule", async () => {
    const fake = fakePort();
    const store = createChapterStore(reduce([START, LATE]), M02);
    // The street conversation holds the queue while Alex arrives and talks to Cô Ba.
    const view = mount(store, fake.port, { callOpen: true });
    for (const action of BUS) await dispatch(store, action);
    await dispatch(store, use("interview.coba", "reschedule"));
    view.rerender({ callOpen: false });
    await flush();
    expect(view.result.current.current).toBe("m02Rescheduled");
    await endCaption();
    expect(view.result.current.current).toBeNull();
  });

  it("replays nothing after a load: what the saved state already reached counts as played", async () => {
    const fake = fakePort();
    const saved = reduce([START, OPEN_AT, use("contact.coba", "confirm"), ...BUS, use("interview.coba", "start"), use("interview.coba", "ask-transfer")]);
    const store = createChapterStore(saved, M02);
    const view = mount(store, fake.port);
    await flush();
    expect(view.result.current.current).toBeNull();
    // A later moment is still new.
    await dispatch(store, advance(MISSION_02_CONFIG.missionDeadlineMinute));
    expect(view.result.current.current).toBeNull();
  });

  it("never overlaps an Alex line of Mission 01: the Mission 02 line waits for it to end", async () => {
    const fake = fakePort();
    const store = createChapterStore(reduce([START]), M02);
    const view = mount(store, fake.port, { callOpen: true });
    await dispatch(store, { type: "WORK_ON_THESIS", minutes: 60 });
    await dispatch(store, OPEN_AT);
    view.rerender({ callOpen: false });
    await flush();
    expect(fake.starts).toEqual([mission01VoiceUrl("thesisStart", "en")]);
    expect(view.result.current.current).toBe("thesisStart");
    act(() => fake.handles[0].end());
    await flush();
    expect(view.result.current.current).toBe("m02Open");
  });
});
