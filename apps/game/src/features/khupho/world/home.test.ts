import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { inDoorway, type Doorway } from "./home";

describe("white doorway behind the rear bedroom door", () => {
  const door: Doorway = { x0: 0.45, x1: 1.3, z: 7.72, z1: 8.3, height: 2.15 };
  const floor = 3.65;
  const eye = (x: number, z: number) => new THREE.Vector3(x, 0, z);

  it("triggers once the eye is past the door line, inside the opening", () => {
    expect(inDoorway(door, eye(0.9, 7.8), floor + 1.62, floor)).toBe(true);
  });

  it("does not trigger in the hall, beside the opening, on another floor or deep in the room", () => {
    expect(inDoorway(door, eye(0.9, 7.2), floor + 1.62, floor)).toBe(false);
    expect(inDoorway(door, eye(2.0, 7.8), floor + 1.62, floor)).toBe(false);
    expect(inDoorway(door, eye(0.9, 7.8), 0.35 + 1.62, floor)).toBe(false);
    expect(inDoorway(door, eye(0.9, 9.5), floor + 1.62, floor)).toBe(false);
  });
});
