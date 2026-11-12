import { describe, expect, it } from "vitest";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import { createFakeAudioPort, createFakeClock } from "../../test/fakeAudioPort";
import type { FakeAudioPort } from "../../test/fakeAudioPort";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { DIALOGUE_GRAPH_IDS, SPEAKER_IDS, TONE_IDS } from "../narrative/chapter1/ids";
import type { VoiceClipEntry, VoiceManifest } from "./manifestTypes";
import { VOICE_MANIFEST_SCHEMA_VERSION } from "./manifestTypes";
import { createVoiceDialoguePlayer } from "./VoiceDialoguePlayer";
import type { VoicePhase, VoiceSettings, VoiceTarget } from "./VoiceDialoguePlayer";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** Base seeds for this file, derived from the shared core seed (one per property). */
const SEED_P12 = (CORE_PROPERTY_SEED ^ 0x0f411e5) >>> 0;
const SEED_P13 = (CORE_PROPERTY_SEED ^ 0x0a0d1b1e) >>> 0;

const GRAPH_ID = DIALOGUE_GRAPH_IDS[0];
const SPEAKER_ID = SPEAKER_IDS[0];
const TONE = TONE_IDS[0];

/** Every phase the player is allowed to report. */
const KNOWN_PHASES: readonly VoicePhase[] = [
  "idle",
  "loading",
  "playing",
  "paused",
  "ended",
  "failed",
  "blocked",
  "unavailable",
];

/** Lets chained promise callbacks of the player settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

function urlOf(nodeId: string): string {
  return `${CHAPTER1_VOICE_BASE}/en/${nodeId}.mp3`;
}

function manifestFor(nodeIds: readonly string[]): VoiceManifest {
  const clips: VoiceClipEntry[] = nodeIds.map((nodeId) => ({
    clipId: nodeId,
    nodeId,
    graphId: GRAPH_ID,
    speakerId: SPEAKER_ID,
    locale: "en",
    status: "present",
    sources: [{ src: urlOf(nodeId), type: "audio/mpeg" }],
    durationMs: 1000,
    tone: TONE,
    voiceNote: "test",
    origin: "tts-generated",
    credit: "test",
    sourceTextHash: "00000000",
  }));
  return { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips };
}

function target(nodeId: string, channel: "phone" | "face-to-face" = "phone"): VoiceTarget {
  return {
    key: `${GRAPH_ID}:${nodeId}`,
    graphId: GRAPH_ID,
    nodeId,
    speakerId: SPEAKER_ID,
    tone: TONE,
    channel,
    lineText: "test line",
    pauseBeforeMs: 0,
  };
}

const BASE_SETTINGS: VoiceSettings = {
  locale: "en",
  soundEnabled: true,
  masterVolume: 1,
  voiceVolume: 1,
  phoneFilter: true,
  englishVoiceFallback: false,
  devPreview: false,
};

function makePlayer(port: FakeAudioPort, manifest: VoiceManifest) {
  const logs: string[] = [];
  const clock = port.clock;
  const player = createVoiceDialoguePlayer({
    manifest,
    port,
    preview: null,
    now: () => clock.now(),
    setTimer: (fn, ms) => clock.setTimer(fn, ms),
    clearTimer: (id) => clock.clearTimer(id),
    log: (message) => logs.push(message),
  });
  return { player, logs };
}

// ---------------------------------------------------------------------------
// Property 12
// ---------------------------------------------------------------------------

/** Nodes touched by the random steps. `n.2` and below may fail to load; `n.good` never does. */
const RANDOM_NODES = ["n.0", "n.1", "n.2", "n.good"] as const;
/** Nodes reserved for the closing checks, so earlier random steps cannot cache them. */
const FAILING_NODE = "n.fail";
const GOOD_NODE = "n.good2";

type Step =
  | { kind: "show"; node: number }
  | { kind: "replay" }
  | { kind: "stop" }
  | { kind: "unlock" }
  | { kind: "complete"; node: number }
  | { kind: "fail"; node: number }
  | { kind: "refuse" }
  | { kind: "allow" }
  | { kind: "advance"; ms: number }
  | { kind: "ended" };

function generateSteps(seed: number): { steps: Step[]; failCount: number } {
  const next = createLcg(seed);
  const length = randomInt(next, 4, 30);
  const steps: Step[] = [];
  for (let i = 0; i < length; i += 1) {
    switch (randomInt(next, 0, 9)) {
      case 0:
      case 1:
        steps.push({ kind: "show", node: randomInt(next, 0, 3) });
        break;
      case 2:
        steps.push({ kind: "replay" });
        break;
      case 3:
        steps.push({ kind: "stop" });
        break;
      case 4:
        steps.push({ kind: "unlock" });
        break;
      case 5:
        steps.push({ kind: "complete", node: randomInt(next, 0, 3) });
        break;
      case 6:
        steps.push({ kind: "fail", node: randomInt(next, 0, 2) });
        break;
      case 7:
        steps.push(next() < 0.5 ? { kind: "refuse" } : { kind: "allow" });
        break;
      case 8:
        steps.push({ kind: "advance", ms: randomInt(next, 0, 2500) });
        break;
      default:
        steps.push({ kind: "ended" });
    }
  }
  return { steps, failCount: randomInt(next, 1, 4) };
}

/** Runs a prefix of the steps and the closing checks. Returns the first violation or null. */
async function runFailureCase(
  prefix: readonly Step[],
  failCount: number,
  resumeRefusedAtStart: boolean,
): Promise<string | null> {
  const clock = createFakeClock();
  const port = createFakeAudioPort({
    clock,
    resumeResult: resumeRefusedAtStart ? "suspended" : "running",
  });
  const manifest = manifestFor([...RANDOM_NODES, FAILING_NODE, GOOD_NODE]);
  const { player, logs } = makePlayer(port, manifest);
  player.configure(BASE_SETTINGS);
  port.failLoad(urlOf(FAILING_NODE));

  const check = (where: string): string | null => {
    const snap = player.getSnapshot();
    if (!KNOWN_PHASES.includes(snap.phase)) return `${where}: unknown phase ${snap.phase}`;
    if (port.liveHandles > 1) return `${where}: ${port.liveHandles} live handles`;
    const counts = new Map<string, number>();
    for (const line of logs) counts.set(line, (counts.get(line) ?? 0) + 1);
    for (const [line, n] of counts) if (n > 1) return `${where}: log line written ${n} times: ${line}`;
    for (const node of [...RANDOM_NODES, FAILING_NODE, GOOD_NODE]) {
      const n = logs.filter((line) => line.includes(urlOf(node))).length;
      if (n > 1) return `${where}: ${n} log lines for ${node}`;
    }
    return null;
  };

  try {
    for (let i = 0; i < prefix.length; i += 1) {
      const step = prefix[i];
      switch (step.kind) {
        case "show":
          player.show(target(RANDOM_NODES[step.node]));
          break;
        case "replay":
          player.replay();
          break;
        case "stop":
          player.stop("node-changed");
          break;
        case "unlock":
          await player.unlock();
          break;
        case "complete":
          port.completeLoad(urlOf(RANDOM_NODES[step.node]));
          break;
        case "fail":
          port.failLoad(urlOf(RANDOM_NODES[step.node]));
          break;
        case "refuse":
          port.refuseResume();
          break;
        case "allow":
          port.allowResume();
          break;
        case "advance":
          clock.advance(step.ms);
          break;
        case "ended": {
          const live = port.playbacks.find((p) => p.live);
          if (live) port.fireEnded(live.id);
          break;
        }
      }
      await flush();
      const violation = check(`step ${i} (${JSON.stringify(step)})`);
      if (violation) return violation;
    }

    // A clip that fails to load any number of times ends in `failed` and is logged once.
    port.allowResume();
    for (let k = 0; k < failCount; k += 1) {
      player.show(target(FAILING_NODE));
      clock.advance(0);
      await flush();
      const phase = player.getSnapshot().phase;
      if (phase !== "failed") return `failing clip, attempt ${k + 1}: phase ${phase}, expected failed`;
      const violation = check(`failing clip, attempt ${k + 1}`);
      if (violation) return violation;
    }
    const failLines = logs.filter((line) => line.includes(urlOf(FAILING_NODE))).length;
    if (failLines !== 1) return `failing clip logged ${failLines} times after ${failCount} attempts`;

    // An audio port that refuses to resume ends in `blocked`, and the next show is not blocked by it.
    port.refuseResume();
    player.show(target(GOOD_NODE));
    port.completeLoad(urlOf(GOOD_NODE));
    clock.advance(0);
    await flush();
    const blocked = player.getSnapshot().phase;
    if (blocked !== "blocked") return `refused resume: phase ${blocked}, expected blocked`;
    if (port.playbacks.some((p) => p.live)) return "refused resume: a playback is live";

    port.allowResume();
    player.show(target(GOOD_NODE));
    clock.advance(0);
    await flush();
    const after = player.getSnapshot().phase;
    if (after !== "playing") return `show after a failure and a refusal: phase ${after}, expected playing`;
    return check("closing");
  } catch (error) {
    return `threw: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    player.dispose();
  }
}

// ---------------------------------------------------------------------------
// Property 13
// ---------------------------------------------------------------------------

type Stage = "playing" | "paused" | "resumed" | "ended";
const STAGES: readonly Stage[] = ["playing", "paused", "resumed", "ended"];

interface AudibilityCase {
  settings: VoiceSettings;
  muted: boolean;
  subtitlesEnabled: boolean;
  stage: Stage;
  channel: "phone" | "face-to-face";
  second: { soundEnabled: boolean; voiceVolume: number; masterVolume: number; phoneFilter: boolean };
}

/** Volumes with extra weight on 0 and 1, where the rules change. */
function volume(next: () => number): number {
  const roll = next();
  if (roll < 0.2) return 0;
  if (roll < 0.35) return 1;
  return Math.round(next() * 100) / 100;
}

function generateAudibilityCase(seed: number): AudibilityCase {
  const next = createLcg(seed);
  return {
    settings: {
      ...BASE_SETTINGS,
      soundEnabled: next() < 0.75,
      voiceVolume: volume(next),
      masterVolume: next() < 0.1 ? 0 : volume(next),
      phoneFilter: next() < 0.5,
    },
    muted: next() < 0.3,
    subtitlesEnabled: next() < 0.5,
    stage: pick(next, STAGES),
    channel: next() < 0.5 ? "phone" : "face-to-face",
    second: {
      soundEnabled: next() < 0.8,
      voiceVolume: volume(next),
      masterVolume: next() < 0.1 ? 0 : volume(next),
      phoneFilter: next() < 0.5,
    },
  };
}

/** Independent statement of the rule: gain is 0 exactly when sound is off, the volume is 0 or muted. */
function expectedGain(s: { soundEnabled: boolean; voiceVolume: number; masterVolume: number }, muted: boolean): number {
  if (!s.soundEnabled || muted) return 0;
  return s.voiceVolume * s.masterVolume;
}

function isDisabled(s: { soundEnabled: boolean; voiceVolume: number; masterVolume: number }): boolean {
  return !s.soundEnabled || s.voiceVolume * s.masterVolume === 0;
}

async function runAudibilityCase(c: AudibilityCase): Promise<string | null> {
  const clock = createFakeClock();
  const port = createFakeAudioPort({ clock });
  const { player } = makePlayer(port, manifestFor(["n.a"]));
  const nodeUrl = urlOf("n.a");
  const captionVisible = (): boolean => c.subtitlesEnabled || !player.getSnapshot().audible;

  try {
    player.configure(c.settings);
    player.setMuted(c.muted);
    player.show(target("n.a", c.channel));
    port.completeLoad(nodeUrl);
    clock.advance(0);
    await flush();

    if (isDisabled(c.settings)) {
      // No playback is started when sound is off or the volume is 0.
      if (port.playbacks.length !== 0) return `playback started with sound off or volume 0`;
      if (player.getSnapshot().audible) return "audible with sound off or volume 0";
      return captionVisible() ? null : "captions hidden although nothing is audible";
    }

    const first = port.playbacks[0];
    if (!first) return `no playback started (phase ${player.getSnapshot().phase})`;
    const wantFilter = c.channel === "phone" && c.settings.phoneFilter;
    if (first.phoneFilter !== wantFilter) return `phone filter ${first.phoneFilter}, expected ${wantFilter}`;
    const gain1 = expectedGain(c.settings, c.muted);
    if (first.gain !== gain1) return `start gain ${first.gain}, expected ${gain1}`;
    if ((first.gain === 0) !== (c.muted || c.settings.voiceVolume * c.settings.masterVolume === 0)) {
      return `gain ${first.gain} is zero for the wrong reason`;
    }
    if (player.getSnapshot().phase !== "playing") return `phase ${player.getSnapshot().phase}, expected playing`;

    // Move to the requested stage.
    let playing = true;
    if (c.stage === "paused" || c.stage === "resumed") {
      player.pause();
      playing = false;
      if (player.getSnapshot().audible) return "audible while paused";
      if (port.liveHandles !== 0) return "a handle is live while paused";
      if (c.stage === "resumed") {
        player.resume();
        await flush();
        playing = true;
        const resumed = port.last();
        if (!resumed || !resumed.live) return "resume started no playback";
        if (resumed.phoneFilter !== wantFilter) return `resumed phone filter ${resumed.phoneFilter}, expected ${wantFilter}`;
        if (resumed.gain !== gain1) return `resumed gain ${resumed.gain}, expected ${gain1}`;
      }
    } else if (c.stage === "ended") {
      port.fireEnded(first.id);
      playing = false;
      if (player.getSnapshot().phase !== "ended") return `phase ${player.getSnapshot().phase}, expected ended`;
    }

    const audible = playing && gain1 > 0;
    if (player.getSnapshot().audible !== audible) {
      return `stage ${c.stage}: audible ${player.getSnapshot().audible}, expected ${audible}`;
    }
    if (captionVisible() !== (c.subtitlesEnabled || !audible)) return `stage ${c.stage}: caption visibility mismatch`;
    if (!c.subtitlesEnabled && audible && captionVisible()) return "captions shown while audible with subtitles off";
    if (!audible && !captionVisible()) return `stage ${c.stage}: captions hidden although nothing is audible`;

    // A settings change while the voice plays: gain follows, or everything stops when disabled.
    if (playing) {
      const second: VoiceSettings = { ...c.settings, ...c.second };
      player.configure(second);
      const live = port.playbacks.filter((p) => p.live);
      if (isDisabled(second)) {
        if (live.length !== 0) return "a handle is live after sound was switched off or the volume set to 0";
        if (player.getSnapshot().audible) return "audible after sound was switched off or the volume set to 0";
      } else {
        const gain2 = expectedGain(second, c.muted);
        if (live.length !== 1) return `${live.length} live handles after a volume change`;
        if (live[0].gain !== gain2) return `gain after change ${live[0].gain}, expected ${gain2}`;
        if (player.getSnapshot().audible !== gain2 > 0) return "audible flag does not follow the new gain";
      }
      const audible2 = !isDisabled(second) && expectedGain(second, c.muted) > 0;
      if (!c.subtitlesEnabled && audible2 && (!player.getSnapshot().audible || captionVisible())) {
        return "caption visibility inconsistent after a volume change";
      }
    }
    return null;
  } catch (error) {
    return `threw: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    player.dispose();
  }
}

describe("voice player failure and audibility properties", () => {
  // Feature: chapter-01-voice-narrative, Property 12: Failures fall back to captions and are logged once
  it(
    "falls back to captions on any load or resume failure and logs each clip at most once",
    async () => {
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(SEED_P12, index);
        const { steps, failCount } = generateSteps(seed);
        const refused = createLcg(seed ^ 0x5bd1e995)() < 0.3;
        if ((await runFailureCase(steps, failCount, refused)) === null) continue;

        // Shortest failing prefix, found by re-running prefixes of the failing sequence.
        let shortest = steps.length;
        for (let length = 0; length <= steps.length; length += 1) {
          if ((await runFailureCase(steps.slice(0, length), failCount, refused)) !== null) {
            shortest = length;
            break;
          }
        }
        const prefix = steps.slice(0, shortest);
        const violation = await runFailureCase(prefix, failCount, refused);
        expect.fail(
          `Property 12 failed. seed=${seed} case=${index} failCount=${failCount} resumeRefusedAtStart=${refused}\n` +
            `shortest failing prefix (${prefix.length} steps): ${JSON.stringify(prefix)}\n${violation ?? ""}`,
        );
      }
    },
    PROPERTY_TIMEOUT_MS,
  );

  // Feature: chapter-01-voice-narrative, Property 13: Audibility, gain and caption visibility are consistent
  it(
    "keeps gain, playback start, caption visibility and the phone filter consistent with the settings",
    async () => {
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(SEED_P13, index);
        const c = generateAudibilityCase(seed);
        const violation = await runAudibilityCase(c);
        if (violation !== null) {
          expect.fail(`Property 13 failed. seed=${seed} case=${index}\ncase: ${JSON.stringify(c)}\n${violation}`);
        }
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
