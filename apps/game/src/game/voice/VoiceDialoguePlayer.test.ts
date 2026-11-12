// Example tests for the Chapter 1 voice dialogue player (requirements 5.1 to 5.13).
// Uses the fake audio port, fake preview port and fake clock: no network, no real audio.

import type { GameLocale } from "@scammaze/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeAudioPort,
  createFakePreviewPort,
  type FakeAudioPort,
  type FakePreviewPort,
} from "../../test/fakeAudioPort";
import {
  createVoiceDialoguePlayer,
  type VoiceDialoguePlayer,
  type VoiceSettings,
  type VoiceTarget,
} from "./VoiceDialoguePlayer";
import type { VoiceClipEntry, VoiceManifest } from "./manifestTypes";

const GRAPH = "dlg.scam-call" as const;

function clip(nodeId: string, locale: GameLocale, status: "present" | "missing" = "present"): VoiceClipEntry {
  return {
    clipId: nodeId,
    nodeId,
    graphId: GRAPH,
    speakerId: "spk.alex",
    locale,
    status,
    sources: status === "present" ? [{ src: `/voice/${locale}/${nodeId}.mp3`, type: "audio/mpeg" }] : [],
    tone: "professional",
    voiceNote: "test",
    origin: status === "present" ? "tts-generated" : "none",
    credit: "not provided",
    sourceTextHash: "00000000",
  };
}

function manifestOf(clips: VoiceClipEntry[]): VoiceManifest {
  return { schemaVersion: 1, chapterId: "chapter-1", clips };
}

function target(nodeId: string, pauseBeforeMs = 0): VoiceTarget {
  return {
    key: `${GRAPH}:${nodeId}`,
    graphId: GRAPH,
    nodeId,
    speakerId: "spk.alex",
    tone: "professional",
    channel: "phone",
    lineText: `Line ${nodeId}`,
    pauseBeforeMs,
  };
}

const SETTINGS: VoiceSettings = {
  locale: "en",
  soundEnabled: true,
  masterVolume: 1,
  voiceVolume: 1,
  phoneFilter: true,
  englishVoiceFallback: false,
  devPreview: false,
};

interface Rig {
  port: FakeAudioPort;
  preview: FakePreviewPort;
  player: VoiceDialoguePlayer;
  log: ReturnType<typeof vi.fn>;
  /** Advance the fake clock, then let promise callbacks run. */
  tick(ms: number): Promise<void>;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

function rig(
  clips: VoiceClipEntry[],
  settings: Partial<VoiceSettings> = {},
  portOptions: Parameters<typeof createFakeAudioPort>[0] = { autoLoad: true },
): Rig {
  const port = createFakeAudioPort(portOptions);
  const preview = createFakePreviewPort();
  const log = vi.fn();
  const player = createVoiceDialoguePlayer({
    manifest: manifestOf(clips),
    port,
    preview,
    now: port.clock.now,
    setTimer: port.clock.setTimer,
    clearTimer: port.clock.clearTimer,
    log,
  });
  player.configure({ ...SETTINGS, ...settings });
  return {
    port,
    preview,
    player,
    log,
    async tick(ms) {
      port.clock.advance(ms);
      await flush();
    },
  };
}

describe("VoiceDialoguePlayer", () => {
  it("plays the clip of the shown node and of the selected locale", async () => {
    const r = rig([clip("a", "en"), clip("b", "en"), clip("a", "vi")]);
    r.player.show(target("a"));
    await r.tick(0);
    expect(r.port.last()?.clip.id).toBe("/voice/en/a.mp3");
    expect(r.player.getSnapshot()).toMatchObject({ phase: "playing", source: "clip", audible: true });

    r.player.show(target("b"));
    await r.tick(0);
    expect(r.port.last()?.clip.id).toBe("/voice/en/b.mp3");
    expect(r.port.liveHandles).toBe(1);

    r.player.configure({ ...SETTINGS, locale: "vi" });
    expect(r.port.liveHandles).toBe(0);
    r.player.show(target("a"));
    await r.tick(0);
    expect(r.port.last()?.clip.id).toBe("/voice/vi/a.mp3");
  });

  it("waits for the pause before the line", async () => {
    const r = rig([clip("a", "en")]);
    r.player.show(target("a", 300));
    await r.tick(299);
    expect(r.port.playbacks).toHaveLength(0);
    await r.tick(1);
    expect(r.port.playbacks).toHaveLength(1);
  });

  it("replay restarts the latest line without a second overlapping source", async () => {
    const r = rig([clip("a", "en")]);
    r.player.show(target("a"));
    await r.tick(0);
    const first = r.port.last();
    r.player.replay();
    await r.tick(0);
    expect(r.port.playbacks).toHaveLength(2);
    expect(first?.live).toBe(false);
    expect(r.port.last()?.offsetMs).toBe(0);
    expect(r.port.maxConcurrentPlaybacks).toBe(1);
    expect(r.player.getSnapshot().targetKey).toBe(`${GRAPH}:a`);
    expect(r.player.getSnapshot().endedCount).toBe(0);
  });

  it("counts a natural end once and reports the ended phase", async () => {
    const r = rig([clip("a", "en")]);
    r.player.show(target("a"));
    await r.tick(0);
    r.port.fireEnded(r.port.last()!.id);
    expect(r.player.getSnapshot()).toMatchObject({ phase: "ended", endedCount: 1, audible: false });
  });

  it("hang up stops the source and the timers in the same call", async () => {
    const r = rig([clip("a", "en")]);
    r.player.show(target("a"));
    await r.tick(0);
    r.player.show(target("a", 500)); // leaves a pending pause timer and late timer
    r.player.stop("hang-up");
    expect(r.port.liveHandles).toBe(0);
    expect(r.port.timers).toBe(0);
    expect(r.player.getSnapshot().phase).toBe("idle");
    await r.tick(5000);
    expect(r.port.playbacks).toHaveLength(1);
  });

  it("mute silences the live source and replay unmutes", async () => {
    const r = rig([clip("a", "en")]);
    r.player.show(target("a"));
    await r.tick(0);
    r.player.setMuted(true);
    expect(r.port.last()?.gain).toBe(0);
    expect(r.player.getSnapshot()).toMatchObject({ muted: true, audible: false });
    r.player.replay();
    await r.tick(0);
    expect(r.player.getSnapshot()).toMatchObject({ muted: false, audible: true });
    expect(r.port.last()?.gain).toBe(1);
  });

  it("voice volume 0 and sound off start nothing", async () => {
    const r = rig([clip("a", "en")], { voiceVolume: 0 });
    r.player.show(target("a"));
    await r.tick(2000);
    expect(r.port.loadRequests).toHaveLength(0);
    expect(r.port.playbacks).toHaveLength(0);
    expect(r.player.getSnapshot()).toMatchObject({ phase: "unavailable", reason: "disabled" });
  });

  it("shows blocked when autoplay is refused and replay works after unlock", async () => {
    const r = rig([clip("a", "en")], {}, { autoLoad: true, resumeResult: "suspended" });
    r.player.show(target("a"));
    await r.tick(0);
    expect(r.player.getSnapshot()).toMatchObject({ phase: "blocked", reason: "autoplay-blocked" });
    expect(r.port.playbacks).toHaveLength(0);

    r.port.allowResume();
    await r.player.unlock();
    r.player.replay();
    await r.tick(0);
    expect(r.player.getSnapshot().phase).toBe("playing");
    expect(r.port.playbacks).toHaveLength(1);
  });

  it("falls back when the clip is missing", async () => {
    const r = rig([clip("a", "en", "missing")]);
    r.player.show(target("a"));
    await r.tick(0);
    expect(r.player.getSnapshot()).toMatchObject({ phase: "unavailable", reason: "missing", label: "none" });
    expect(r.port.loadRequests).toHaveLength(0);
  });

  it("falls back when the clip fails to load", async () => {
    const r = rig([clip("a", "en")], {}, { autoLoad: false });
    r.port.failLoad("/voice/en/a.mp3");
    r.player.show(target("a"));
    await r.tick(0);
    expect(r.player.getSnapshot()).toMatchObject({ phase: "failed", reason: "load-failed" });
    expect(r.port.playbacks).toHaveLength(0);
  });

  it("skips a clip that is not ready after 1500 ms", async () => {
    const r = rig([clip("a", "en")], {}, { autoLoad: false });
    r.player.show(target("a"));
    await r.tick(1499);
    expect(r.player.getSnapshot().phase).toBe("loading");
    await r.tick(1);
    expect(r.player.getSnapshot()).toMatchObject({ phase: "unavailable", reason: "late" });
    r.port.completeLoad();
    await r.tick(0);
    expect(r.port.playbacks).toHaveLength(0);
  });

  it("labels an English clip as english-voice and never uses it without the setting", async () => {
    const clips = [clip("a", "en")];
    const off = rig(clips, { locale: "vi" });
    off.player.show(target("a"));
    await off.tick(0);
    expect(off.player.getSnapshot()).toMatchObject({ phase: "unavailable", reason: "missing", label: "none" });
    expect(off.port.playbacks).toHaveLength(0);

    const on = rig(clips, { locale: "vi", englishVoiceFallback: true });
    on.player.show(target("a"));
    await on.tick(0);
    expect(on.player.getSnapshot()).toMatchObject({ phase: "playing", label: "english-voice" });
    expect(on.port.last()?.clip.id).toBe("/voice/en/a.mp3");
  });

  it("labels the developer preview and stays silent without it", async () => {
    const off = rig([]);
    off.player.show(target("a"));
    await off.tick(0);
    expect(off.preview.spoken).toHaveLength(0);
    expect(off.player.getSnapshot().label).toBe("none");

    const on = rig([], { devPreview: true });
    on.player.show(target("a"));
    expect(on.player.getSnapshot()).toMatchObject({ source: "dev-preview", label: "dev-preview" });
    await on.tick(0);
    expect(on.preview.spoken).toHaveLength(1);
    expect(on.preview.spoken[0].text).toBe("Line a");
    expect(on.player.getSnapshot()).toMatchObject({ phase: "playing", label: "dev-preview" });
    on.player.stop("hang-up");
    expect(on.preview.liveUtterances).toBe(0);
  });

  it("pause and resume continue from the absolute position", async () => {
    const r = rig([clip("a", "en")]);
    r.player.show(target("a"));
    await r.tick(0);
    await r.tick(400);
    r.player.pause();
    expect(r.player.getSnapshot().phase).toBe("paused");
    expect(r.port.liveHandles).toBe(0);
    expect(r.player.getSnapshot().endedCount).toBe(0);

    r.player.resume();
    expect(r.port.last()?.offsetMs).toBe(400);
    await r.tick(300);
    r.player.pause();
    r.player.resume();
    // Fake positionMs is absolute (offset plus elapsed), as the player expects.
    expect(r.port.last()?.offsetMs).toBe(700);
    expect(r.port.maxConcurrentPlaybacks).toBe(1);
  });

  it("dispose stops everything and removes listeners", async () => {
    const r = rig([clip("a", "en")]);
    const listener = vi.fn();
    r.player.subscribe(listener);
    r.player.show(target("a"));
    await r.tick(0);
    r.player.show(target("a", 500));
    listener.mockClear();
    r.player.dispose();
    expect(r.port.liveHandles).toBe(0);
    expect(r.port.timers).toBe(0);
    expect(r.port.disposed).toBe(true);
    expect(r.preview.disposed).toBe(true);
    await r.tick(5000);
    r.player.show(target("a"));
    await r.tick(0);
    expect(listener).not.toHaveBeenCalled();
    expect(r.port.playbacks).toHaveLength(1);
  });
});
