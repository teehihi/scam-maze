import * as THREE from 'three';
import type { Physics } from './physics';
import { clamp } from './util';

export class Player {
  pos = new THREE.Vector3(12, 0.15, 2.4);
  yaw = 2.5; pitch = -0.04;
  vel = new THREE.Vector2(); vy = 0;
  keys = new Set<string>();
  joy = new THREE.Vector2();
  look = new THREE.Vector2();
  eyeH = 1.62; crouchT = 0; bob = 0; stepAcc = 0; moving = 0;
  sitting: { eye: number; prev: THREE.Vector3; label: string } | null = null;
  auto: { x: number; z: number }[] | null = null;
  autoDone: (() => void) | null = null;
  onStep: ((surface: string, run: boolean) => void) | null = null;
  surface = 'concrete';
  yawTarget = 0;
  private stuckT = 0; private lastP = new THREE.Vector3();

  camera: THREE.PerspectiveCamera;
  phys: Physics;
  constructor(camera: THREE.PerspectiveCamera, phys: Physics) { this.camera = camera; this.phys = phys;
    camera.rotation.order = 'YXZ';
  }
  get eye() { return this.pos.y + this.eyeH * (1 - this.crouchT * 0.3) - (this.sitting ? this.eyeH - this.sitting.eye : 0); }

  sit(p: THREE.Vector3, yaw: number, eye: number, label: string) {
    if (this.sitting) return;
    this.sitting = { eye, prev: this.pos.clone(), label };
    this.pos.x = p.x; this.pos.z = p.z; this.yaw = yaw + Math.PI; this.pitch = -0.1;
    this.auto = null;
  }
  stand() { if (this.sitting) { this.pos.copy(this.sitting.prev); this.sitting = null; } }
  teleport(x: number, z: number, yaw: number) {
    this.pos.set(x, 0, z); this.pos.y = this.phys.floorAt(x, z, 30, 40).y; this.yaw = yaw; this.pitch = -0.03; this.vel.set(0, 0); this.sitting = null; this.auto = null;
  }
  startAuto(pts: { x: number; z: number }[], done?: () => void) { this.auto = pts.slice(); this.autoDone = done ?? null; this.sitting = null; }

  update(dt: number, running: boolean): void {
    const k = this.keys;
    // look from keys / touch
    const tl = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    this.yaw += tl * 1.8 * dt + this.look.x; this.pitch = clamp(this.pitch + ((k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0)) * 1.4 * dt + this.look.y, -1.45, 1.45);
    this.look.set(0, 0);
    let fx = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + -this.joy.y, sx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.joy.x;
    const wantsMove = Math.abs(fx) + Math.abs(sx) > 0.01;
    if (this.sitting && wantsMove) this.stand();
    if (this.auto && wantsMove) this.auto = null;
    let speed = (running || k.has('ShiftLeft') || k.has('ShiftRight') ? 3.6 : 1.85);
    this.crouchT += ((k.has('KeyC') ? 1 : 0) - this.crouchT) * Math.min(1, dt * 8);
    speed *= 1 - this.crouchT * 0.45;
    if (this.auto && this.auto.length) {
      const t = this.auto[0], dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      this.stuckT += dt; if (this.pos.distanceTo(this.lastP) > 0.25) { this.stuckT = 0; this.lastP.copy(this.pos); }
      if (this.stuckT > 2.5) { this.stuckT = 0; this.auto.shift(); if (!this.auto.length) { this.auto = null; this.autoDone?.(); } return this.update(dt, running); }
      if (d < 0.32) { this.auto.shift(); if (!this.auto.length) { this.auto = null; this.autoDone?.(); } }
      else {
        const want = Math.atan2(-dx, -dz);
        let dy = want - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * Math.min(1, dt * 4.5); this.pitch += (-0.05 - this.pitch) * Math.min(1, dt * 2);
        const turnPenalty = clamp(1 - Math.abs(dy) / 1.6, 0.15, 1);
        fx = turnPenalty; sx = 0; speed = 1.7;
      }
    }
    const len = Math.hypot(fx, sx) || 1;
    const ax = (-Math.sin(this.yaw) * fx + Math.cos(this.yaw) * sx) / Math.max(1, len) * speed;
    const az = (-Math.cos(this.yaw) * fx - Math.sin(this.yaw) * sx) / Math.max(1, len) * speed;
    const acc = Math.min(1, dt * 10);
    if (!this.sitting) { this.vel.x += (ax - this.vel.x) * acc; this.vel.y += (az - this.vel.y) * acc; } else this.vel.set(0, 0);
    const mv = Math.hypot(this.vel.x, this.vel.y);
    this.moving = mv;
    // integrate with sub-steps
    const steps = Math.max(1, Math.ceil((mv * dt) / 0.12));
    const p = { x: this.pos.x, z: this.pos.z };
    for (let i = 0; i < steps; i++) {
      p.x += (this.vel.x * dt) / steps; p.z += (this.vel.y * dt) / steps;
      this.phys.collide(p, this.pos.y, 0.28, 1.6 - this.crouchT * 0.4);
    }
    this.pos.x = p.x; this.pos.z = p.z;
    // vertical
    const fl = this.phys.floorAt(this.pos.x, this.pos.z, this.pos.y, 0.55);
    this.surface = fl.kind;
    if (this.pos.y < fl.y) { this.pos.y = Math.min(fl.y, this.pos.y + Math.max(5 * dt, (fl.y - this.pos.y) * Math.min(1, dt * 14))); this.vy = 0; }
    else if (this.pos.y > fl.y + 0.001) { this.vy -= 18 * dt; this.pos.y += this.vy * dt; if (this.pos.y <= fl.y) { this.pos.y = fl.y; this.vy = 0; } }
    else this.vy = 0;
    // head bob & footsteps
    if (mv > 0.3 && this.vy === 0) {
      this.bob += mv * dt * 5.2; this.stepAcc += mv * dt;
      const stride = mv > 2.5 ? 1.35 : 0.85;
      if (this.stepAcc > stride) { this.stepAcc = 0; this.onStep?.(this.surface, mv > 2.5); }
    }
    const camY = this.eye + Math.sin(this.bob) * 0.022 * clamp(mv / 2, 0, 1.4);
    this.camera.position.set(this.pos.x, camY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * 0.5) * 0.0025 * clamp(mv / 2, 0, 1.4));
  }
}
