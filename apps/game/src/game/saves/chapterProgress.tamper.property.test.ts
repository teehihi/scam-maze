import { describe, expect, it } from "vitest";
import { getChapter } from "../chapters/chapterRegistry";
import { restoreChapterSession } from "../chapters/chapterSession";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import {
  CLAIM_IDS,
  DECISION_IDS,
  EVIDENCE_IDS,
  INTERACTABLE_IDS,
  NPC_IDS,
  OBJECTIVE_IDS,
  VERIFY_METHODS,
} from "../narrative/chapter1/ids";
import type { CoreAction } from "../narrative/types";
import {
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  MALFORMED_ACTIONS,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { encodeProgress, restoreProgress } from "./chapterProgress";
import { SAVE_FORMAT_VERSION_V2, SAVE_MAX_ACTIONS, parseSaveEnvelopeV2, type SavedPlayerPose } from "./saveGame";

/** Number of tampered saves that must be checked (design: at least 100). */
const TAMPER_RUNS = 200;
/** Upper bound on generation attempts, so a run of still-valid tampers cannot loop forever. */
const MAX_ATTEMPTS = TAMPER_RUNS * 20;
const SEED = (CORE_PROPERTY_SEED ^ 0x5a7e0013) >>> 0;

const CHAPTER_ID = "chapter-1";

/** Every authored option ID across all graphs, plus one that exists nowhere. */
const OPTION_IDS: readonly string[] = [
  ...Object.values(CHAPTER_1_SCENARIO.dialogues).flatMap((graph) =>
    Object.values(graph.nodes).flatMap((node) => node.options.map((option) => option.id)),
  ),
  "opt.does-not-exist",
];

/** Every well-formed Core_Action with known IDs. The reducer rejects some of them in any state. */
const WELL_FORMED_POOL: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "OPEN_PHONE" },
  { type: "CLOSE_PHONE" },
  { type: "ANSWER_CALL" },
  { type: "END_CALL" },
  { type: "FINISH_CHAPTER" },
  ...INTERACTABLE_IDS.map((objectId): CoreAction => ({ type: "INTERACT_OBJECT", objectId })),
  ...EVIDENCE_IDS.map((evidenceId): CoreAction => ({ type: "INSPECT_EVIDENCE", evidenceId })),
  ...NPC_IDS.map((npcId): CoreAction => ({ type: "TALK_TO_NPC", npcId })),
  ...OPTION_IDS.map((optionId): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId })),
  ...CLAIM_IDS.flatMap((claimId) =>
    VERIFY_METHODS.map((method): CoreAction => ({ type: "VERIFY_CLAIM", claimId, method })),
  ),
  ...DECISION_IDS.map((decision): CoreAction => ({ type: "MAKE_DECISION", decision })),
  ...OBJECTIVE_IDS.map((objectiveId): CoreAction => ({ type: "COMPLETE_OBJECTIVE", objectiveId })),
  ...(["call.scam-1", "call.callback"] as const).flatMap((callId) =>
    (["first-interaction", "exploration-timer", "re-ring", "callback"] as const).map(
      (reason): CoreAction => ({ type: "RING_CALL", callId, reason }),
    ),
  ),
];

/** Core_Actions that can be accepted at most once in a row (or once per chapter). */
const NON_REPEATABLE = new Set(["START_CHAPTER", "ANSWER_CALL", "FINISH_CHAPTER", "MAKE_DECISION"]);

const TAMPER_KINDS = [
  "insert-rejected",
  "duplicate-non-repeatable",
  "reorder",
  "non-finite-pose",
  "exceed-cap",
  "malformed-action",
  "wrong-version",
  "wrong-chapter",
] as const;
type TamperKind = (typeof TAMPER_KINDS)[number];

type Envelope = Record<string, unknown> & { progress: Record<string, unknown> & { actions: unknown[] } };

interface ValidSave {
  envelope: Envelope;
  /** Accepted actions of the source run; `states[i]` is the state before `actions[i]`. */
  actions: CoreAction[];
  states: ReturnType<typeof runSequence>["states"];
}

/** Builds a valid version 2 envelope from a random run, via `encodeProgress`. */
function generateValidSave(next: () => number): ValidSave {
  const raw = generateActionSequence(Math.floor(next() * 0x1_0000_0000), randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH));
  const run = runSequence(raw);
  const pose: SavedPlayerPose | null =
    next() < 0.3
      ? null
      : {
          position: [randomInt(next, 150, 230), randomInt(next, -100, -80), randomInt(next, -120, -60)],
          yaw: (next() - 0.5) * 2 * Math.PI,
        };
  const progress = encodeProgress(run.final, pose, pick(next, ["start", "debrief", ...OBJECTIVE_IDS]));
  if (progress === null) throw new Error("encodeProgress returned null for a run below the action cap.");
  const actions = progress.actions;
  return {
    envelope: {
      formatVersion: SAVE_FORMAT_VERSION_V2,
      chapterId: CHAPTER_ID,
      sceneId: pick(next, ["apartment", "street"] as const),
      savedAt: new Date(Date.UTC(2026, 10, randomInt(next, 1, 28))).toISOString(),
      progress: { ...progress, actions: [...actions] },
    },
    actions,
    states: runSequence(actions).states,
  };
}

type Verdict = { ok: true } | { ok: false; stage: string; reason: string };

/** The loader's continue path: structural parse, chapter lookup, session check, replay. */
function validateSave(raw: unknown): Verdict {
  const parsed = parseSaveEnvelopeV2(raw);
  if (parsed.status !== "valid") return { ok: false, stage: "parse", reason: parsed.reason };
  const chapter = getChapter(parsed.save.chapterId);
  if (!chapter) return { ok: false, stage: "chapter", reason: "unknown chapter" };
  const session = restoreChapterSession(chapter, parsed.save);
  if (!session.ok) return { ok: false, stage: "session", reason: session.reason };
  const replayed = restoreProgress(parsed.save.progress);
  if (!replayed.ok) return { ok: false, stage: "replay", reason: replayed.reason };
  return { ok: true };
}

/** True when replaying `actions` from the initial state rejects at least one of them. */
function replayRejects(actions: readonly unknown[]): boolean {
  return runSequence(actions).results.some((result) => !result.accepted);
}

function withActions(save: ValidSave, actions: unknown[]): Envelope {
  return { ...save.envelope, progress: { ...save.envelope.progress, actions } };
}

/**
 * Applies one tamper. Returns `null` when this tamper cannot apply to this save, or when the
 * replay shows the tampered action list is still fully accepted (the caller regenerates).
 */
function tamper(kind: TamperKind, save: ValidSave, next: () => number): Envelope | null {
  const { actions, states } = save;
  switch (kind) {
    case "insert-rejected": {
      const index = randomInt(next, 0, actions.length);
      const rejected = WELL_FORMED_POOL.filter(
        (action) => !runSequence([action], states[index]).results[0].accepted,
      );
      if (rejected.length === 0) return null;
      const tampered = [...actions.slice(0, index), pick(next, rejected), ...actions.slice(index)];
      return replayRejects(tampered) ? withActions(save, tampered) : null;
    }
    case "duplicate-non-repeatable": {
      const indices = actions.flatMap((action, index) => (NON_REPEATABLE.has(action.type) ? [index] : []));
      const tampered =
        indices.length > 0
          ? (() => {
              const index = pick(next, indices);
              return [...actions.slice(0, index + 1), actions[index], ...actions.slice(index + 1)];
            })()
          : [...actions, { type: "START_CHAPTER" }];
      return replayRejects(tampered) ? withActions(save, tampered) : null;
    }
    case "reorder": {
      if (actions.length < 2) return null;
      const i = randomInt(next, 0, actions.length - 2);
      const j = randomInt(next, i + 1, actions.length - 1);
      const tampered = [...actions];
      [tampered[i], tampered[j]] = [tampered[j], tampered[i]];
      return replayRejects(tampered) ? withActions(save, tampered) : null;
    }
    case "non-finite-pose": {
      const bad = pick(next, [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);
      const position: [number, number, number] = [188.6, -92.7, -88.89];
      let yaw = Math.PI;
      const slot = randomInt(next, 0, 3);
      if (slot === 3) yaw = bad;
      else position[slot] = bad;
      return { ...save.envelope, progress: { ...save.envelope.progress, playerPose: { position, yaw } } };
    }
    case "exceed-cap": {
      const filler: CoreAction[] = Array.from({ length: SAVE_MAX_ACTIONS + 1 - actions.length + randomInt(next, 0, 5) }, () => ({
        type: "OPEN_PHONE",
      }));
      return withActions(save, [...actions, ...filler]);
    }
    case "malformed-action": {
      const index = randomInt(next, 0, actions.length);
      return withActions(save, [...actions.slice(0, index), pick(next, MALFORMED_ACTIONS), ...actions.slice(index)]);
    }
    case "wrong-version":
      return { ...save.envelope, formatVersion: pick(next, [0, 1, 3, 2.5, "2", null, undefined]) };
    case "wrong-chapter":
      return { ...save.envelope, chapterId: pick(next, ["chapter-2", "chapter-01", "CHAPTER-1", "", " chapter-1", 1, null]) };
  }
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("chapter progress saves", () => {
  it("rejects tampered saves without throwing", () => {
    // Feature: chapter-01-the-urgent-call, Property 13: Tampered saves are rejected
    // **Validates: Requirements 15.6**
    const next = createLcg(SEED);
    const counts = Object.fromEntries(TAMPER_KINDS.map((kind) => [kind, 0])) as Record<TamperKind, number>;
    let checked = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && checked < TAMPER_RUNS; attempt += 1) {
      const caseNext = createLcg(caseSeed(Math.floor(next() * 0x1_0000_0000), attempt));
      const save = generateValidSave(caseNext);

      // The untampered save must pass, so any rejection below is caused by the tamper.
      expect(validateSave(save.envelope), `attempt ${attempt}: untampered save`).toEqual({ ok: true });

      const kind = TAMPER_KINDS[checked % TAMPER_KINDS.length];
      const tampered = tamper(kind, save, caseNext);
      if (tampered === null) continue;

      let verdict: Verdict;
      try {
        verdict = validateSave(tampered);
      } catch (error) {
        throw new Error(`attempt ${attempt} (${kind}) threw: ${String(error)}`);
      }
      expect(
        verdict.ok,
        `attempt ${attempt} (${kind}) was accepted: ${describeAction(tampered.progress.actions)}`,
      ).toBe(false);
      counts[kind] += 1;
      checked += 1;
    }

    expect(checked).toBeGreaterThanOrEqual(TAMPER_RUNS);
    for (const kind of TAMPER_KINDS) expect(counts[kind], kind).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});
