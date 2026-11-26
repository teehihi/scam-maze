// The street voice of a Mission 02 conversation: after a reply, Alex says the reply he picked and
// the NPC answers when he has finished, on the one line channel (never together). An unrecorded or
// failing reply clip leaves only the written echo, and the NPC answers at once.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lineVoiceKey, setLineAudioFactoryForTests, type LineAudio } from "../device/lineVoice";
import type { ActiveStoryNpcDialogue } from "../../testbus/openworld/simulation/storyNpcs";
import { useStreetVoice } from "./useOutsideWorld";

// Every voice ID is "recorded" here, so the order of the two clips can be observed.
vi.mock("../voice/mission02Voice", () => ({
  mission02VoiceUrl: (voiceId: string | null | undefined) => (voiceId ? `/clip/${voiceId}.mp3` : null),
}));

class FakeAudio implements LineAudio {
  src = "";
  preload = "";
  currentTime = 0;
  private readonly listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string) {
    [...(this.listeners.get(type) ?? [])].forEach((listener) => listener());
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
}

const created: FakeAudio[] = [];
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => void (await Promise.resolve()));
};
const dialogue = (replyVoiceId: string | null): ActiveStoryNpcDialogue =>
  ({ lineKey: 7, currentVoiceId: "npc.answer", lastPlayerReplyVoiceId: replyVoiceId }) as unknown as ActiveStoryNpcDialogue;
const ready = async (index: number) => {
  await flush();
  await act(async () => created[index].fire("canplay"));
  await flush();
};

function setup() {
  created.length = 0;
  setLineAudioFactoryForTests((url) => {
    const audio = new FakeAudio();
    audio.src = url;
    created.push(audio);
    return audio;
  });
}

afterEach(() => setLineAudioFactoryForTests(null));

describe("street voice after a reply", () => {
  it("plays Alex's reply first and the NPC's answer only after it ends", async () => {
    setup();
    renderHook(() => useStreetVoice(dialogue("m02.coba.interview.process.alex"), null, "en", { soundEnabled: true, englishFallback: false }));
    await ready(0);
    expect(created.map((audio) => audio.src)).toEqual(["/clip/m02.coba.interview.process.alex.mp3"]);
    expect(lineVoiceKey()).toBe("street-line:7:alex");
    // Alex is still speaking: the answer has not started.
    expect(created).toHaveLength(1);
    await act(async () => created[0].fire("ended"));
    await ready(1);
    expect(created.map((audio) => audio.src)).toEqual(["/clip/m02.coba.interview.process.alex.mp3", "/clip/npc.answer.mp3"]);
    expect(lineVoiceKey()).toBe("street-line:7");
  });

  it("lets the NPC answer at once when the reply has no recording", async () => {
    setup();
    renderHook(() => useStreetVoice(dialogue(null), null, "en", { soundEnabled: true, englishFallback: false }));
    await ready(0);
    expect(created.map((audio) => audio.src)).toEqual(["/clip/npc.answer.mp3"]);
    expect(lineVoiceKey()).toBe("street-line:7");
  });

  it("lets the NPC answer when Alex's clip cannot load", async () => {
    setup();
    renderHook(() => useStreetVoice(dialogue("m02.driver.driver_ask_app.alex"), null, "en", { soundEnabled: true, englishFallback: false }));
    await flush();
    await act(async () => created[0].fire("error"));
    await ready(1);
    expect(created.map((audio) => audio.src)).toEqual(["/clip/m02.driver.driver_ask_app.alex.mp3", "/clip/npc.answer.mp3"]);
  });

  it("stops both when the conversation moves on, so no answer starts late", async () => {
    setup();
    const view = renderHook(() => useStreetVoice(dialogue("m02.coba.after.thanks.alex"), null, "en", { soundEnabled: true, englishFallback: false }));
    await ready(0);
    view.unmount();
    expect(lineVoiceKey()).toBeNull();
    await act(async () => created[0].fire("ended"));
    await flush();
    expect(created).toHaveLength(1);
  });

  it("is silent with sound off", async () => {
    setup();
    renderHook(() => useStreetVoice(dialogue("m02.coba.after.thanks.alex"), null, "en", { soundEnabled: false, englishFallback: false }));
    await flush();
    expect(created).toEqual([]);
  });
});
