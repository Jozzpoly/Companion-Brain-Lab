import { describe, expect, it } from "vitest";
import { MotionContinuityController, S4_DEFAULT_MOTION_CONTINUITY } from "./motion-continuity";

const DT = 1 / 60;

function speed(v: { x: number; y: number }): number {
  return Math.hypot(v.x, v.y);
}

describe("S4 motion continuity controller", () => {
  it("does not teleport from rest to full preferred velocity", () => {
    const controller = new MotionContinuityController();
    const first = controller.step({
      currentVelocity: { x: 0, y: 0 },
      preferredMove: { x: 1, y: 0 },
      deltaSeconds: DT
    });
    expect(first.speed).toBeGreaterThan(0);
    expect(first.speed).toBeLessThan(0.2);
    expect(first.preferredSpeed).toBeCloseTo(3, 6);
    expect(first.accelerationMagnitude).toBeLessThanOrEqual(S4_DEFAULT_MOTION_CONTINUITY.maxAcceleration + 1e-6);
  });

  it("still reaches near-full speed quickly enough to remain responsive", () => {
    const controller = new MotionContinuityController();
    let velocity = { x: 0, y: 0 };
    for (let tick = 0; tick < 24; tick += 1) {
      const result = controller.step({ currentVelocity: velocity, preferredMove: { x: 1, y: 0 }, deltaSeconds: DT });
      velocity = result.commandedVelocity;
    }
    expect(velocity.x).toBeGreaterThan(2.8);
    expect(Math.abs(velocity.y)).toBeLessThan(1e-9);
  });

  it("turns continuously rather than snapping through a ninety-degree preference change", () => {
    const controller = new MotionContinuityController();
    let velocity = { x: 0, y: 0 };
    for (let tick = 0; tick < 30; tick += 1) {
      const result = controller.step({ currentVelocity: velocity, preferredMove: { x: 1, y: 0 }, deltaSeconds: DT });
      velocity = result.commandedVelocity;
    }
    const before = { ...velocity };
    const turned = controller.step({ currentVelocity: velocity, preferredMove: { x: 0, y: 1 }, deltaSeconds: DT });
    expect(turned.commandedVelocity.x).toBeGreaterThan(0);
    expect(turned.commandedVelocity.y).toBeGreaterThan(0);
    expect(speed({ x: turned.commandedVelocity.x - before.x, y: turned.commandedVelocity.y - before.y })).toBeLessThan(0.31);
    expect(turned.regime).toBe("STEER");
  });

  it("brakes and reverses in bounded time instead of smoothing away responsiveness", () => {
    const controller = new MotionContinuityController();
    let velocity = { x: 0, y: 0 };
    for (let tick = 0; tick < 30; tick += 1) {
      const result = controller.step({ currentVelocity: velocity, preferredMove: { x: 1, y: 0 }, deltaSeconds: DT });
      velocity = result.commandedVelocity;
    }
    let crossed = false;
    for (let tick = 0; tick < 24; tick += 1) {
      const result = controller.step({ currentVelocity: velocity, preferredMove: { x: -1, y: 0 }, deltaSeconds: DT });
      velocity = result.commandedVelocity;
      if (velocity.x < -0.2) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(velocity.x).toBeLessThan(-2.2);
  });

  it("settles at rest without residual drift", () => {
    const controller = new MotionContinuityController();
    let velocity = { x: 0, y: 0 };
    for (let tick = 0; tick < 30; tick += 1) {
      const result = controller.step({ currentVelocity: velocity, preferredMove: { x: 0.8, y: 0.2 }, deltaSeconds: DT });
      velocity = result.commandedVelocity;
    }
    for (let tick = 0; tick < 30; tick += 1) {
      const result = controller.step({ currentVelocity: velocity, preferredMove: { x: 0, y: 0 }, deltaSeconds: DT });
      velocity = result.commandedVelocity;
    }
    expect(speed(velocity)).toBeLessThan(0.03);
  });
});
