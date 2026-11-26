// Alex's Mission 01 voice: the cue rules on the real scenario, the files in the public folder, and
// the playback rules (one line at a time, once per run, never after a load, hold and release).
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AudioPort, LoadedClip, PlaybackHandle } from "../../../game/voice/audioPort";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "../../../game/narrative/chapter1/mission01";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction } from "../../../game/narrative/types";
import { MISSION01_VOICE_CUES, MISSION01_VOICE_STEMS, mission01VoiceUrl, passedVoiceCues, reachedVoiceCues, type Mission01VoiceCue } from "./mission01Voice";
import { CAPTION_ONLY_MS, QUEUE_TTL_MS, useMission01Voice, type UseMission01VoiceOptions, type VoiceView } from "./useMission01Voice";

const S = LAST_SUBMISSION_SCENARIO;
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });

function reduce(state: ChapterState, actions: CoreAction[]): ChapterState {
  return actions.reduce((current, action) => {
    const result = chapterReducer(current, action, S);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, state);
}
const started = (extra: CoreAction[] = []) => reduce(createInitialState(S), [{ type: "START_CHAPTER" }, ...extra]);

describe("the clips", () => {
  it("are all in the public folder in both languages, where the browser can load them, and each cue has its own file", () => {
    expect(new Set(Object.values(MISSION01_VOICE_STEMS)).size).toBe(10);
    for (const locale of ["en", "vi"] as const) {
      for (const cue of MISSION01_VOICE_CUES) {
        const url = mission01VoiceUrl(cue, locale);
        expect(url).toBe(`/audio/mission01/${locale}/${MISSION01_VOICE_STEMS[cue]}_${locale}.mp3`);
        const file = resolve(__dirname, "../../../../public", url.slice(1));
        expect(existsSync(file), url).toBe(true);
        expect(statSync(file).size, url).toBeGreaterThan(10_000);
      }
    }
  });
});

describe("the cues", () => {
  const MAIL = { mailListed: true, bankViewed: false };
  const BANK = { mailListed: false, bankViewed: true };
  /** The player lets everything run until the first unauthorized transfer has happened. */
  const robbed = () =>
    started([advance(10), use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card"), use("page.fee", "enter-code"), advance(MISSION_01_CONFIG.unauthorizedTransfers[0].afterMinutes)]);

  it("follow what the player sees and does, and nothing else", () => {
    expect(reachedVoiceCues(started(), S)).toEqual([]);
    // The email arrives by itself, and so does the notification: Alex does not speak yet.
    expect(reachedVoiceCues(started([advance(10)]), S)).toEqual([]);
    expect(reachedVoiceCues(started([advance(10)]), S, MAIL)).toEqual(["emailReceived"]);
    // An inbox that does not list the email yet says nothing.
    expect(reachedVoiceCues(started(), S, MAIL)).toEqual([]);
    const opened = started([advance(10), { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" }]);
    expect(reachedVoiceCues(opened, S)).toEqual(["emailSuspicious"]);
    expect(reachedVoiceCues(opened, S, MAIL)).toEqual(["emailReceived", "emailSuspicious"]);
  });

  it("start the thesis line with the first real writing, not with opening the laptop", () => {
    expect(reachedVoiceCues(started(), S)).toEqual([]);
    expect(reachedVoiceCues(started([{ type: "WORK_ON_THESIS", minutes: 60 }]), S)).toContain("thesisStart");
    expect(reachedVoiceCues(started([{ type: "COMPLETE_THESIS_TASK", taskId: "draft.final" }]), S)).toContain("thesisStart");
    // Resting and waiting are not writing.
    expect(reachedVoiceCues(started([{ type: "REST", mode: "nap" }, advance(60)]), S)).not.toContain("thesisStart");
  });

  it("say the verify line only when the player verifies on purpose", () => {
    // Opening the contact or the portal item, or an unrelated app, is not verifying.
    expect(reachedVoiceCues(started([advance(10), { type: "OPEN_DEVICE_ITEM", itemId: "contact.training-office" }]), S)).not.toContain("verify");
    expect(reachedVoiceCues(started([advance(10), { type: "OPEN_DEVICE_ITEM", itemId: "portal.saved" }]), S)).not.toContain("verify");
    expect(reachedVoiceCues(started([advance(10), { type: "OPEN_DEVICE_ITEM", itemId: "contact.bank" }]), S)).not.toContain("verify");
    expect(reachedVoiceCues(started([advance(10), use("portal.saved", "check-account")]), S)).toContain("verify");
    expect(reachedVoiceCues(started([advance(10), use("contact.training-office", "call")]), S)).toContain("verify");
  });

  it("say the breach line when the player notices the transfer, not when it happens", () => {
    const state = robbed();
    expect(Object.hasOwn(state.world.events, "m01.transfer-1")).toBe(true);
    // The login, the payment, the code and the transfer itself make no sound.
    expect(reachedVoiceCues(state, S)).not.toContain("securityBreach");
    expect(reachedVoiceCues(state, S, MAIL)).not.toContain("securityBreach");
    // Seeing the bank app, or opening a bank alert, does.
    expect(reachedVoiceCues(state, S, BANK)).toContain("securityBreach");
    const alert = reduce(state, [{ type: "OPEN_DEVICE_ITEM", itemId: "msg.bank-alert-1" }]);
    expect(reachedVoiceCues(alert, S)).toContain("securityBreach");
    // No transfer, no breach line, even in the bank app.
    expect(reachedVoiceCues(started([advance(10)]), S, BANK)).not.toContain("securityBreach");
  });

  it("say the offers' lines when the player reads the messages, not when they arrive", () => {
    expect(reachedVoiceCues(started([advance(150)]), S, MAIL)).not.toContain("easyMoney");
    expect(reachedVoiceCues(started([advance(150), { type: "OPEN_DEVICE_ITEM", itemId: "msg.easy-money" }]), S)).toContain("easyMoney");
    expect(reachedVoiceCues(started([advance(270)]), S, MAIL)).not.toContain("investment");
    expect(reachedVoiceCues(started([advance(270), { type: "OPEN_DEVICE_ITEM", itemId: "msg.golden-friend" }]), S)).toContain("investment");
  });

  it("exhausted needs the exhausted level and overnight needs the missed deadline", () => {
    const tired = started();
    const exhausted: ChapterState = { ...tired, resources: { ...tired.resources, fatigue: 70 } };
    expect(reachedVoiceCues({ ...tired, resources: { ...tired.resources, fatigue: 69 } }, S)).not.toContain("exhausted");
    expect(reachedVoiceCues(exhausted, S)).toContain("exhausted");
    expect(reachedVoiceCues(started([advance(MISSION_01_CONFIG.draftDeadlineMinute - 1)]), S)).not.toContain("overnight");
    expect(reachedVoiceCues(started([advance(MISSION_01_CONFIG.draftDeadlineMinute)]), S)).toContain("overnight");
  });

  it("mark what is behind the player as passed when a game is continued, and nothing in a new game", () => {
    expect(passedVoiceCues(createInitialState(S), S)).toEqual([]);
    expect(passedVoiceCues(started(), S)).toEqual([]);
    // The email and the transfer exist, so the player may have seen them before the save.
    expect(passedVoiceCues(started([advance(10)]), S)).toEqual(["emailReceived"]);
    expect(passedVoiceCues(robbed(), S)).toEqual(expect.arrayContaining(["emailReceived", "securityBreach"]));
    expect(passedVoiceCues(started([{ type: "WORK_ON_THESIS", minutes: 60 }]), S)).toContain("thesisStart");
  });
});

/** An audio port that records what starts and lets the test end a line. */
function fakePort() {
  const starts: Array<{ id: string; offsetMs: number; gain: number }> = [];
  const handles: Array<{ stopped: boolean; position: number; end: () => void }> = [];
  const loads: string[] = [];
  const port: AudioPort = {
    supported: true,
    resume: async () => "running",
    load: async (url) => {
      loads.push(url);
      return { id: url, durationMs: 5000 } satisfies LoadedClip;
    },
    start: (clip, o) => {
      starts.push({ id: clip.id, offsetMs: o.offsetMs, gain: o.gain });
      const record = { stopped: false, position: 1500, end: () => o.onEnded() };
      handles.push(record);
      return { stop: () => void (record.stopped = true), setGain: () => undefined, positionMs: () => record.position } satisfies PlaybackHandle;
    },
    dispose: () => undefined,
  };
  return { port, starts, handles, loads };
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => void (await Promise.resolve()));
};
const file = (cue: Mission01VoiceCue, locale: "en" | "vi" = "en") => mission01VoiceUrl(cue, locale);

function mount(store: ChapterStore, audio: AudioPort | null, patch: Partial<UseMission01VoiceOptions> = {}) {
  const base: UseMission01VoiceOptions = {
    store,
    scenario: S,
    port: audio,
    locale: "en",
    settings: { soundEnabled: true, voiceVolume: 0.8 },
    held: false,
    introVisible: false,
    callOpen: false,
    viewing: MAIL_VIEW,
  };
  return renderHook((props: Partial<UseMission01VoiceOptions>) => useMission01Voice({ ...base, ...patch, ...props }), { initialProps: {} });
}
const dispatch = async (store: ChapterStore, action: CoreAction) => {
  await act(async () => void store.dispatch(action));
  await flush();
};

const MAIL_VIEW: VoiceView = { app: "mail", itemIds: ["mail.clearance", "mail.library"] };
const BANK_VIEW: VoiceView = { app: "bank", itemIds: [] };
const OTHER_VIEW: VoiceView = { app: "files", itemIds: ["portal.saved"] };

describe("what the player sees and does", () => {
  it("stays silent while the email and its notification just arrive, and speaks when the inbox shows the email", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    const view = mount(store, fake.port, { viewing: null });
    await dispatch(store, advance(10));
    await dispatch(store, advance(300));
    expect(fake.starts).toEqual([]);
    // An unrelated app on screen is not the inbox.
    view.rerender({ viewing: OTHER_VIEW });
    await flush();
    expect(fake.starts).toEqual([]);
    view.rerender({ viewing: MAIL_VIEW });
    await flush();
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived")]);
    act(() => fake.handles[0].end());
    view.rerender({ viewing: null });
    view.rerender({ viewing: MAIL_VIEW });
    await flush();
    expect(fake.starts).toHaveLength(1);
  });

  it("speaks the suspicious line first when the email is opened straight away, and never the inbox line after it", async () => {
    const fake = fakePort();
    const store = createChapterStore(started([advance(10)]), S);
    const view = mount(store, fake.port, { viewing: null });
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" });
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailSuspicious")]);
    act(() => fake.handles[0].end());
    view.rerender({ viewing: MAIL_VIEW });
    await flush();
    expect(fake.starts).toHaveLength(1);
  });

  it("cuts the inbox line when the email is opened while it plays, so the two never come one after the other", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    mount(store, fake.port, { viewing: MAIL_VIEW });
    await dispatch(store, advance(10));
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived")]);
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" });
    expect(fake.handles[0].stopped).toBe(true);
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived"), file("emailSuspicious")]);
    act(() => fake.handles[1].end());
    await flush();
    expect(fake.starts).toHaveLength(2);
  });

  it("speaks the thesis line at the first writing, once, not for the laptop opening", async () => {
    const fake = fakePort();
    const store = createChapterStore(createInitialState(S), S);
    mount(store, fake.port, { viewing: null });
    await dispatch(store, { type: "START_CHAPTER" });
    await dispatch(store, advance(5));
    expect(fake.starts).toEqual([]);
    await dispatch(store, { type: "COMPLETE_THESIS_TASK", taskId: "draft.final" });
    expect(fake.starts.map((start) => start.id)).toEqual([file("thesisStart")]);
    act(() => fake.handles[0].end());
    await dispatch(store, { type: "WORK_ON_THESIS", minutes: 60 });
    expect(fake.starts.map((start) => start.id)).toEqual([file("thesisStart")]);
  });

  it("does not speak when the offers arrive, only when the player reads them", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    mount(store, fake.port, { viewing: null });
    await dispatch(store, advance(300));
    expect(fake.starts).toEqual([]);
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "msg.easy-money" });
    expect(fake.starts.map((start) => start.id)).toEqual([file("easyMoney")]);
    act(() => fake.handles[0].end());
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "msg.golden-friend" });
    expect(fake.starts.map((start) => start.id)).toEqual([file("easyMoney"), file("investment")]);
  });

  it("speaks the verify line for a real check, not for opening the contact", async () => {
    const fake = fakePort();
    const store = createChapterStore(started([advance(10)]), S);
    mount(store, fake.port, { viewing: null });
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "contact.training-office" });
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "portal.saved" });
    expect(fake.starts).toEqual([]);
    await dispatch(store, use("portal.saved", "check-account"));
    expect(fake.starts.map((start) => start.id)).toEqual([file("verify")]);
  });

  it("lets the transfer happen at once and speaks the breach line when the player looks at the bank", async () => {
    const fake = fakePort();
    const store = createChapterStore(started([advance(10), use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card")]), S);
    const view = mount(store, fake.port, { viewing: null });
    await dispatch(store, use("page.fee", "enter-code"));
    // The fee leaves with the code; the transfer comes after it.
    const before = store.getState().resources.cash;
    await dispatch(store, advance(MISSION_01_CONFIG.unauthorizedTransfers[0].afterMinutes));
    // The money left on time, and Alex said nothing about it.
    expect(store.getState().resources.cash).toBe(before - MISSION_01_CONFIG.unauthorizedTransfers[0].amountVnd);
    expect(fake.starts).toEqual([]);
    view.rerender({ viewing: BANK_VIEW });
    await flush();
    expect(fake.starts.map((start) => start.id)).toEqual([file("securityBreach")]);
    expect(store.getState().device.ledger.filter((entry) => entry.amount < 0)).toHaveLength(2);
    act(() => fake.handles[0].end());
    view.rerender({ viewing: null });
    view.rerender({ viewing: BANK_VIEW });
    await flush();
    expect(fake.starts).toHaveLength(1);
  });

  it("does not replay the lines after a continued save, however the phone and the bank are used", async () => {
    const fake = fakePort();
    const saved = started([advance(10), use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card"), use("page.fee", "enter-code"), advance(60)]);
    const store = createChapterStore(saved, S);
    const view = mount(store, fake.port, { viewing: null });
    view.rerender({ viewing: MAIL_VIEW });
    view.rerender({ viewing: BANK_VIEW });
    await flush();
    expect(fake.starts).toEqual([]);
  });

  it("drops a line that waited too long behind another one", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"] });
    try {
      const fake = fakePort();
      const store = createChapterStore(createInitialState(S), S);
      mount(store, fake.port, { viewing: null, introVisible: true });
      await flush();
      expect(fake.starts.map((start) => start.id)).toEqual([file("intro")]);
      await dispatch(store, { type: "START_CHAPTER" });
      await dispatch(store, { type: "COMPLETE_THESIS_TASK", taskId: "draft.final" });
      await act(async () => void vi.advanceTimersByTime(QUEUE_TTL_MS + 1000));
      act(() => fake.handles[0].end());
      await flush();
      expect(fake.starts).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("playback", () => {
  it("plays the intro once for the new-game intro, at the voice volume, and not again on a re-render", async () => {
    const fake = fakePort();
    const store = createChapterStore(createInitialState(S), S);
    const view = mount(store, fake.port, { introVisible: true });
    await flush();
    expect(fake.starts).toEqual([{ id: file("intro"), offsetMs: 0, gain: 0.8 }]);
    view.rerender({});
    view.rerender({ introVisible: true });
    await flush();
    expect(fake.starts).toHaveLength(1);
    act(() => fake.handles[0].end());
    view.rerender({ introVisible: false });
    view.rerender({ introVisible: true });
    await flush();
    expect(fake.starts).toHaveLength(1);
  });

  it("reports the opening as speaking while its line plays, and not without an engine", async () => {
    const fake = fakePort();
    const view = mount(createChapterStore(createInitialState(S), S), fake.port, { introVisible: true });
    await flush();
    expect(view.result.current.introSpeaking).toBe(true);
    act(() => fake.handles[0].end());
    expect(view.result.current.introSpeaking).toBe(false);
    const none = mount(createChapterStore(createInitialState(S), S), null, { introVisible: true });
    await flush();
    expect(none.result.current.introSpeaking).toBe(false);
  });
  it("never plays the intro when a save is continued, nor any cue that already held when it was saved", async () => {
    const fake = fakePort();
    const saved = started([advance(10), { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" }, use("mail.clearance", "open-link"), use("page.fee", "sign-in"), use("page.fee", "pay-card"), use("page.fee", "enter-code"), advance(MISSION_01_CONFIG.unauthorizedTransfers[0].afterMinutes)]);
    const store = createChapterStore(saved, S);
    mount(store, fake.port, { introVisible: false });
    await flush();
    expect(fake.starts).toEqual([]);
    // A new moment after the load still plays, once.
    await dispatch(store, use("contact.training-office", "call"));
    expect(fake.starts.map((start) => start.id)).toEqual([file("verify")]);
  });

  it("plays a branch line when the player enters the branch, once, and not when time passes", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    mount(store, fake.port);
    await dispatch(store, advance(10));
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived")]);
    act(() => fake.handles[0].end());
    await dispatch(store, advance(400));
    expect(fake.starts).toHaveLength(1);
    await dispatch(store, use("msg.easy-money", "open-link"));
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived"), file("easyMoney")]);
  });

  it("never overlaps: lines that come together wait for the one that plays", async () => {
    const fake = fakePort();
    const store = createChapterStore(started([advance(10)]), S);
    mount(store, fake.port);
    await flush();
    expect(fake.starts).toEqual([]);
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" });
    await dispatch(store, use("portal.saved", "check-account"));
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailSuspicious")]);
    act(() => fake.handles[0].end());
    await flush();
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailSuspicious"), file("verify")]);
    act(() => fake.handles[1].end());
    await flush();
    expect(fake.starts).toHaveLength(2);
  });

  it("stops while the game is held and continues from the same point, without a second copy", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    const view = mount(store, fake.port);
    await dispatch(store, advance(10));
    expect(fake.starts).toHaveLength(1);
    view.rerender({ held: true });
    await flush();
    expect(fake.handles[0].stopped).toBe(true);
    expect(fake.starts).toHaveLength(1);
    view.rerender({ held: true });
    await flush();
    expect(fake.starts).toHaveLength(1);
    view.rerender({ held: false });
    await flush();
    expect(fake.starts).toHaveLength(2);
    expect(fake.starts[1]).toEqual({ id: file("emailReceived"), offsetMs: 1500, gain: 0.8 });
    view.rerender({ held: false });
    await flush();
    expect(fake.starts).toHaveLength(2);
  });

  it("waits while a call is open, and while the tab is hidden", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    const view = mount(store, fake.port, { callOpen: true });
    await dispatch(store, advance(10));
    expect(fake.starts).toEqual([]);
    view.rerender({ callOpen: false });
    await flush();
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived")]);
  });

  it("stays silent when sound is off or the volume is zero", async () => {
    for (const patch of [
      { settings: { soundEnabled: false, voiceVolume: 1 } },
      { settings: { soundEnabled: true, voiceVolume: 0 } },
    ]) {
      const fake = fakePort();
      const store = createChapterStore(started(), S);
      mount(store, fake.port, patch);
      await dispatch(store, advance(10));
      expect(fake.starts).toEqual([]);
    }
  });

  it("plays the English clip in English and the Vietnamese clip in Vietnamese, never both", async () => {
    for (const locale of ["en", "vi"] as const) {
      const fake = fakePort();
      const store = createChapterStore(started(), S);
      mount(store, fake.port, { locale, introVisible: true });
      await flush();
      await dispatch(store, advance(10));
      expect(fake.starts.map((start) => start.id)).toEqual([file("intro", locale)]);
      act(() => fake.handles[0].end());
      await flush();
      expect(fake.starts.map((start) => start.id)).toEqual([file("intro", locale), file("emailReceived", locale)]);
      expect(fake.loads.every((url) => url.includes(`/${locale}/`) && url.endsWith(`_${locale}.mp3`))).toBe(true);
    }
  });

  it("stops the line when the language changes and plays the next ones in the new language, without replaying the cut one", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    const view = mount(store, fake.port, { locale: "en" });
    await dispatch(store, advance(10));
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived", "en")]);
    view.rerender({ locale: "vi" });
    await flush();
    expect(fake.handles[0].stopped).toBe(true);
    expect(fake.starts).toHaveLength(1);
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" });
    expect(fake.starts.map((start) => start.id)).toEqual([file("emailReceived", "en"), file("emailSuspicious", "vi")]);
    // Back to English: that line stops too and nothing from the old language comes back.
    view.rerender({ locale: "en" });
    await flush();
    expect(fake.handles[1].stopped).toBe(true);
    expect(fake.starts).toHaveLength(2);
  });

  it("does not start a clip of the old language that was still loading when the language changed", async () => {
    const fake = fakePort();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolveGate) => (release = resolveGate));
    const slow: AudioPort = { ...fake.port, load: async (url) => (url.includes("/en/") ? gate.then(() => fake.port.load(url)) : fake.port.load(url)) };
    const store = createChapterStore(started(), S);
    const view = mount(store, slow, { locale: "en" });
    await dispatch(store, advance(10));
    view.rerender({ locale: "vi" });
    await flush();
    release();
    await flush();
    expect(fake.starts.every((start) => !start.id.includes("/en/"))).toBe(true);
    expect(fake.starts.length).toBeLessThanOrEqual(1);
  });

  it("plays nothing without an audio engine and never throws", async () => {
    const store = createChapterStore(started(), S);
    mount(store, null, { introVisible: true });
    await dispatch(store, advance(10));
    expect(true).toBe(true);
  });

  it("falls back to the caption when a clip cannot load, then goes on with the next line", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fake = fakePort();
      const failing: AudioPort = { ...fake.port, load: vi.fn(async (url: string) => (url.includes("email_received") ? Promise.reject(new Error("404")) : fake.port.load(url))) };
      const store = createChapterStore(started(), S);
      const view = mount(store, failing);
      await dispatch(store, advance(10));
      // No sound, but the caption of the line is current, so the player can read it.
      expect(view.result.current.current).toBe("emailReceived");
      expect(fake.starts).toEqual([]);
      await dispatch(store, use("portal.saved", "check-account"));
      expect(fake.starts).toEqual([]);
      await act(async () => void vi.advanceTimersByTime(CAPTION_ONLY_MS + 50));
      await flush();
      expect(view.result.current.current).toBe("verify");
      expect(fake.starts.map((start) => start.id)).toEqual([file("verify")]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for a gesture when the browser keeps the audio suspended, then plays once, and leaves nothing behind after unmount", async () => {
    const fake = fakePort();
    let state: "running" | "suspended" = "suspended";
    const resume = vi.fn(async () => state);
    const port: AudioPort = { ...fake.port, resume };
    const store = createChapterStore(started(), S);
    const view = mount(store, port);
    await dispatch(store, advance(10));
    expect(fake.starts).toEqual([]);
    state = "running";
    await act(async () => void window.dispatchEvent(new Event("pointerdown")));
    await flush();
    expect(fake.starts).toHaveLength(1);
    // A second refused start, then the layer goes away: a later gesture does nothing.
    state = "suspended";
    act(() => fake.handles[0].end());
    await dispatch(store, { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" });
    expect(fake.starts).toHaveLength(1);
    const calls = resume.mock.calls.length;
    view.unmount();
    state = "running";
    await act(async () => void window.dispatchEvent(new Event("pointerdown")));
    await flush();
    expect(resume.mock.calls.length).toBe(calls);
    expect(fake.starts).toHaveLength(1);
  });

  it("stops the line when the layer goes away", async () => {
    const fake = fakePort();
    const store = createChapterStore(started(), S);
    const view = mount(store, fake.port);
    await dispatch(store, advance(10));
    view.unmount();
    expect(fake.handles[0].stopped).toBe(true);
  });
});
