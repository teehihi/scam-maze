import { describe, expect, it } from "vitest";
import {
  CITY_GROUND,
  CITY_RESERVED,
  layoutBuildings,
  layoutCars,
  placementRect,
  rectsOverlap,
  type PieceFootprint,
} from "./cityLayout";

const BUILDINGS: PieceFootprint[] = [
  { name: "low", w: 9, h: 8, d: 10 },
  { name: "mid", w: 12, h: 14, d: 11 },
  { name: "tall", w: 13, h: 40, d: 10 },
  { name: "wide", w: 30, h: 16, d: 20 },
  { name: "tooWide", w: 60, h: 14, d: 20 },
];
const CARS: PieceFootprint[] = [
  { name: "car_00", w: 1.8, h: 1.4, d: 4.4 },
  { name: "car_01", w: 2.1, h: 1.8, d: 5.2 },
];

describe("city layout", () => {
  it("is deterministic", () => {
    expect(layoutBuildings(BUILDINGS)).toEqual(layoutBuildings(BUILDINGS));
    expect(layoutCars(CARS)).toEqual(layoutCars(CARS));
  });

  it("fills the plane with buildings but never uses a piece wider than the limit", () => {
    const placed = layoutBuildings(BUILDINGS);
    expect(placed.length).toBeGreaterThan(12);
    expect(placed.some((item) => item.footprint.name === "tooWide")).toBe(false);
  });

  it("keeps every building on the ground plane and out of the reserved street areas", () => {
    for (const { placement, footprint } of layoutBuildings(BUILDINGS)) {
      const rect = placementRect(placement, footprint);
      expect(rect.minX).toBeGreaterThanOrEqual(CITY_GROUND.minX);
      expect(rect.maxX).toBeLessThanOrEqual(CITY_GROUND.maxX);
      expect(rect.minZ).toBeGreaterThanOrEqual(CITY_GROUND.minZ);
      expect(rect.maxZ).toBeLessThanOrEqual(CITY_GROUND.maxZ);
      for (const reserved of CITY_RESERVED) expect(rectsOverlap(rect, reserved)).toBe(false);
    }
  });

  it("does not let two buildings overlap", () => {
    const rects = layoutBuildings(BUILDINGS).map(({ placement, footprint }) => placementRect(placement, footprint));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
    }
  });

  it("parks cars outside the reserved street areas", () => {
    const cars = layoutCars(CARS);
    expect(cars.length).toBeGreaterThan(8);
    // The four cars on the side road are inside the street cluster by design; the lot is not.
    const lot = cars.filter(({ placement }) => placement.z > 0);
    expect(lot.length).toBeGreaterThan(8);
    for (const { placement, footprint } of lot) {
      const rect = placementRect(placement, footprint);
      for (const reserved of CITY_RESERVED) expect(rectsOverlap(rect, reserved)).toBe(false);
    }
  });
});
