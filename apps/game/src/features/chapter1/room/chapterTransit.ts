// Chapter 1 owns the ledger and story clock. The world controller owns movement and stops.
import type { ChapterStore } from "../../../game/narrative/store";
import type { ScenarioDefinition } from "../../../game/narrative/types";
import { elapsedMinutes } from "../../../game/narrative/world";
import { ROUTE } from "../../testbus/openworld/simulation/transit";
import type { RoomStoryHandlers } from "./roomStoryBridge";

export function chapterTransit(store: ChapterStore, scenario: ScenarioDefinition, setMoving: (moving: boolean) => void): Pick<
  RoomStoryHandlers, "transitSeconds" | "transitBalance" | "transitDebit" | "onTransit"
> {
  return {
    transitSeconds: () => elapsedMinutes(store.getState(), scenario) * 60,
    transitBalance: () => store.getState().resources.cash,
    transitDebit(amount) {
      if (amount !== ROUTE.fare || store.getState().status !== "playing") return false;
      // If the fare was already bought via the map, do not debit again at the physical validator.
      const ticket = store.getState().device.items["travel.bus06"];
      if (ticket?.done.includes("pay-fare")) return true;
      return store.dispatch({ type: "USE_DEVICE_ITEM", itemId: "travel.bus06", actionId: "pay-fare" }).accepted;
    },
    onTransit(event) {
      if (event.type === "departed") setMoving(true);
      if (event.type === "arrived") setMoving(false);
      // The same action as the non-WebGL fallback carries all 34 story minutes and records arrival.
      // The ambient clock does not tick while the bus is driving.
      if (event.type === "transfer-complete" && store.getState().status === "playing") {
        store.dispatch({ type: "USE_DEVICE_ITEM", itemId: "travel.bus06", actionId: "arrive" });
      }
    },
  };
}
