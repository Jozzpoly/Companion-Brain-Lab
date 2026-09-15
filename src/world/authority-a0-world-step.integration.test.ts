import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { AuthorityA0WorldStepEvidence } from "./authority-a0-step-evidence";
import { scenario } from "./scenarios";
import { LabWorld } from "./world";

describe("Authority-A0 live World step evidence", () => {
  it("captures same-step control, capability and world-unit command beside the unchanged World step", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        { actorId: "companion", move: { x: -0.5, y: 0 } }
      ]);
      const evidence = world.latestAuthorityA0StepEvidence();
      if (!evidence) throw new Error("missing A0 step evidence");

      expect(after.tick).toBe(1);
      expect(evidence.observationTick).toBe(0);
      expect(evidence.outcomeTick).toBe(1);
      expect(evidence.situated.playerControl.sourceTick).toBe(0);
      expect(evidence.situated.playerControl.move).toEqual({ x: 1, y: 0 });
      expect(evidence.situated.playerCapability.maxSpeed).toBe(3);
      expect(evidence.situated.companionCapability.maxSpeed).toBe(3);
      expect(evidence.companionVelocityCommand.velocity).toEqual({ x: -1.5, y: 0 });
      expect(evidence.companionVelocityCommand.sourceTick).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("distinguishes canonical zero-input solver motion without inventing missing contact provenance", async () => {
    const world = await LabWorld.create("head-on");
    try {
      let disturbed: AuthorityA0WorldStepEvidence | null = null;
      for (let tick = 0; tick < 120; tick += 1) {
        world.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          { actorId: "companion", move: { x: -1, y: 0 } }
        ]);
        const evidence = world.latestAuthorityA0StepEvidence();
        if (!evidence) continue;
        const requestedSpeed = Math.hypot(
          evidence.situated.playerBody.requestedVelocity.x,
          evidence.situated.playerBody.requestedVelocity.y
        );
        const actualSpeed = Math.hypot(
          evidence.situated.playerBody.actualVelocity.x,
          evidence.situated.playerBody.actualVelocity.y
        );
        if (requestedSpeed < 0.01 && actualSpeed > 0.1) {
          disturbed = evidence;
          break;
        }
      }

      expect(disturbed).not.toBeNull();
      if (!disturbed) return;
      expect(disturbed.situated.playerControl.active).toBe(false);
      expect(disturbed.situated.playerControl.move).toEqual({ x: 0, y: 0 });
      expect(Math.hypot(
        disturbed.situated.playerBody.requestedVelocity.x,
        disturbed.situated.playerBody.requestedVelocity.y
      )).toBeLessThan(0.01);
      expect(Math.hypot(
        disturbed.situated.playerBody.actualVelocity.x,
        disturbed.situated.playerBody.actualVelocity.y
      )).toBeGreaterThan(0.1);
      expect([
        "EXTERNAL_MOTION_EVIDENT",
        "MIXED_OR_UNCERTAIN"
      ]).toContain(disturbed.situated.playerMotionProvenance.state);
      expect(disturbed.situated.playerMotionProvenance.state).not.toBe("OWNER_DIRECTED");
      expect(disturbed.situated.playerMotionProvenance.state).not.toBe("STATIONARY");
    } finally {
      world.dispose();
    }
  });

  it("returns defensive A0 evidence copies", async () => {
    const world = await LabWorld.create("open");
    try {
      world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        { actorId: "companion", move: { x: 0, y: 0 } }
      ]);
      const first = world.latestAuthorityA0StepEvidence();
      if (!first) throw new Error("missing first A0 evidence");
      first.situated.playerControl.move.x = 999;
      first.companionVelocityCommand.velocity.x = 999;
      (first.companionOutcomeAttribution.contacts as string[]).push("fake");

      const second = world.latestAuthorityA0StepEvidence();
      expect(second?.situated.playerControl.move.x).toBe(1);
      expect(second?.companionVelocityCommand.velocity.x).toBe(0);
      expect(second?.companionOutcomeAttribution.contacts).not.toContain("fake");
    } finally {
      world.dispose();
    }
  });

  it("keeps physical outcomes exact against an uninstrumented Rapier world", async () => {
    const lab = await LabWorld.create("pillar");
    const raw = await RapierPhysicalWorld.create(scenario("pillar"));
    try {
      for (let tick = 0; tick < 180; tick += 1) {
        const phase = tick % 120;
        const playerMove = phase < 30
          ? { x: 1, y: 0 }
          : phase < 60
            ? { x: 0, y: 1 }
            : phase < 90
              ? { x: -1, y: 0 }
              : { x: 0, y: -1 };
        const companionMove = tick % 40 < 20
          ? { x: -0.6, y: 0.35 }
          : { x: -0.35, y: -0.6 };
        const intents = [
          { actorId: "player" as const, move: playerMove },
          { actorId: "companion" as const, move: companionMove }
        ];

        const labAfter = lab.step(intents);
        const rawAfter = raw.step(intents);
        expect(labAfter.actors).toEqual(rawAfter);
      }
    } finally {
      lab.dispose();
      raw.dispose();
    }
  });
});
