import { describe, expect, it, vi } from "vitest";
import { BusRouteController, ROUTE } from "../../testbus/openworld/simulation/transit";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { MISSION_02_CONFIG } from "../../../game/narrative/chapter1/mission02";
import { PARCEL_CONFIG } from "../../../game/narrative/chapter1/parcel";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore } from "../../../game/narrative/store";
import { RoomStoryBridge } from "./roomStoryBridge";
import { chapterTransit } from "./chapterTransit";

describe("Chapter 1, Route 06 and the optional parcel", () => {
  it.each([false, true])("allows the interview without meeting Long (parcel: %s)", (parcel) => {
    const scenario = LAST_SUBMISSION_SCENARIO;
    const store = createChapterStore(createInitialState(scenario), scenario);
    const start = store.dispatch({ type: "START_CHAPTER" });
    expect(start.accepted).toBe(true);
    const use = (itemId: string, actionId: string) => {
      const result = store.dispatch({ type: "USE_DEVICE_ITEM", itemId, actionId });
      expect(result.accepted, result.reason ?? "").toBe(true);
    };
    const bridge = new RoomStoryBridge();
    const moving = vi.fn();
    bridge.attach(chapterTransit(store, scenario, moving));
    const route = new BusRouteController({ ...bridge.transitHost, onEvent: (event) => bridge.transit(event) });
    const advance = (minutes: number) => { const outcome = store.dispatch({type: "ADVANCE_TIME", minutes}); expect(outcome.accepted, `advance ${minutes}: ${outcome.reason}`).toBe(true); };
    advance(PARCEL_CONFIG.opensAtMinute - 5);
    expect(store.getState().device.items["msg.parcel-fee"]).toBeUndefined();
    const rideAt = MISSION_02_CONFIG.opensAtMinute + 20;
    if (parcel) {
      advance(12);
      use("msg.parcel-fee", "read");
      use("app.courier", "lookup-by-phone");
    }
    advance(rideAt - bridge.transitHost.chapterSeconds()! / 60);
    use("contact.coba", "confirm");
    expect(store.getState().persistent.parcelAtCounter).toBe(parcel);
    expect(store.getState().persistent.rideVerifiedIndependently).toBe(true);
    const beforeCash = store.getState().resources.cash;
    const beforeTime = store.getState().resources.timeMinutes;
    const dt = 0.1;
    const tick = (steps: number) => {
      for (let i = 0; i < steps; ++i) route.update(dt, { front: false, rear: false }, false);
    };
    expect(route.wait()).toBe(true);
    advance(ROUTE.waitMinutes - 1);
    tick(100);
    expect(route.z).toBe(ROUTE.approachZ);
    advance(1);
    tick(100);
    expect(route.phase).toBe("boarding");
    expect(route.pay(false)).toBe(false);
    expect(route.toggleDoor("front", false)).toBe(true);
    tick(10);
    expect(route.doors.front.passable).toBe(true);
    route.passengerCrossed(true);
    expect(route.pay(true)).toBe(true);
    expect(route.pay(true)).toBe(true);
    expect(route.depart(true, false)).toBe(true);
    tick(400);
    expect(route.phase).toBe("arrived");
    expect(route.x).toBe(ROUTE.curbX);
    expect(route.z).toBe(ROUTE.destinationZ);
    expect(moving.mock.calls).toEqual([[true], [false]]);
    route.passengerCrossed(false, true);
    route.reachSidewalk();
    expect(store.getState().resources.cash).toBe(beforeCash - ROUTE.fare);
    expect(store.getState().resources.timeMinutes).toBe(beforeTime - ROUTE.waitMinutes - ROUTE.rideMinutes);
    expect(store.getState().device.ledger.filter((entry) => entry.counterparty === "Bus 06")).toHaveLength(1);
    expect(store.getState().persistent.interviewArrived).toBe(true);
    use("interview.coba", "start");
    use("interview.coba", "ask-transfer");
    expect(store.getState().persistent.interviewCompleted).toBe(true);
  });
});
