import { describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier2d-deterministic-compat";

let ready: Promise<void> | null = null;

function ensureRapier(): Promise<void> {
  ready ??= RAPIER.init().then(() => undefined);
  return ready;
}

describe("R1-0 deterministic Rapier initial-penetration semantics", () => {
  it("distinguishes immediate penetration stop from an outward egress cast", async () => {
    await ensureRapier();
    const world = new RAPIER.World({ x: 0, y: 0 });

    try {
      // Vertical static wall with left face at x=5.5.
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.25, 4)
          .setTranslation(5.75, 4)
          .setFriction(0)
          .setRestitution(0)
      );

      // deterministic-compat scene-query broad phase is usable after a step,
      // mirroring the production adapter's construction warm-up.
      world.step();

      const start = { x: 5.16, y: 4 };
      const direction = { x: -1, y: 0 };
      const shape = new RAPIER.Ball(0.38);
      const distance = 1;

      const stopImmediately = world.castShape(
        start,
        0,
        direction,
        shape,
        0,
        distance,
        true
      );

      const allowEgress = world.castShape(
        start,
        0,
        direction,
        shape,
        0,
        distance,
        false
      );

      expect(stopImmediately).not.toBeNull();
      expect(stopImmediately?.time_of_impact ?? Number.POSITIVE_INFINITY).toBeLessThan(1e-5);

      // The enlarged shape starts 4 cm inside the wall-clearance envelope but
      // travels directly away from it. With stopAtPenetration=false Rapier
      // should not treat that initial overlap as an immediate blocking hit.
      expect(allowEgress).toBeNull();
    } finally {
      world.free();
    }
  });
});
