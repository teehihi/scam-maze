// Mission steps of Mission 01: the concrete "what to do next" of the task tracker and list. Steps
// only read state; the mission still completes on its own conditions. Uses the real scenario.
import { describe, expect, it, vi } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { localizeScenario, narrativeTextEntries } from "../narrative/localize";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../narrative/types";
import { selectClosedMissions, selectOpenMissions, validateWorldContent } from "../narrative/world";
import { LAST_SUBMISSION_NARRATIVE_VI } from "../../i18n/narrative/lastSubmission.vi";

// The suite-wide setup replaces the Vietnamese overlay with a fixture; this file checks the real one.
vi.mock("../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const S = LAST_SUBMISSION_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const task = (taskId: string): CoreAction => ({ type: "COMPLETE_THESIS_TASK", taskId });

function run(actions: CoreAction[], scenario: ScenarioDefinition = S): ChapterState {
  return actions.reduce((state, action) => {
    const result = chapterReducer(state, action, scenario);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, createInitialState(scenario));
}
const main = (state: ChapterState, scenario: ScenarioDefinition = S) => {
  const view = selectOpenMissions(state, scenario).find((mission) => mission.id === "m01.missing-access");
  if (!view) throw new Error("Mission 01 is not open");
  return view;
};

describe("Mission 01 steps", () => {
  it("are valid content", () => {
    expect(validateWorldContent(S)).toEqual([]);
  });

  it("start on the laptop's thesis and bring the email in as the current step when it arrives", () => {
    let state = run([START]);
    expect(main(state).steps.map((step) => step.id)).toEqual(["write"]);
    expect(main(state).current).toMatchObject({ id: "write", label: "Type two sentences of your thesis", target: "laptop", app: "thesis", done: false });

    state = run([START, advance(10)]);
    expect(main(state).current).toMatchObject({ id: "read-mail", target: "laptop", app: "mail" });

    // Reading it adds the optional access check and goes back to the draft. Ignoring the question stays possible.
    state = run([START, advance(10), open("mail.clearance")]);
    const view = main(state);
    expect(view.steps.map((step) => [step.id, step.done, step.optional])).toEqual([
      ["read-mail", true, false],
      ["confirm-access", false, true],
      ["write", false, false],
    ]);
    expect(view.current?.id).toBe("write");
  });

  it("follow the thesis tasks and move the mission to completed", () => {
    const base = [START, advance(10), open("mail.clearance")];
    expect(main(run(base)).current?.id).toBe("write");
    const state = run([...base, task("draft.final")]);
    expect(selectOpenMissions(state, S).some((mission) => mission.id === "m01.missing-access")).toBe(false);
    expect(selectClosedMissions(state, S)).toContainEqual({ id: "m01.missing-access", title: "THE MISSING ACCESS", optional: false, status: "completed" });
  });

  it("put securing the accounts first after the student login was given", () => {
    const state = run([START, advance(10), open("mail.clearance"), use("mail.clearance", "open-link"), use("page.fee", "sign-in")]);
    expect(main(state).path).toBe("breach");
    expect(main(state).current).toMatchObject({ id: "passwords", target: "laptop", app: "files" });
    const breach = selectOpenMissions(state, S).find((mission) => mission.id === "m01.security-breach");
    expect(breach?.current?.id).toBe("passwords");
  });

  it("have Vietnamese labels for every step", () => {
    const keys = narrativeTextEntries(S, {} as Parameters<typeof narrativeTextEntries>[1]).map(({ key }) => key).filter((key) => key.includes("/steps/"));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(LAST_SUBMISSION_NARRATIVE_VI[key], key).toBeTruthy();
    const vi = localizeScenario(S, LAST_SUBMISSION_NARRATIVE_VI);
    expect(main(run([START], vi), vi).current?.label).toBe("Gõ 2 câu khóa luận");
  });
});
