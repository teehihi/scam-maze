import { describe, it, expect } from "vitest";
import {
  resolveBoxCollision,
  checkProximityToCar,
  stepVehiclePhysics,
} from "./vehiclePhysics";
import { DEFAULT_VEHICLE_CONFIG, type BoxCollider, type VehicleState } from "./types";

describe("vehiclePhysics", () => {
  describe("resolveBoxCollision", () => {
    const box: BoxCollider = {
      x: 186.29,
      z: -68.85,
      halfWidth: 1.25,
      halfLength: 2.8,
      yaw: 0,
    };
    const playerRadius = 0.45;

    it("does not alter position when player is far away", () => {
      const res = resolveBoxCollision(195.0, -68.85, playerRadius, box);
      expect(res.collided).toBe(false);
      expect(res.x).toBe(195.0);
      expect(res.z).toBe(-68.85);
    });

    it("pushes player out to the right when walking into the driver door side", () => {
      // Box extends from 185.04 to 187.54 in X. With radius 0.45, right boundary is 187.99.
      const res = resolveBoxCollision(187.4, -68.85, playerRadius, box);
      expect(res.collided).toBe(true);
      expect(res.x).toBeCloseTo(187.99, 2);
      expect(res.z).toBeCloseTo(-68.85, 2);
    });

    it("pushes player forward when walking into the front bumper", () => {
      // Box extends in Z from -71.65 to -66.05. With radius 0.45, front boundary is -65.60.
      const res = resolveBoxCollision(186.29, -65.9, playerRadius, box);
      expect(res.collided).toBe(true);
      expect(res.z).toBeCloseTo(-65.60, 2);
    });

    it("pushes player backward when walking into the rear bumper", () => {
      // Rear boundary is -71.65 - 0.45 = -72.10.
      const res = resolveBoxCollision(186.29, -71.8, playerRadius, box);
      expect(res.collided).toBe(true);
      expect(res.z).toBeCloseTo(-72.10, 2);
    });
  });

  describe("checkProximityToCar", () => {
    const carPos: [number, number, number] = [186.29, -94.92, -68.75];
    const carYaw = 0;

    it("returns true when player is beside driver door", () => {
      // Driver door is around X = 187.64, Z = -68.95
      expect(checkProximityToCar(187.8, -92.7, -68.9, carPos, carYaw)).toBe(true);
    });

    it("returns false when player is far away down the street", () => {
      expect(checkProximityToCar(188.6, -92.7, -88.89, carPos, carYaw)).toBe(false);
    });
  });

  describe("stepVehiclePhysics", () => {
    const initialState: VehicleState = {
      position: [186.29, -94.92, -68.75],
      yaw: 0,
      speed: 0,
      steering: 0,
      gear: "P",
      isDriving: true,
      isNearCar: true,
      steeringWheelRotation: 0,
      pitch: 0,
      roll: 0,
    };

    it("accelerates forward and shifts to D on forward input", () => {
      const inputs = {
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
      };

      let state = initialState;
      for (let i = 0; i < 20; i++) {
        state = stepVehiclePhysics(state, inputs, DEFAULT_VEHICLE_CONFIG, 0.05);
      }

      expect(state.speed).toBeGreaterThan(5.0);
      expect(state.gear).toBe("D");
      expect(state.position[2]).toBeGreaterThan(initialState.position[2]); // moving along +Z
    });

    it("brakes and reverses into gear R on backward input from stop", () => {
      const inputs = {
        forward: false,
        backward: true,
        left: false,
        right: false,
        handbrake: false,
      };

      let state = initialState;
      for (let i = 0; i < 20; i++) {
        state = stepVehiclePhysics(state, inputs, DEFAULT_VEHICLE_CONFIG, 0.05);
      }

      expect(state.speed).toBeLessThan(0);
      expect(state.gear).toBe("R");
      expect(state.position[2]).toBeLessThan(initialState.position[2]); // reversing along -Z
    });

    it("turns steering wheel and alters yaw when steering while moving", () => {
      const moveAndSteer = {
        forward: true,
        backward: false,
        left: true,
        right: false,
        handbrake: false,
      };

      let state = initialState;
      for (let i = 0; i < 30; i++) {
        state = stepVehiclePhysics(state, moveAndSteer, DEFAULT_VEHICLE_CONFIG, 0.05);
      }

      expect(state.steering).toBeGreaterThan(0);
      expect(state.steeringWheelRotation).toBeGreaterThan(0);
      expect(state.yaw).toBeGreaterThan(0); // Nose turns left (+X in world space)
    });

    it("handles reverse steering correctly: tail drifts left when steering left in reverse", () => {
      // Start in reverse motion with speed < 0
      let state: VehicleState = {
        ...initialState,
        speed: -3.0,
        gear: "R",
      };

      const reverseSteerLeft = {
        forward: false,
        backward: true,
        left: true,
        right: false,
        handbrake: false,
      };

      for (let i = 0; i < 20; i++) {
        state = stepVehiclePhysics(state, reverseSteerLeft, DEFAULT_VEHICLE_CONFIG, 0.05);
      }

      // Steering wheel turns left (> 0)
      expect(state.steering).toBeGreaterThan(0);
      expect(state.steeringWheelRotation).toBeGreaterThan(0);
      // In reverse, steering left points head/nose right (yaw < 0) while tail drifts left (+X)
      expect(state.yaw).toBeLessThan(0);
    });

    it("provides progressive steering: longer key press yields greater steer angle, and cruising speed attenuates max angle", () => {
      const steerInput = {
        forward: true,
        backward: false,
        left: true,
        right: false,
        handbrake: false,
      };

      // Short tap (3 frames @ 0.05s = 0.15s)
      let stateShort = initialState;
      for (let i = 0; i < 3; i++) {
        stateShort = stepVehiclePhysics(stateShort, steerInput, DEFAULT_VEHICLE_CONFIG, 0.05);
      }

      // Long hold while accelerating to cruising speed (30 frames @ 0.05s = 1.5s)
      let stateLong = initialState;
      for (let i = 0; i < 30; i++) {
        stateLong = stepVehiclePhysics(stateLong, steerInput, DEFAULT_VEHICLE_CONFIG, 0.05);
      }

      // Short tap makes gentle micro-adjustment (< 0.12 rad, ~6.8 deg) for stable straight-line driving
      expect(Math.abs(stateShort.steering)).toBeLessThan(0.12);
      expect(Math.abs(stateShort.steering)).toBeLessThan(Math.abs(stateLong.steering));
      // At cruising speed (>50 km/h), max angle is safely attenuated below raw stationary lock
      expect(Math.abs(stateLong.steering)).toBeLessThan(DEFAULT_VEHICLE_CONFIG.maxSteerAngle);
      expect(Math.abs(stateLong.steering)).toBeGreaterThan(0.08);

      // Stationary dry steering (speed = 0) can reach full lock angle
      const stationarySteer = { forward: false, backward: false, left: true, right: false, handbrake: false };
      let stateParked = initialState;
      for (let i = 0; i < 60; i++) {
        stateParked = stepVehiclePhysics(stateParked, stationarySteer, DEFAULT_VEHICLE_CONFIG, 0.05);
      }
      expect(Math.abs(stateParked.steering)).toBeCloseTo(DEFAULT_VEHICLE_CONFIG.maxSteerAngle, 1);
    });

    it("clamps position to road bounds", () => {
      const runOffRoad = {
        forward: true,
        backward: false,
        left: true,
        right: false,
        handbrake: false,
      };

      let state = {
        ...initialState,
        speed: 10,
        position: [DEFAULT_VEHICLE_CONFIG.roadBounds.minX - 5, -94.92, 0] as [number, number, number],
      };

      state = stepVehiclePhysics(state, runOffRoad, DEFAULT_VEHICLE_CONFIG, 0.05);
      expect(state.position[0]).toBeGreaterThanOrEqual(DEFAULT_VEHICLE_CONFIG.roadBounds.minX);
    });

    it("keeps the car inside optional round bounds", () => {
      const config = {
        ...DEFAULT_VEHICLE_CONFIG,
        roadBounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 },
        roundBounds: { centerX: 0, centerZ: 0, radius: 20 },
      };
      let state: VehicleState = { ...initialState, position: [0, 0, 0], yaw: 0 };
      const full = { forward: true, backward: false, left: false, right: false, handbrake: false };
      for (let i = 0; i < 200; i++) {
        state = stepVehiclePhysics(state, full, config, 0.05);
        expect(Math.hypot(state.position[0], state.position[2])).toBeLessThanOrEqual(20 + 1e-9);
      }
    });
  });
});
