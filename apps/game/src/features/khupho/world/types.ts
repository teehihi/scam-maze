import type * as THREE from 'three';
import type { Physics } from './physics';
import type { Interactions } from './interact';
import type { House } from './house';

export interface RoomLight {
  pos: THREE.Vector3; level: number; target: number; manual: boolean; color: number; power: number;
  mats: THREE.MeshStandardMaterial[]; curtainMats: THREE.MeshStandardMaterial[]; roomId: string; houseId: string;
}
export interface Sfx {
  play(kind: string, pos?: THREE.Vector3): void;
  loop(id: string, kind: string, pos: THREE.Vector3 | null, on: boolean): void;
}
export interface Device { on: boolean; set(on: boolean): void; toggle(): void }
export interface Room {
  id: string; name: string; k: number; x0: number; x1: number; z0: number; z1: number; kind: string; paint: string;
  light?: RoomLight; house: House; curtainMat?: THREE.MeshStandardMaterial;
}
export interface Spot { x: number; z: number; k: number; yaw: number; pose: 'stand' | 'sit' | 'lie' | 'cook' | 'work' | 'sweep' | 'wash' | 'phone' | 'eat'; y?: number; room: string; device?: string }
export interface Ctx {
  root: THREE.Group; phys: Physics; inter: Interactions;
  roomLights: RoomLight[]; dyn: ((dt: number, t: number) => void)[];
  env: { hour: number; night: number; rain: number; sun: number };
  sfx: Sfx; eye: THREE.Vector3; houses: House[];
  player: { sit(pos: THREE.Vector3, yaw: number, eye: number, label: string): void };
  rand: () => number;
  lamps: THREE.Vector3[];
  walkers: { update(dt: number, t: number): void }[];
}
