import { BUS06_CURB_LAT, BusCircuit } from '../traffic/busCircuit';
import { SaigonRoadGraph } from '../traffic/roadGraph';

export const ROUTE = {
  number: '06',
  origin: 'Lý Thái Tổ',
  via: 'Châu Văn Liêm',
  destination: 'Chợ Lớn',
  fare: 7000,
  initialCash: 50000,
  start: 8 * 3600,
  deadline: 11 * 3600 + 30 * 60,
  waitMinutes: 4,
  rideMinutes: 34,
  originZ: 0,
  viaZ: -66,
  destinationZ: -128,
  approachZ: 31,
  curbX: -2.3,
  /** Scheduled arrivals at Trạm Lý Thái Tổ, in game minutes. A bus that is missed is followed by the next one. */
  headwayMinutes: 15,
  /** The bus finishes its lap and waits out of sight this far up the road (z) until its next arrival is due. */
  layoverZ: 44,
  /**
   * Game seconds that pass on the timetable per real second while the bus circulates or the player waits. A lap of the
   * map takes about four real minutes, so the bus is back up the road before its next 15 minute slot.
   */
  timetableRate: 3,
  /** Real seconds the timetabled bus takes from coming into view up the road to its halt at the stop. */
  scheduledApproachSeconds: 8,
  /** Seconds a bus stands at the stop with its doors open before it leaves without a passenger. */
  dwellSeconds: 25,
  /** Seconds the bus stands at Trạm Chợ Lớn after the passenger got off before it drives on around the loop. */
  terminusLingerSeconds: 6,
  cruiseSpeed: 8.5,
  accel: 1.6,
  /** Planned braking rate (m/s^2) for stops and junction arcs. */
  brake: 2.1,
} as const;

export type Phase = 'waiting' | 'approaching' | 'boarding' | 'departing' | 'driving' | 'arrived' | 'complete';
export type DoorId = 'front' | 'rear';
export type TransitEvent = {
  type: 'wait-started' | 'bus-at-stop' | 'boarded' | 'left-bus' | 'fare-paid' | 'departed' | 'passed-stop' | 'arrived' | 'transfer-complete' | 'left-empty';
  at: number;
  route: string;
  stop?: string;
  amount?: number;
  onTime?: boolean;
};

export interface TransitHost {
  clock?: { read: () => number; advance: (seconds: number) => void };
  wallet?: { read: () => number; debit: (amount: number) => boolean };
  onEvent?: (event: TransitEvent) => void;
  chapterSeconds?: () => number | undefined;
  /** The road-graph circuit the bus drives (defaults to the shared Bus 06 circuit). */
  circuit?: BusCircuit;
}

export interface BusUpdateOptions {
  /** Lateral offset (m, + = right) the traffic planner wants for the bus this frame (weaving, grabbing a lane). */
  lat?: number;
  /** Something keeps the bus at the stop: the passenger is aboard, a conversation is open or Alex stands at the doors. */
  hold?: boolean;
}

let sharedCircuit: BusCircuit | undefined;
/** The Bus 06 circuit of the default road graph (built once, the graph is immutable). */
export function defaultBusCircuit(): BusCircuit {
  sharedCircuit ??= new BusCircuit(new SaigonRoadGraph());
  return sharedCircuit;
}

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
export const formatCash = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const smooth = (n: number) => n * n * (3 - 2 * n);
export const damp = (n: number, target: number, speed: number, dt: number) => n + (target - n) * (1 - Math.exp(-speed * dt));

export class BusDoorController {
  amount = 0;
  target = 0;

  get passable() { return this.amount >= 0.93; }
  get sealed() { return this.amount === 0; }

  step(dt: number, obstructed: boolean) {
    if (obstructed && this.target === 0 && this.amount > 0) this.target = 1;
    this.amount = this.target === 1 ? Math.min(1, this.amount + dt / 0.9) : Math.max(0, this.amount - dt / 1.08);
  }
}

export class BusRouteController {
  phase: Phase = 'waiting';
  readonly doors = { front: new BusDoorController(), rear: new BusDoorController() };
  x: number = ROUTE.curbX;
  z: number = ROUTE.approachZ;
  yaw = 0;
  speed = 0;
  paid = false;
  onTime = true;
  /** 0..1 over the ride from the first stop to Trạm Chợ Lớn (1 afterwards). */
  progress = 0;
  /** Distance along the circuit (m) and the bus' current lateral offset (m, + = right). */
  d: number;
  lat: number = BUS06_CURB_LAT;
  /** Smoothed steering input (rad) for the wheel animation, from the heading change rate. */
  steer = 0;
  /** True while a passenger who paid is carried: only then the clock and the story follow the ride. */
  rideActive = false;
  private cash: number = ROUTE.initialCash;
  private seconds: number = ROUTE.start;
  /** Timetable clock (game seconds): runs at ROUTE.timetableRate, plus the ride time while a passenger rides. */
  private timetable = ROUTE.start;
  private nextBus: number;
  /** Set after the first arrival at the stop: from then on buses follow the 15 minute timetable. */
  scheduleActive = false;
  private approach = 0;
  private chapterDepartureAt: number | undefined;
  /** Where the current approach starts (z) and how long it takes at full speed (seconds). */
  private approachFrom: number = ROUTE.approachZ;
  private approachSeconds = 6.8;
  /** Staged away (`stageAway`): the bus waits up the road until it is called, it does not come on its own timer. */
  staged = false;
  private vel = 0;
  private latVel = 0;
  private lapRemaining = 0;
  private dwell = 0;
  private leaving = false;
  private leaveTimer = 0;
  private awayTimer = 0;
  private via = false;
  accel = 0;

  private host: TransitHost;
  readonly circuit: BusCircuit;
  private readonly originD: number;
  private readonly destD: number;
  constructor(host: TransitHost = {}) {
    this.host = host;
    this.circuit = host.circuit ?? defaultBusCircuit();
    this.originD = this.circuit.stopD('LTT_S_NB')!;
    this.destD = this.circuit.stopD('LTT_M2_NB')!;
    this.d = this.originD - ROUTE.approachZ;
    this.nextBus = this.clock + ROUTE.waitMinutes * 60;
  }

  get clock() { return this.host.clock?.read() ?? this.host.chapterSeconds?.() ?? this.seconds; }
  get balance() { return this.host.wallet?.read() ?? this.cash; }
  /** The timetable's "now" (game seconds): the clock, or the chapter's own timetable clock while the story clock stands still. */
  private get tt() { return this.timetable; }
  /** The timetable clock (game seconds). */
  get timetableSeconds() { return this.timetable; }
  /** Game seconds until the next scheduled arrival at the stop (0 when it is due or the bus is here). */
  get nextArrivalIn() { return Math.max(0, this.nextBus - this.tt); }

  emit(type: TransitEvent['type'], details: Partial<TransitEvent> = {}) {
    this.host.onEvent?.({ type, at: this.clock, route: ROUTE.number, ...details });
  }

  private advance(seconds: number) {
    if (this.host.clock) this.host.clock.advance(seconds);
    else this.seconds += seconds;
  }

  /** Skips the timetable (and the stand-alone clock) forward: the player chose to wait for the next bus. */
  private skip(seconds: number) {
    if (seconds <= 0) return;
    this.timetable += seconds;
    if (!this.host.chapterSeconds) this.advance(seconds);
  }

  wait() {
    if (this.phase !== 'waiting') return false;
    this.staged = false;
    const chapterNow = this.host.chapterSeconds?.();
    if (chapterNow === undefined) this.advance(Math.max(0, this.nextBus - this.clock));
    else this.chapterDepartureAt = chapterNow + ROUTE.waitMinutes * 60;
    this.phase = 'approaching';
    this.emit('wait-started', { stop: ROUTE.origin });
    return true;
  }

  /**
   * Holds the next bus out of sight up the road (`fromZ`), not at the stop. The Chapter 1 street starts this way so the
   * bus arrives in front of the player instead of standing at the stop from the first frame. It is also where a bus
   * waits after its lap until its next scheduled arrival.
   */
  stageAway(fromZ = 44) {
    if (this.phase !== 'waiting' && this.phase !== 'boarding' && this.phase !== 'driving') return false;
    this.phase = 'waiting';
    this.staged = true;
    this.approach = 0;
    this.approachFrom = fromZ;
    this.z = fromZ;
    this.x = ROUTE.curbX;
    this.yaw = 0;
    this.speed = 0;
    this.vel = 0;
    this.latVel = 0;
    this.lat = BUS06_CURB_LAT;
    this.d = this.originD - fromZ;
    this.rideActive = false;
    this.leaving = false;
    this.doors.front.target = this.doors.rear.target = 0;
    this.doors.front.amount = this.doors.rear.amount = 0;
    return true;
  }

  /**
   * Brings the staged bus in from where it waits: it drives `fromZ` → the stop in about `seconds`, slowing down to a halt
   * (the same curve as `wait`). Unlike `wait` it does not skip time: the bus is simply the next one coming. Returns false
   * when a bus is already coming, at the stop or on its way. Once the timetable is running the next bus keeps to its
   * slot: in a chapter the player has to wait for it (false until it is due), the stand-alone street skips the clock.
   */
  callBus(seconds = 6.8) {
    if (this.phase !== 'waiting') return false;
    const early = this.scheduleActive ? this.nextBus - this.leadFor(seconds) - this.tt : 0;
    if (early > 0 && this.host.chapterSeconds) return false;
    this.staged = false;
    this.chapterDepartureAt = undefined;
    this.approachSeconds = Math.max(1, seconds);
    this.approach = 0;
    this.phase = 'approaching';
    this.skip(early);
    this.emit('wait-started', { stop: ROUTE.origin });
    return true;
  }

  /** Timetable seconds an approach of `seconds` real seconds takes: the bus is called that long before its slot. */
  private leadFor(seconds: number) {
    return Math.max(1, seconds) * ROUTE.timetableRate;
  }

  /** How far the bus still is from the stop (metres), 0 once it stands there. */
  get distanceToStop() {
    return this.phase === 'waiting' || this.phase === 'approaching' ? Math.max(0, this.z) : 0;
  }

  toggleDoor(id: DoorId, blocked: boolean) {
    if (this.phase !== 'boarding' && this.phase !== 'arrived' && this.phase !== 'complete') return false;
    const door = this.doors[id];
    if (door.target && blocked) return false;
    door.target = 1 - door.target;
    return true;
  }

  pay(onboard: boolean) {
    if (!onboard || this.phase !== 'boarding') return false;
    if (this.paid) return true;
    if (this.host.wallet ? !this.host.wallet.debit(ROUTE.fare) : this.cash < ROUTE.fare) return false;
    if (!this.host.wallet) this.cash -= ROUTE.fare;
    this.paid = true;
    this.emit('fare-paid', { amount: ROUTE.fare });
    return true;
  }

  depart(onboard: boolean, obstruction: boolean) {
    if (!onboard || obstruction || !this.paid || this.phase !== 'boarding') return false;
    this.phase = 'departing';
    this.leaving = false;
    this.rideActive = true;
    this.doors.front.target = this.doors.rear.target = 0;
    return true;
  }

  /** The passenger sat down on the bus: the fare is paid and the doors close, the bus leaves at once. */
  seated(onboard: boolean, obstruction = false) {
    return this.pay(onboard) && this.depart(onboard, obstruction);
  }

  passengerCrossed(onboard: boolean, ashore = false) {
    this.emit(onboard ? 'boarded' : 'left-bus');
    if (!onboard && ashore) this.reachSidewalk();
  }

  reachSidewalk() {
    if (this.phase !== 'arrived') return;
    this.phase = 'complete';
    this.onTime = this.clock <= ROUTE.deadline;
    this.leaveTimer = ROUTE.terminusLingerSeconds;
    this.emit('transfer-complete', { stop: ROUTE.destination, onTime: this.onTime });
  }

  /** Doors shut and off around the loop again (after Chợ Lớn, or from the first stop when nobody boarded). */
  private pullAway() {
    this.phase = 'departing';
    this.leaving = true;
    this.doors.front.target = this.doors.rear.target = 0;
  }

  private startLap(fromD: number) {
    this.lapRemaining = this.circuit.wrap(this.originD - ROUTE.layoverZ - fromD);
    this.via = false;
  }

  update(dt: number, occupied: Record<DoorId, boolean>, approachBlocked: boolean, maxSafeSpeed?: number, options: BusUpdateOptions = {}) {
    const oldX = this.x;
    const oldZ = this.z;
    const oldYaw = this.yaw;
    const prevSpeed = this.speed;
    const chapterTime = this.host.chapterSeconds !== undefined;
    const riding = this.phase === 'driving' && this.rideActive;
    if (!riding) this.timetable += dt * ROUTE.timetableRate;
    if (!chapterTime && !riding) this.advance(dt * (this.phase === 'waiting' ? 12 : 5));
    if (!chapterTime && this.phase === 'waiting' && !this.staged && this.clock >= this.nextBus) this.wait();
    // Timetable: after its lap the bus waits out of sight and comes back for the next scheduled arrival.
    if (this.phase === 'waiting' && this.staged && this.scheduleActive && this.tt >= this.nextBus - this.leadFor(ROUTE.scheduledApproachSeconds)) {
      this.callBus(ROUTE.scheduledApproachSeconds);
    }
    if (this.phase === 'approaching') {
      // Chapter time: a bus asked for with `wait` leaves the previous stop after the scheduled wait of story time.
      const chapterNow = this.host.chapterSeconds?.();
      const timeToApproach = this.chapterDepartureAt === undefined || (chapterNow ?? 0) >= this.chapterDepartureAt;
      if (timeToApproach) this.chapterDepartureAt = undefined;
      const canMove = timeToApproach && !approachBlocked && (maxSafeSpeed === undefined || maxSafeSpeed > 0.35);
      if (canMove) this.approach = clamp(this.approach + dt / this.approachSeconds);
      // Ease-out: full speed at the start, slowing down progressively to a halt at the stop.
      this.z = this.approachFrom * (1 - this.approach ** 1.14 * (2 - this.approach ** 1.14));
      this.d = this.originD - this.z;
      if (this.approach >= 1) {
        this.phase = 'boarding';
        this.dwell = 0;
        // The timetable: one bus every 15 minutes. The first arrival sets the grid; a late bus does not shift it.
        if (!this.scheduleActive) this.nextBus = this.tt;
        this.scheduleActive = true;
        while (this.nextBus <= this.tt + 1) this.nextBus += ROUTE.headwayMinutes * 60;
        this.emit('bus-at-stop', { stop: ROUTE.origin });
      }
    }

    this.doors.front.step(dt, occupied.front);
    this.doors.rear.step(dt, occupied.rear);
    if (this.phase === 'boarding' && !this.paid) {
      // Nobody got on: the bus does not wait for ever, the next one follows on the timetable.
      this.dwell = options.hold || occupied.front || occupied.rear ? 0 : this.dwell + dt;
      if (this.dwell >= ROUTE.dwellSeconds) {
        this.pullAway();
        this.rideActive = false;
        this.emit('left-empty', { stop: ROUTE.origin });
      }
    }
    if (this.phase === 'complete' || (this.phase === 'arrived' && !options.hold)) {
      this.leaveTimer = this.phase === 'complete' ? this.leaveTimer - dt : this.leaveTimer;
      this.awayTimer = this.phase === 'arrived' ? this.awayTimer + dt : 0;
      if (this.leaveTimer <= 0 && this.phase === 'complete') this.pullAway();
      // Someone who left without the bus registering it must not keep the bus at the terminus for ever.
      else if (this.awayTimer > 45) this.pullAway();
    } else {
      this.awayTimer = 0;
    }
    if (this.phase === 'departing') {
      if (occupied.front || occupied.rear) {
        this.phase = 'boarding';
        this.leaving = false;
        if (occupied.front) this.doors.front.target = 1;
        if (occupied.rear) this.doors.rear.target = 1;
      } else if (this.doors.front.sealed && this.doors.rear.sealed) {
        this.phase = 'driving';
        this.vel = 0;
        if (this.leaving) {
          // Empty bus from the stop, or the bus leaving the terminus: on around the loop.
          this.startLap(this.d);
          this.leaving = false;
          this.rideActive = false;
        } else {
          this.startLap(this.originD);
          this.emit('departed', { stop: ROUTE.origin });
        }
      }
    }
    if (this.phase === 'driving') this.drive(dt, maxSafeSpeed, options.lat);
    if (this.phase === 'approaching' || this.phase === 'boarding' || this.phase === 'departing') this.parkPose();

    const moved = Math.hypot(this.x - oldX, this.z - oldZ);
    this.speed = dt > 0 ? moved / dt : 0;
    this.accel = dt > 0 ? (this.speed - prevSpeed) / dt : 0;
    const turnRate = dt > 0 ? wrapPi(this.yaw - oldYaw) / dt : 0;
    this.steer += (Math.max(-1.4, Math.min(1.4, turnRate * 1.1)) - this.steer) * Math.min(1, dt * 5);
  }

  /** At the kerb (approach, doors open, doors closing): straight along the road, exactly at the stop's position. */
  private parkPose() {
    this.lat = BUS06_CURB_LAT;
    this.latVel = 0;
    if (this.phase === 'approaching') {
      this.x = ROUTE.curbX;
      this.yaw = 0;
      return;
    }
    if (this.phase === 'boarding') this.d = this.originD;
    if (this.phase === 'boarding' || Math.abs(this.d - this.originD) < 1e-6) {
      this.x = ROUTE.curbX;
      this.z = ROUTE.originZ;
      this.yaw = 0;
    }
  }

  /** Curve limit (m/s) at distance `d`: junction arcs are taken slowly, braking for them starts in good time. */
  private curveLimit(): number {
    let limit = Infinity;
    for (const seg of this.circuit.segments) {
      if (!seg.turn || seg.turn.kind === 'straight') continue;
      const ahead = this.circuit.delta(this.d, seg.start);
      const inside = this.circuit.delta(seg.start, this.d);
      const dist = inside >= 0 && inside < seg.length ? 0 : ahead;
      if (dist < 0 || dist > 70) continue;
      const cap = seg.turn.maxSpeed * 0.85;
      limit = Math.min(limit, Math.sqrt(cap * cap + 2 * ROUTE.brake * dist));
    }
    return limit;
  }

  private drive(dt: number, maxSafeSpeed: number | undefined, wantedLat: number | undefined) {
    const rideLeg = this.rideActive && this.d < this.destD - 1e-6;
    let target: number = ROUTE.cruiseSpeed;
    target = Math.min(target, this.curveLimit());
    let remaining = Infinity;
    if (rideLeg) {
      // The passenger rides to Trạm Chợ Lớn: brake to a halt at the stop.
      remaining = this.destD - this.d;
      target = Math.min(target, remaining > 0.06 ? Math.max(0.7, Math.sqrt(2 * ROUTE.brake * remaining)) : 0);
    }
    if (maxSafeSpeed !== undefined) target = Math.min(target, maxSafeSpeed);
    this.vel = target > this.vel ? Math.min(target, this.vel + ROUTE.accel * dt) : Math.max(target, this.vel - 4.5 * dt);

    const step = this.vel * dt;
    const before = this.d;
    if (rideLeg && (step >= remaining || remaining <= 0.06)) {
      this.d = this.destD;
      this.vel = 0;
    } else {
      this.d = this.circuit.wrap(this.d + step);
      this.lapRemaining -= step;
    }
    if (this.rideActive && this.destD > this.originD) {
      const span = this.destD - this.originD;
      const travelled = Math.max(0, this.d - before);
      if (this.d <= this.destD) {
        const ride = (travelled / span) * ROUTE.rideMinutes * 60;
        this.advance(ride);
        this.timetable += ride;
      }
      this.progress = clamp((this.d - this.originD) / span);
      if (!this.via && this.d >= this.originD + (ROUTE.originZ - ROUTE.viaZ)) {
        this.via = true;
        this.emit('passed-stop', { stop: ROUTE.via });
      }
    }

    // Lateral position: the planner's wish, at a bounded sideways speed (a weave, a lane grab), no sideways moves in a junction.
    const seg = this.circuit.segmentAt(this.d);
    const wish = seg.edge && wantedLat !== undefined ? wantedLat : BUS06_CURB_LAT;
    // A bus moves sideways only as it drives forward (a steer, not a crab walk)
    const maxLatSpeed = Math.min(1.6, 0.18 * this.vel);
    const desired = Math.max(-maxLatSpeed, Math.min(maxLatSpeed, (wish - this.lat) * 1.6));
    this.latVel += (desired - this.latVel) * Math.min(1, dt * 4);
    this.lat += this.latVel * dt;
    const pose = this.circuit.poseAt(this.d, this.lat);
    this.x = pose.x;
    this.z = pose.z;
    // Heading slips with the sideways motion, as for every vehicle in the traffic sim.
    const slip = this.vel > 0.6 ? Math.atan2(-this.latVel, Math.max(this.vel, 2)) * 0.4 : 0;
    this.yaw = wrapPi(pose.yaw - Math.PI + slip);

    if (this.rideLegDone()) {
      this.phase = 'arrived';
      this.progress = 1;
      this.vel = 0;
      this.x = ROUTE.curbX;
      this.z = ROUTE.destinationZ;
      this.yaw = 0;
      this.lat = BUS06_CURB_LAT;
      this.latVel = 0;
      this.leaveTimer = 0;
      this.awayTimer = 0;
      this.doors.front.target = this.doors.rear.target = 1;
      this.emit('arrived', { stop: ROUTE.destination });
    } else if (!this.rideActive && this.lapRemaining <= 0) {
      // Lap done: out of sight up the road until the next scheduled arrival.
      this.stageAway(ROUTE.layoverZ);
    }
  }

  private rideLegDone() {
    return this.rideActive && this.d >= this.destD - 1e-6 && this.d < this.destD + 1;
  }
}
