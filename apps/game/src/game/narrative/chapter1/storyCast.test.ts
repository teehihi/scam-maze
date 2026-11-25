import { describe, expect, it } from "vitest";
import {
  OPEN_WORLD_STORY_NPCS,
  resolveNpcSchedule,
  resolveStoryNpcDialogue,
  STORY_NPC_CAST,
} from "./storyCast";

describe("Chapter 1 canonical 5-mission Story NPC system", () => {
  it("defines the full 10-character canonical cast spanning Missions 01 through 05", () => {
    expect(STORY_NPC_CAST.length).toBe(10);
    const coveredMissions = new Set(STORY_NPC_CAST.flatMap((npc) => npc.missions));
    expect([...coveredMissions].sort()).toEqual([1, 2, 3, 4, 5]);
    // Cô Ba is physical too: the Mission 02 interview happens in Chợ Lớn, not on the phone.
    expect(OPEN_WORLD_STORY_NPCS.length).toBe(7);
  });

  it("stages every Open World Story NPC at collision-free physical Saigon anchors with props", () => {
    // Verify each NPC has a physical propKind, staging cue, and stays clear of other Story NPCs & street props
    for (let i = 0; i < OPEN_WORLD_STORY_NPCS.length; i++) {
      const a = OPEN_WORLD_STORY_NPCS[i];
      expect(a.worldAnchor).toBeDefined();
      expect(a.worldAnchor!.propKind).toBeTruthy();
      expect(a.worldAnchor!.stagingCue.vi.length).toBeGreaterThan(5);
      expect(a.worldAnchor!.stagingCue.en.length).toBeGreaterThan(5);

      for (let j = i + 1; j < OPEN_WORLD_STORY_NPCS.length; j++) {
        const b = OPEN_WORLD_STORY_NPCS[j];
        const dist = Math.hypot(
          a.worldAnchor!.x - b.worldAnchor!.x,
          a.worldAnchor!.z - b.worldAnchor!.z,
        );
        expect(dist).toBeGreaterThan(4.0);
      }

      // Ensure no Story NPC clips into banhmi-vendor (4.2, -17) or courtyard table (29.8, -10)
      expect(Math.hypot(a.worldAnchor!.x - 4.2, a.worldAnchor!.z + 17)).toBeGreaterThan(1.5);
      expect(Math.hypot(a.worldAnchor!.x - 29.8, a.worldAnchor!.z + 10)).toBeGreaterThan(2.0);
    }
  });

  it("resolves valid 72-hour schedules for every Story NPC", () => {
    for (const npc of STORY_NPC_CAST) {
      const slot = resolveNpcSchedule(npc.id, 60);
      expect(slot).not.toBeNull();
      expect(slot!.location.en.length).toBeGreaterThan(0);
      expect(slot!.location.vi.length).toBeGreaterThan(0);
    }
  });

  it("provides GTA-6/RDR2 ambient barks & interactive branching replies adapted to live flags", () => {
    const baseCtx = {
      elapsedMinutes: 60,
      thesisProgress: 65,
      fatigue: 25,
      money: 3_500_000,
      flags: { minhTrustsAlex: true },
    };

    for (const npc of OPEN_WORLD_STORY_NPCS) {
      const turn = resolveStoryNpcDialogue(npc.id, baseCtx);
      expect(turn.ambientBark.vi.length).toBeGreaterThan(10);
      expect(turn.ambientBark.en.length).toBeGreaterThan(10);
      expect(turn.replies.length).toBeGreaterThanOrEqual(3);
      for (const reply of turn.replies) {
        expect(reply.label.vi.length).toBeGreaterThan(3);
        expect(reply.response.vi.length).toBeGreaterThan(10);
      }
    }

    const minhDefault = resolveStoryNpcDialogue("minh", baseCtx);
    const minhCompromised = resolveStoryNpcDialogue("minh", {
      ...baseCtx,
      flags: { ...baseCtx.flags, accountCompromised: true },
    });
    const minhFinished = resolveStoryNpcDialogue("minh", {
      ...baseCtx,
      thesisProgress: 100,
      flags: { ...baseCtx.flags, draftFinished: true },
    });

    expect(minhCompromised.mood).toBe("urgent");
    expect(minhCompromised.lines[0].vi).not.toBe(minhDefault.lines[0].vi);
    expect(minhFinished.missionBadge).toContain("M02");

    const linhScammed = resolveStoryNpcDialogue("linh", {
      ...baseCtx,
      flags: { easyMoneyDeposited: true },
    });
    expect(linhScammed.mood).toBe("guarded");

    const hungLocked = resolveStoryNpcDialogue("hung", {
      ...baseCtx,
      flags: { investmentFundsLocked: true },
    });
    expect(hungLocked.mood).toBe("defensive");
  });

  it("gives Cô Ba a reachable physical dialogue for every interview state", () => {
    const baseCtx = {
      elapsedMinutes: 1120,
      thesisProgress: 65,
      fatigue: 25,
      money: 3_500_000,
      flags: {},
    };
    const states = [
      {},
      { interviewArrived: true },
      { interviewArrived: true, interviewStarted: true },
      { interviewArrived: true, interviewMissed: true },
      { interviewArrived: true, interviewRescheduled: true },
      { interviewArrived: true, interviewCompleted: true },
    ];
    const seenBadges = new Set<string>();
    for (const flags of states) {
      const turn = resolveStoryNpcDialogue("interviewee_q5", { ...baseCtx, flags });
      expect(turn.replies.length).toBeGreaterThanOrEqual(3);
      expect(turn.openingVoiceId).toMatch(/^m02\.coba\./);
      for (const reply of turn.replies) {
        expect(reply.voiceId, reply.id).toMatch(/^m02\.coba\./);
        expect(reply.labelVoiceId, reply.id).toMatch(/^m02\.coba\./);
        expect(reply.response.en.length, reply.id).toBeGreaterThan(10);
        expect(reply.response.vi.length, reply.id).toBeGreaterThan(10);
      }
      seenBadges.add(turn.missionBadge);
    }
    expect([...seenBadges].sort()).toEqual([
      "M02 · INTERVIEW",
      "M02 · INTERVIEW DONE",
      "M02 · MARKET OFFICE",
      "M02 · MISSED APPOINTMENT",
      "M02 · RESCHEDULED INTERVIEW",
    ]);
  });

  it("keeps the interview unfinished from every dialogue branch without a reducer action", () => {
    // The dialogue is presentation; only the deterministic device actions change story state.
    const turn = resolveStoryNpcDialogue("interviewee_q5", {
      elapsedMinutes: 1120,
      thesisProgress: 65,
      fatigue: 25,
      money: 3_500_000,
      flags: { interviewArrived: true, interviewStarted: true },
    });
    expect(turn.replies.map((reply) => reply.id)).toContain("coba_transfer_check");
    expect(turn.missionBadge).toBe("M02 · INTERVIEW");
  });
});
