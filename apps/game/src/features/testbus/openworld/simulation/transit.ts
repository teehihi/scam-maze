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
} as const;

export type Phase = 'waiting' | 'approaching' | 'boarding' | 'departing' | 'driving' | 'arrived' | 'complete';
export type DoorId = 'front' | 'rear';
export type TransitEvent = {
  type: 'wait-started' | 'bus-at-stop' | 'boarded' | 'left-bus' | 'fare-paid' | 'departed' | 'passed-stop' | 'arrived' | 'transfer-complete';
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
}

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
  progress = 0;
  private cash: number = ROUTE.initialCash;
  private seconds: number = ROUTE.start;
  private nextBus: number;
  private approach = 0;
  private chapterDepartureAt: number | undefined;
  /** Where the current approach starts (z) and how long it takes at full speed (seconds). */
  private approachFrom: number = ROUTE.approachZ;
  private approachSeconds = 6.8;
  /** Staged away (`stageAway`): the bus waits up the road until it is called, it does not come on its own timer. */
  staged = false;
  private driving = 0;
  private driveThrottle = 1;
  private via = false;
  accel = 0;

  private host: TransitHost;
  constructor(host: TransitHost = {}) {
    this.host = host;
    this.nextBus = this.clock + ROUTE.waitMinutes * 60;
  }

  get clock() { return this.host.clock?.read() ?? this.host.chapterSeconds?.() ?? this.seconds; }
  get balance() { return this.host.wallet?.read() ?? this.cash; }

  emit(type: TransitEvent['type'], details: Partial<TransitEvent> = {}) {
    this.host.onEvent?.({ type, at: this.clock, route: ROUTE.number, ...details });
  }

  private advance(seconds: number) {
    if (this.host.clock) this.host.clock.advance(seconds);
    else this.seconds += seconds;
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
   * bus arrives in front of the player instead of standing at the stop from the first frame.
   */
  stageAway(fromZ = 44) {
    if (this.phase !== 'waiting' && this.phase !== 'boarding') return false;
    this.phase = 'waiting';
    this.staged = true;
    this.approach = 0;
    this.approachFrom = fromZ;
    this.z = fromZ;
    this.x = ROUTE.curbX;
    this.yaw = 0;
    this.speed = 0;
    this.doors.front.target = this.doors.rear.target = 0;
    this.doors.front.amount = this.doors.rear.amount = 0;
    return true;
  }

  /**
   * Brings the staged bus in from where it waits: it drives `fromZ` → the stop in about `seconds`, slowing down to a halt
   * (the same curve as `wait`). Unlike `wait` it does not skip time: the bus is simply the next one coming. Returns false
   * when a bus is already coming, at the stop or on its way.
   */
  callBus(seconds = 6.8) {
    if (this.phase !== 'waiting') return false;
    this.staged = false;
    this.chapterDepartureAt = undefined;
    this.approachSeconds = Math.max(1, seconds);
    this.approach = 0;
    this.phase = 'approaching';
    this.emit('wait-started', { stop: ROUTE.origin });
    return true;
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
    this.doors.front.target = this.doors.rear.target = 0;
    return true;
  }

  passengerCrossed(onboard: boolean, ashore = false) {
    this.emit(onboard ? 'boarded' : 'left-bus');
    if (!onboard && ashore) this.reachSidewalk();
  }

  reachSidewalk() {
    if (this.phase !== 'arrived') return;
    this.phase = 'complete';
    this.onTime = this.clock <= ROUTE.deadline;
    this.emit('transfer-complete', { stop: ROUTE.destination, onTime: this.onTime });
  }

  update(dt: number, occupied: Record<DoorId, boolean>, approachBlocked: boolean, maxSafeSpeed?: number) {
    const oldPosition = this.z;
    const prevSpeed = this.speed;
    if (this.phase !== 'driving' && !this.host.chapterSeconds) {
      this.advance(dt * (this.phase === 'waiting' ? 12 : 5));
    }
    if (!this.host.chapterSeconds && this.phase === 'waiting' && !this.staged && this.clock >= this.nextBus) this.wait();
    if (this.phase === 'approaching') {
      // Chapter time: a bus asked for with `wait` leaves the previous stop after the scheduled wait of story time.
      const chapterNow = this.host.chapterSeconds?.();
      const timeToApproach = this.chapterDepartureAt === undefined || (chapterNow ?? 0) >= this.chapterDepartureAt;
      if (timeToApproach) this.chapterDepartureAt = undefined;
      const canMove = timeToApproach && !approachBlocked && (maxSafeSpeed === undefined || maxSafeSpeed > 0.35);
      if (canMove) this.approach = clamp(this.approach + dt / this.approachSeconds);
      // Ease-out: full speed at the start, slowing down progressively to a halt at the stop.
      this.z = this.approachFrom * (1 - this.approach ** 1.14 * (2 - this.approach ** 1.14));
      if (this.approach >= 1) {
        this.phase = 'boarding';
        this.emit('bus-at-stop', { stop: ROUTE.origin });
      }
    }

    this.doors.front.step(dt, occupied.front);
    this.doors.rear.step(dt, occupied.rear);
    if (this.phase === 'departing') {
      if (occupied.front || occupied.rear) {
        this.phase = 'boarding';
        if (occupied.front) this.doors.front.target = 1;
        if (occupied.rear) this.doors.rear.target = 1;
      } else if (this.doors.front.sealed && this.doors.rear.sealed) {
        this.phase = 'driving';
        this.emit('departed', { stop: ROUTE.origin });
      }
    }
    if (this.phase === 'driving') {
      const previous = this.driving;
      // Compute nominal cruise speed along the smoothstep curve, then obey traffic signals & leaders!
      const deriv = Math.max(0.15, 6 * this.driving * (1 - this.driving));
      const nominalSpeed = (Math.abs(ROUTE.destinationZ) / 30) * deriv;
      const targetThrottle =
        maxSafeSpeed !== undefined ? clamp(maxSafeSpeed / Math.max(nominalSpeed, 0.8), 0, 1) : 1;
      const rate = targetThrottle < this.driveThrottle ? 4.2 : 1.6;
      this.driveThrottle = damp(this.driveThrottle, targetThrottle, rate, dt);

      this.driving = clamp(this.driving + (dt / 30) * this.driveThrottle);
      this.advance((this.driving - previous) * ROUTE.rideMinutes * 60);
      this.progress = smooth(this.driving);
      this.z = ROUTE.destinationZ * this.progress;
      this.x = ROUTE.curbX - 0.78 * Math.sin(Math.PI * this.progress) ** 2;
      this.yaw = Math.atan2(0.78 * Math.PI * Math.sin(2 * Math.PI * this.progress), -ROUTE.destinationZ);
      if (!this.via && this.z <= ROUTE.viaZ) {
        this.via = true;
        this.emit('passed-stop', { stop: ROUTE.via });
      }
      if (this.driving >= 1) {
        this.phase = 'arrived';
        this.yaw = 0;
        this.doors.front.target = this.doors.rear.target = 1;
        this.emit('arrived', { stop: ROUTE.destination });
      }
    }
    this.speed = dt > 0 ? Math.abs(this.z - oldPosition) / dt : 0;
    this.accel = dt > 0 ? (this.speed - prevSpeed) / dt : 0;
  }
}