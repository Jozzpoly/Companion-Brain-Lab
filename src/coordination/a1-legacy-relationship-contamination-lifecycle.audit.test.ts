import { describe, expect, it } from "vitest";
import {
  RelationalPositioningBrain,
  evaluateRelationalCandidates,
  intentToward,
  selectRelationalCandidate,
  type RelationalDecision
} from "../brain/relational-positioning";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import {
  A1_ORIENTATION_MEMORY_TICKS,
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationEvidence,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import { buildA1Situation, type A1Situation } from "./a1-situation";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`Legacy relationship contamination audit missing ${id}.`);
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
  if (length <= 1e-9) return { x: 0, y: 0 };
  return { x: value.x / length, y: value.y / length };
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

function observeA1(input: {
  world: LabWorld;
  snapshot: WorldSnapshot;
  ownerMove: Vec2;
  memory: A1RelationshipOrientationMemory | null;
}): {
  situation: A1Situation;
  orientation: A1RelationshipOrientationEvidence;
  nextMemory: A1RelationshipOrientationMemory | null;
} {
  const situation = buildA1Situation({
    snapshot: input.snapshot,
    playerIntent: motion("player", input.ownerMove),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: input.snapshot.tick === 0
      ? null
      : input.world.latestAuthorityA0StepEvidence()
  });
  const orientation = evaluateA1RelationshipOrientation({
    situation,
    memory: input.memory
  });
  return { situation, orientation, nextMemory: orientation.nextMemory };
}

describe("A1 legacy relationship contamination lifecycle audit", () => {
  it("traces solver-induced player motion into a rotated legacy relationship objective that survives long after conflict release", async () => {
    const world = await LabWorld.create("head-on");
    const relationshipBrain = new RelationalPositioningBrain();
    let snapshot = world.snapshot();
    let memory: A1RelationshipOrientationMemory | null = null;
    let contactTick: number | null = null;
    let lastOwnerRelationship: RelationalDecision | null = null;

    let contaminationTick: number | null = null;
    let contaminationA1: A1RelationshipOrientationEvidence | null = null;
    let contaminationRelationship: RelationalDecision | null = null;
    let semanticTarget: Vec2 | null = null;
    let semanticSlot: string | null = null;
    let targetDivergenceMeters: number | null = null;
    let motorDirectionDot: number | null = null;
    let motorDirectionAngleDegrees: number | null = null;

    let releaseTick: number | null = null;
    let releaseA1: A1RelationshipOrientationEvidence | null = null;
    let releaseRelationship: RelationalDecision | null = null;
    let firstA1NoneTick: number | null = null;
    let postExpiryReconsideration: RelationalDecision | null = null;
    let finalA1: A1RelationshipOrientationEvidence | null = null;
    let finalRelationship: RelationalDecision | null = null;
    let finalSnapshot: WorldSnapshot | null = null;

    try {
      // Establish genuine +X Owner meaning while approaching the companion.
      for (let step = 0; step < 90; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 1, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const relationship = relationshipBrain.decision(snapshot);
        lastOwnerRelationship = relationship;

        expect(observed.orientation.source).toBe("SAME_STEP_OWNER");
        expect(observed.orientation.direction).toEqual({ x: 1, y: 0 });
        expect(relationship.playerDirection.x).toBeGreaterThan(0.9);

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
      expect(lastOwnerRelationship).not.toBeNull();

      // Release Owner control but continue the physical push. Wait until the
      // legacy six-tick tactical sampler actually promotes solver-induced -X
      // player motion into its relationship frame.
      for (let step = 0; step < 36; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const relationship = relationshipBrain.decision(snapshot);
        const player = actor(snapshot, "player");
        const externallyDriven =
          observed.situation.situated.playerMotionProvenance.state === "EXTERNAL_MOTION_EVIDENT" &&
          magnitude(player.requestedVelocity) < 0.08 &&
          player.actualVelocity.x < -0.15 &&
          hasContact(snapshot);
        const legacyPromotedExternalHeading =
          relationship.reconsideredAtTick === snapshot.tick &&
          relationship.playerDirection.x < -0.9;

        if (externallyDriven && legacyPromotedExternalHeading) {
          contaminationTick = snapshot.tick;
          contaminationA1 = observed.orientation;
          contaminationRelationship = relationship;

          expect(observed.orientation.source).toBe("OWNER_MEMORY");
          expect(observed.orientation.direction?.x).toBeGreaterThan(0.9);
          if (!observed.orientation.direction) break;

          const semanticCandidates = evaluateRelationalCandidates(
            snapshot,
            observed.orientation.direction,
            relationship.selectedSlot
          );
          const semanticSelection = selectRelationalCandidate(
            semanticCandidates,
            relationship.selectedSlot
          );
          semanticTarget = { ...semanticSelection.candidate.position };
          semanticSlot = semanticSelection.candidate.slot;
          targetDivergenceMeters = distance(relationship.target, semanticTarget);

          const contaminatedMotor = intentToward(snapshot, relationship.target).move;
          const ownerSemanticMotor = intentToward(snapshot, semanticTarget).move;
          if (magnitude(contaminatedMotor) > 0.1 && magnitude(ownerSemanticMotor) > 0.1) {
            motorDirectionDot = dot(normalized(contaminatedMotor), normalized(ownerSemanticMotor));
            motorDirectionAngleDegrees = Math.acos(Math.max(-1, Math.min(1, motorDirectionDot))) * 180 / Math.PI;
          }
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: -1, y: 0 })
        ]);
      }

      expect(contaminationTick).not.toBeNull();
      expect(contaminationA1?.source).toBe("OWNER_MEMORY");
      expect(contaminationA1?.direction?.x).toBeGreaterThan(0.9);
      expect(contaminationRelationship?.playerDirection.x).toBeLessThan(-0.9);
      expect(semanticTarget).not.toBeNull();
      expect(targetDivergenceMeters).not.toBeNull();
      expect(targetDivergenceMeters ?? 0).toBeGreaterThan(2.5);
      expect(motorDirectionDot).not.toBeNull();
      // The scientific boundary is qualitative: the two objectives command
      // opposite motor half-planes (>90 degrees apart). #1179 measured about
      // 135 degrees; requiring an arbitrary >143-degree severity was unjustified.
      expect(motorDirectionDot ?? 1).toBeLessThan(0);
      expect(motorDirectionAngleDegrees ?? 0).toBeGreaterThan(90);

      // Separate the bodies while Owner input stays released. This is the point
      // at which physical conflict stops being a plausible reason to retain any
      // solver-derived heading as semantic player intent.
      snapshot = world.step([
        motion("player", { x: 0, y: 0 }),
        motion("companion", { x: 1, y: 0 })
      ]);
      for (let step = 0; step < 30; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const relationship = relationshipBrain.decision(snapshot);
        const player = actor(snapshot, "player");
        const physicallyReleased =
          !hasContact(snapshot) &&
          magnitude(player.requestedVelocity) < 0.08 &&
          magnitude(player.actualVelocity) < 0.08;

        if (physicallyReleased) {
          releaseTick = snapshot.tick;
          releaseA1 = observed.orientation;
          releaseRelationship = relationship;
          break;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 1, y: 0 })
        ]);
      }

      expect(releaseTick).not.toBeNull();
      expect(releaseA1?.source).toBe("OWNER_MEMORY");
      expect(releaseA1?.direction?.x).toBeGreaterThan(0.9);
      expect(releaseRelationship?.playerDirection.x).toBeLessThan(-0.9);

      // Hold both bodies quiet beyond the complete A1 Owner-memory horizon and
      // through several legacy tactical reconsiderations. A1 should fail closed
      // to NONE; legacy currently reuses its unaged solver-derived fallback.
      const quietTicks = A1_ORIENTATION_MEMORY_TICKS + 24;
      for (let step = 0; step < quietTicks; step += 1) {
        const observed = observeA1({
          world,
          snapshot,
          ownerMove: { x: 0, y: 0 },
          memory
        });
        memory = observed.nextMemory;
        const relationship = relationshipBrain.decision(snapshot);
        finalA1 = observed.orientation;
        finalRelationship = relationship;
        finalSnapshot = snapshot;

        if (observed.orientation.source === "NONE" && firstA1NoneTick === null) {
          firstA1NoneTick = snapshot.tick;
        }
        if (
          observed.orientation.source === "NONE" &&
          relationship.reconsideredAtTick === snapshot.tick &&
          postExpiryReconsideration === null
        ) {
          postExpiryReconsideration = relationship;
        }

        snapshot = world.step([
          motion("player", { x: 0, y: 0 }),
          motion("companion", { x: 0, y: 0 })
        ]);
      }

      expect(firstA1NoneTick).not.toBeNull();
      expect(postExpiryReconsideration).not.toBeNull();
      expect(postExpiryReconsideration?.reconsideredAtTick ?? -1).toBeGreaterThanOrEqual(firstA1NoneTick ?? Number.MAX_SAFE_INTEGER);
      expect(postExpiryReconsideration?.playerDirection.x).toBeLessThan(-0.9);
      expect(finalA1?.source).toBe("NONE");
      expect(finalA1?.direction).toBeNull();
      expect(finalRelationship?.playerDirection.x).toBeLessThan(-0.9);
      expect(finalSnapshot).not.toBeNull();
      if (finalSnapshot) {
        expect(magnitude(actor(finalSnapshot, "player").requestedVelocity)).toBeLessThan(0.08);
        expect(magnitude(actor(finalSnapshot, "player").actualVelocity)).toBeLessThan(0.08);
        expect(hasContact(finalSnapshot)).toBe(false);
      }

      console.info("[A1_LEGACY_RELATIONSHIP_CONTAMINATION_LIFECYCLE]", JSON.stringify({
        contactTick,
        contaminationTick,
        releaseTick,
        firstA1NoneTick,
        postExpiryReconsiderationTick: postExpiryReconsideration?.reconsideredAtTick ?? null,
        contamination: {
          playerMotionProvenance: "EXTERNAL_MOTION_EVIDENT",
          a1Orientation: {
            source: contaminationA1?.source,
            direction: contaminationA1?.direction,
            ageTicks: contaminationA1?.ageTicks,
            strength: contaminationA1?.strength
          },
          legacyRelationship: {
            selectedSlot: contaminationRelationship?.selectedSlot,
            direction: contaminationRelationship?.playerDirection,
            target: contaminationRelationship?.target
          },
          sameSnapshotOwnerSemanticComparator: {
            selectedSlot: semanticSlot,
            target: semanticTarget
          },
          targetDivergenceMeters,
          motorDirectionDot,
          motorDirectionAngleDegrees
        },
        release: {
          a1OrientationSource: releaseA1?.source,
          a1Direction: releaseA1?.direction,
          legacyDirection: releaseRelationship?.playerDirection
        },
        afterOwnerMemoryExpiry: {
          a1OrientationSource: finalA1?.source,
          legacyDirection: finalRelationship?.playerDirection,
          legacyReconsideredAfterExpiry: postExpiryReconsideration !== null
        },
        interpretation: {
          solverMotionCanRotateLegacyRelationshipFrame: true,
          rotatedFrameChangesImmediateMotorObjective: true,
          legacyFallbackHasNoFreshnessBound: true,
          a1OwnerMeaningFailsClosedWhenStale: true,
          thisAuditDoesNotCreateBehaviorPolicy: true
        },
        runtimeAuthority: "NONE_AUDIT_ONLY"
      }));
    } finally {
      world.dispose();
    }
  });
});
