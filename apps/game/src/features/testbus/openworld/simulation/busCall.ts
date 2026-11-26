// When the staged Chapter 1 Bus 06 is called in, and how long its drive into the stop takes. Pure data.
//
// The bus waits up the road (BusRouteController.stageAway) instead of standing at the stop from the first frame. It is
// called in when:
//   driver-declined  Alex turns the street driver down for Bus 06: it comes into view and pulls in during his goodbye
//                    line, which lasts a few seconds in either language (with or without a recording), so the drive is
//                    long enough to still be on its way while he speaks and short enough to stop soon after.
//   asked            Alex presses E at the stop ("wait for the bus").
//   waited           Alex simply stands at the stop for BUS_WAIT_SECONDS, ignoring the driver.
// The first bus is only called once Alex has met the street driver (the xe om), or after BUS_DRIVER_GRACE_SECONDS at
// the stop if the driver never comes up. At the stop the bus holds its doors while Alex is at them or aboard; if he is
// elsewhere it leaves after ROUTE.dwellSeconds and the next one follows the 15 minute timetable (missing it means
// waiting, never a dead end).

export type BusCallReason = "driver-declined" | "asked" | "waited";

/** Seconds from the bus appearing up the road to its halt at the stop (ease-out: it slows down progressively). */
export const BUS_CALL_SECONDS: Readonly<Record<BusCallReason, number>> = {
  "driver-declined": 9,
  asked: 7,
  waited: 8,
};

/** The reply in the driver's conversation that turns his offer down for Bus 06 (stable ID, see storyCast.ts). */
export const BUS_DECLINE_REPLY_ID = "driver_wait_bus";

/** The waiting area of the Lý Thái Tổ Bus 06 stop (world x/z) and how close counts as waiting there. */
export const BUS_STOP_CENTER = { x: 1.6, z: -2 } as const;
export const BUS_STOP_WAIT_RADIUS = 9;

/** Standing at the stop this long (on foot, not talking) brings the next bus in by itself. */
export const BUS_WAIT_SECONDS = 20;

/**
 * The first Bus 06 waits until Alex has met the street driver (the xe om). If the driver never comes up, the bus is let in
 * after this many seconds at the stop, so the story cannot stall.
 */
export const BUS_DRIVER_GRACE_SECONDS = 60;
