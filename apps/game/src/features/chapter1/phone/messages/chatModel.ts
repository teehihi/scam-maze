// What a chat looks like, derived from a device item: the bubbles, the replies the player can send
// now, and the list preview. Pure TypeScript. It shows only what has happened: the lines of the
// actions that were done, never the answer of an action that was not done yet.
import { clockAtMinute } from "../../../../game/narrative/device";
import type { DeviceActionView, DeviceItemView } from "../../../../game/narrative/device";

export interface Bubble {
  key: string;
  /** `in` is the other side, `out` is Alex. */
  side: "in" | "out";
  text: string;
  atMinute: number;
  /** Key of the conversation line (it can have a voice), or null for the opening message. */
  lineKey: string | null;
  /** Stable recorded voice ID, when the scenario authors one. */
  voiceId?: string;
}

/** The opening message of the other side, then the lines of the actions that were done, in order. */
export function threadBubbles(item: DeviceItemView, visibleLines: number = item.conversation.length): Bubble[] {
  const bubbles: Bubble[] = [{ key: `${item.id}/opening`, side: "in", text: item.body, atMinute: item.arrivedAtMinute, lineKey: null }];
  item.conversation.slice(0, visibleLines).forEach((line) => {
    bubbles.push({ key: line.key, side: line.speaker === "alex" ? "out" : "in", text: line.text, atMinute: line.atMinute, lineKey: line.key, voiceId: line.voiceId });
  });
  return bubbles;
}

/** Actions that send a message: the replies. Replies that are already done are in the thread, not offered again. */
export function replyActions(item: DeviceItemView): DeviceActionView[] {
  return item.actions.filter((action) => action.speaks && action.blocked !== "done");
}

/** Actions that do something else (open a page, save a record). */
export function otherActions(item: DeviceItemView): DeviceActionView[] {
  return item.actions.filter((action) => !action.speaks);
}

/** The last time anything happened in the chat, for sorting the list. */
export function lastActivity(item: DeviceItemView): number {
  return item.conversation.reduce((latest, line) => Math.max(latest, line.atMinute), item.arrivedAtMinute);
}

/** "08:05" for a minute of the chapter. */
export function clockLabel(minutes: number): string {
  const { hour, minute } = clockAtMinute(minutes);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** ISO weekday (1 to 7) of a minute of the chapter, for the day dividers. */
export function weekdayOf(minutes: number): number {
  return clockAtMinute(minutes).isoWeekday;
}

/** The chats, the most recent first. Equal times keep the order of the scenario. */
export function sortChats(items: readonly DeviceItemView[]): DeviceItemView[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => lastActivity(b.item) - lastActivity(a.item) || a.index - b.index)
    .map((entry) => entry.item);
}
