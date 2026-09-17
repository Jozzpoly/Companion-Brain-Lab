import { describe, expect, it } from "vitest";
import {
  RelationalPositioningBrain,
  intentToward,
  type RelationalDecision
} from "../brain/relational-positioning";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { A1_ORIENTATION_MEMORY_TICKS } from "./a1-relationship-orientation";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { RelationshipOrientationTracker } from "./relationship-orientation-tracker";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`Semantic provenance repair audit missing ${id}.`);
  return value;
}

function motion(actorId: "player" | "companion", move: Vec2): MotionIntent {
  return { actorId, move: { ...move } };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2): Vec2 {
  const length = magnitude(value);
  return length > 1e-9 ? { x: value.x / length, y: value.y / length } : { x: 0, y: 0 };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hasContact(snapshot: WorldSnapshot): boolean {
  return actor(snapshot, "player").contacts.some((contact) => contact.with === "companion") &&
    actor(snapshot, "companion").contacts.some((contact) => contact.with === "player");
}

function buildSituation(input: {
  world: LabWorld;
  snapshot: WorldSnapshot;
  ownerMove: Vec2;
}): A1Situation {
  return buildA1Situation({
    snapshot: input.snapshot,
    playerIntent: motion("player", input.ownerMove),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: input.snapshot.tick === 0
      ? null
      : input.world.latestAuthorityA0StepEvidence()
  });
}

describe("relationship orientation provenance repair", () => {
  it("keeps solver motion as body evidence without promoting it into the repaired relationship frame", async () => {
    const world = await LabWorld.create("head-on");
    const tracker = new RelationshipOrientationTracker();
    const unsafeBrain = new RelationalPositioningBrain();
    const repairedBrain = new RelationalPositioningBrain();
    let snapshot = world.snapshot();

    let contactTick: number | null = null;
    let contaminationTick: number | null = null;
    let unsafeAtContamination: RelationalDecision | null = null;
    let repairedAtContamination: RelationalDecision | null = null;
    let targetDivergenceMeters: number | null = null;
    let motorDirectionDot: number | null = null;
    let releaseTick: number | null = null;
    let firstNoneTick: number | null = null;
    let repairedPostExpiry: RelationalDecision | null = null;
    let unsafePostExpiry: RelationalDecision | null = null;

    try {
      // Establish genuine Owner +X semantics before contact.
      for (let step = 0; step < 90; step += 1) {
        const situation = buildSituation({ world, snapshot, ownerMove: { x: 1, y: 0 } });
        const orientation = tracker.observe(situation);
        const repaired = repairedBrain.decisionWithSemanticOrientation(snapshot, orientation);
        const unsafe = unsafeBrain.decision(snapshot);

        expect(orientation.source).toBe("SAME_STEP_OWNER");
        expect(orientation.direction?.x).toBeGreaterThan(0.9);
        expect(repaired.playerDirection.x).toBeGreaterThan(0.9);
        expect(repaired.semanticFrame?.frameProvenance).toBe("OWNER_SEMANTIC_EVIDENCE");
        expect(unsafe.playerDirection.x).toBeGreaterThan(0.9);

        snapshot = world.step([
          motion("player", { x: 1, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
        if (hasContact(snapshot)) {
          contactTick = snapshot.tick;
          break;
        }
      }
      expect(contactTick).not.toBeNull();

      // Release Owner control while companion continues pushing. The physical
      // solver is allowed to move the player -X. Only the unsafe donor may turn
      // that trajectory into relationship meaning.
      for (let step = 0; step < 36; step += 1) {
        const situation = buildSituation({ world, snapshot, ownerMove: { x: 0, y: 0 } });
        const orientation = tracker.observe(situation);
        const repaired = repairedBrain.decisionWithSemanticOrientation(snapshot, orientation);
        const unsafe = unsafeBrain.decision(snapshot);
        const player = actor(snapshot, "player");
        const externallyDriven =
          situation.situated.playerMotionProvenance.state === "EXTERNAL_MOTION_EVIDENT" &&
          magnitude(player.requestedVelocity) < 0.08 &&
          player.actualVelocity.x < -0.15 &&
          hasContact(snapshot);
        const unsafePromotedSolverHeading =
          unsafe.reconsideredAtTick === snapshot.tick &&
          unsafe.playerDirection.x < -0.9;

        if (externallyDriven && unsafePromotedSolverHeading) {
          contaminationTick = snapshot.tick;
          unsafeAtContamination = unsafe;
          repairedAtContamination = repaired;

          expect(orientation.source).toBe("OWNER_MEMORY");
          expect(orientation.direction?.x).toBeGreaterThan(0.9);
          expect(repaired.playerDirection.x).toBeGreaterThan(0.9);
          expect(repaired.semanticFrame?.evidenceSource).toBe("OWNER_MEMORY");
          expect(repaired.semanticFrame?.frameProvenance).toBe("OWNER_SEMANTIC_EVIDENCE");
          expect(unsafe.playerDirection.x).toBeLessThan(-0.9);

          targetDivergenceMeters = distance(repaired.target, unsafe.target);
          const repairedMotor = intentToward(snapshot, repaired.target).move;
          const unsafeMotor = intentToward(snapshot, unsafe.target).move;
          if (magnitude(repairedMotor) > 0.1 && magnitude(unsafeMotor) > 0.1) {
            motorDirectionDot = dot(normalized(repairedMotor), normalized(unsafeMotor));
          }
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
      }

      expect(contaminationTick).not.toBeNull();
      expect(unsafeAtContamination?.playerDirection.x).toBeLessThan(-0.9);
      expect(repairedAtContamination?.playerDirection.x).toBeGreaterThan(0.9);
      expect(targetDivergenceMeters ?? 0).toBeGreaterThan(2.5);
      expect(motorDirectionDot).not.toBeNull();
      expect(motorDirectionDot ?? 1).toBeLessThan(0);

      // Separate the bodies. The repaired frame must still be sourced only from
      // bounded Owner memory, never from the player's solver-driven trajectory.
      snapshot = world.step([
        motion("player", { x: 0, y: 0 }),
        motion("companion", { x: 1, y: 0 })
      ]);
      for (let step = 0; step < 30; step += 1) {
        const situation = buildSituation({ world, snapshot, ownerMove: { x: 0, y: 0 } });
        const orientation = tracker.observe(situation);
        const repaired = repairedBrain.decisionWithSemanticOrientation(snapshot, orientation);
        unsafeBrain.decision(snapshot);
        const player = actor(snapshot, "player");
        const physicallyReleased =
          !hasContact(snapshot) &&
          magnitude(player.requestedVelocity) < 0.08 &&
          magnitude(player.actualVelocity) < 0.08;

        if (physicallyReleased) {
          releaseTick = snapshot.tick;
          expect(orientation.source).toBe("OWNER_MEMORY");
          expect(repaired.playerDirection.x).toBeGreaterThan(0.9);
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 1, y: 0 })
        ]);
      }
      expect(releaseTick).not.toBeNull();

      // The release observation already consumed this World tick. Advance once
      // before entering the expiry phase so the canonical tracker is never
      // sampled twice at the same tick.
      snapshot = world.step([
        motion("player", { x: 0, y: 0 }),
        motion("companion", { x: 0, y: 0 })
      ]);

      // Continue through complete Owner-memory expiry and several six-tick
      // tactical reconsiderations. The repaired brain may explicitly retain its
      // last genuine semantic frame for continuity, but it must label that frame
      // as stale continuity and must never replace it with solver-derived -X.
      for (let step = 0; step < A1_ORIENTATION_MEMORY_TICKS + 24; step += 1) {
        const situation = buildSituation({ world, snapshot, ownerMove: { x: 0, y: 0 } });
        const orientation = tracker.observe(situation);
        const repaired = repairedBrain.decisionWithSemanticOrientation(snapshot, orientation);
        const unsafe = unsafeBrain.decision(snapshot);

        if (orientation.source === "NONE" && firstNoneTick === null) firstNoneTick = snapshot.tick;
        if (
          orientation.source === "NONE" &&
          repaired.reconsideredAtTick === snapshot.tick &&
          repairedPostExpiry === null
        ) {
          repairedPostExpiry = repaired;
          unsafePostExpiry = unsafe;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 0, y: 0 })
        ]);
      }

      expect(firstNoneTick).not.toBeNull();
      expect(repairedPostExpiry).not.toBeNull();
      expect(unsafePostExpiry).not.toBeNull();
      expect(repairedPostExpiry?.semanticFrame?.evidenceSource).toBe("NONE");
      expect(repairedPostExpiry?.semanticFrame?.frameProvenance).toBe("RETAINED_LAST_SEMANTIC_FRAME");
      expect(repairedPostExpiry?.playerDirection.x).toBeGreaterThan(0.9);
      expect(unsafePostExpiry?.playerDirection.x).toBeLessThan(-0.9);

      console.info("[RELATIONSHIP_ORIENTATION_PROVENANCE_REPAIR]", JSON.stringify({
        contactTick,
        contaminationTick,
        releaseTick,
        firstNoneTick,
        contamination: {
          worldPlayerActualVelocity: actor(snapshot, "player").actualVelocity,
          unsafeDirection: unsafeAtContamination?.playerDirection,
          repairedDirection: repairedAtContamination?.playerDirection,
          repairedSemanticFrame: repairedAtContamination?.semanticFrame,
          targetDivergenceMeters,
          motorDirectionDot
        },
        afterOwnerMemoryExpiry: {
          unsafeDirection: unsafePostExpiry?.playerDirection,
          repairedDirection: repairedPostExpiry?.playerDirection,
          repairedSemanticFrame: repairedPostExpiry?.semanticFrame
        },
        interpretation: {
          bodyTrajectoryRemainsObservable: true,
          solverMotionCannotBecomeRepairedOwnerMeaning: true,
          repairedFrameProvenanceIsExplicit: true,
          retainedFramePolicyStillRequiresBehavioralFalsification: true
        },
        runtimeAuthority: "NONE_TEST_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
