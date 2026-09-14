import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { Vec2, WorldSnapshot } from "../world/types";
import { SpatialLocomotionBrain, type SpatialMotionState } from "./spatial-locomotion";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface TrialDiagnostic {
  tick: number;
  x: number;
  y: number;
  distance: number;
  state: SpatialMotionState | null;
  candidate: string | null;
  routeStatus: string;
  routePath: string;
}

interface TrialResult {
  reached: boolean;
  snapshot: WorldSnapshot;
  states: Set<SpatialMotionState>;
  stateCounts: Record<SpatialMotionState, number>;
  staticContacts: string[];
  minDistance: number;
  candidateChanges: number;
  last: TrialDiagnostic[];
}

function diagnosticSummary(result: TrialResult): string {
  const companion = result.snapshot.actors.find((entry) => entry.id === "companion");
  return JSON.stringify({
    reached: result.reached,
    final: companion?.position ?? null,
    minDistance: Number(result.minDistance.toFixed(3)),
    candidateChanges: result.candidateChanges,
    stateCounts: result.stateCounts,
    staticContacts: result.staticContacts,
    last: result.last
  }, null, 2);
}

async function runToTarget(
  scenario: "pillar" | "doorway",
  target: Vec2,
  maxTicks = 720
): Promise<TrialResult> {
  const world = await LabWorld.create(scenario);
  const brain = new SpatialLocomotionBrain();
  const states = new Set<SpatialMotionState>();
  const stateCounts: Record<SpatialMotionState, number> = { HOLD: 0, ADVANCE: 0, SIDESTEP: 0, BACKOFF: 0 };
  const staticContacts: string[] = [];
  const last: TrialDiagnostic[] = [];
  let snapshot = world.snapshot();
  let minDistance = Number.POSITIVE_INFINITY;
  let previousCandidate: string | null = null;
  let candidateChanges = 0;

  try {
    for (let tick = 0; tick < maxTicks; tick += 1) {
      const companion = snapshot.actors.find((entry) => entry.id === "companion");
      if (!companion) throw new Error("missing companion");
      const dist = distance(companion.position, target);
      minDistance = Math.min(minDistance, dist);
      if (dist < 0.28) {
        return { reached: true, snapshot, states, stateCounts, staticContacts, minDistance, candidateChanges, last };
      }

      const plan = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      const intent = brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: plan,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      const decision = brain.debugState();
      if (decision) {
        states.add(decision.state);
        stateCounts[decision.state] += 1;
        if (previousCandidate !== null && decision.selectedCandidateId !== previousCandidate) candidateChanges += 1;
        previousCandidate = decision.selectedCandidateId;
      }

      last.push({
        tick: snapshot.tick,
        x: Number(companion.position.x.toFixed(3)),
        y: Number(companion.position.y.toFixed(3)),
        distance: Number(dist.toFixed(3)),
        state: decision?.state ?? null,
        candidate: decision?.selectedCandidateId ?? null,
        routeStatus: plan.status,
        routePath: plan.routeNodeIds.join(">") || "none"
      });
      if (last.length > 12) last.shift();

      snapshot = world.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      const after = snapshot.actors.find((entry) => entry.id === "companion");
      if (!after) throw new Error("missing companion after step");
      for (const contact of after.contacts) {
        if (contact.with !== "player" && !staticContacts.includes(contact.with)) staticContacts.push(contact.with);
      }
    }

    return { reached: false, snapshot, states, stateCounts, staticContacts, minDistance, candidateChanges, last };
  } finally {
    world.dispose();
  }
}

describe("S3 spatial locomotion authority integration", () => {
  it("actually routes and moves around the pillar without a pillar contact", async () => {
    const result = await runToTarget("pillar", { x: 4.2, y: 4 });
    if (!result.reached) throw new Error(`pillar trial did not reach target:\n${diagnosticSummary(result)}`);
    expect(result.staticContacts).not.toContain("pillar.center");
    expect(result.states.has("SIDESTEP") || result.states.has("BACKOFF")).toBe(true);
  });

  it("actually traverses the doorway opening instead of remaining blocked at the wall", async () => {
    const result = await runToTarget("doorway", { x: 4.7, y: 4 });
    if (!result.reached) throw new Error(`doorway trial did not reach target:\n${diagnosticSummary(result)}`);
    expect(result.staticContacts.some((label) => label.startsWith("door.wall"))).toBe(false);
    const companion = result.snapshot.actors.find((entry) => entry.id === "companion");
    expect(companion?.position.x ?? Number.POSITIVE_INFINITY).toBeLessThan(5.4);
  });
});
