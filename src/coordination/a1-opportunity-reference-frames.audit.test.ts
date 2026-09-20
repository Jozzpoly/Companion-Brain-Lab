import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ownerOrientation(tick: number, radians: number): A1RelationshipOrientationEvidence {
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction,
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { ...direction },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { ...direction },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "reference-frame audit: controlled Owner translation and orientation"
  };
}

function snapshotAt(tick: number, playerPosition: Vec2): WorldSnapshot {
  const spec = scenario("open");
  const body = (id: ActorId, position: Vec2): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Open scenario is missing ${id}.`);
    return {
      id,
      position: { ...position },
      radius: authored.radius,
      requestedVelocity: { x: 0, y: 0 },
      actualVelocity: { x: 0, y: 0 },
      motionError: 0,
      contacts: []
    };
  };
  const companion = spec.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("Open scenario is missing companion.");
  return {
    tick,
    scenarioId: "open",
    width: spec.width,
    height: spec.height,
    actors: [body("player", playerPosition), body("companion", companion.position)],
    obstacles: spec.obstacles
  };
}

async function observe(world: LabWorld, tick: number, playerPosition: Vec2, radians: number) {
  const field = sampleA1RelationshipSemanticField({ orientation: ownerOrientation(tick, radians) });
  expect(field.sampling.nearBestUtilityWindow).toBe(A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow);
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshotAt(tick, playerPosition),
    query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  expect(projection.routeCoverageComplete).toBe(true);
  expect(accessibility.coverage).toBe("COMPLETE");

  const semanticById = new Map(field.samples.map((sample) => [sample.id, sample]));
  const projectionById = new Map(projection.samples.map((sample) => [sample.sampleId, sample]));
  const candidates = accessibility.confirmedReachableSampleIds.map((sampleId) => {
    const semantic = semanticById.get(sampleId);
    const projected = projectionById.get(sampleId);
    if (!semantic || !projected) throw new Error(`Reference-frame audit lost ${sampleId}.`);
    return {
      sampleId,
      utility: semantic.utility.totalUtility,
      worldPosition: projected.worldPosition,
      relativeOffset: semantic.relativeOffset
    };
  });
  if (candidates.length === 0) throw new Error("Reference-frame audit requires reachable candidates.");
  const semanticBest = [...candidates].sort((a, b) => {
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!semanticBest) throw new Error("Reference-frame audit lost semantic best.");
  return { candidates, semanticBest };
}

function nearestToAnchor<T extends { sampleId: string; utility: number; worldPosition: Vec2 }>(candidates: readonly T[], anchor: Vec2): T {
  const candidate = [...candidates].sort((a, b) => {
    const distanceDelta = distance(a.worldPosition, anchor) - distance(b.worldPosition, anchor);
    if (Math.abs(distanceDelta) > 1e-12) return distanceDelta;
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!candidate) throw new Error("Reference-frame audit has no candidate.");
  return candidate;
}

function rotate(vector: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    x: vector.x * c - vector.y * s,
    y: vector.x * s + vector.y * c
  };
}

describe("A1 spatial commitment reference frames", () => {
  it("contrasts world-fixed, player-translated, and player-rigid anchors under translation plus rotation", async () => {
    const world = await LabWorld.create("open");
    try {
      const states = [
        { label: "base", player: { x: 3, y: 4 }, degrees: 0 },
        { label: "translate", player: { x: 3.8, y: 4 }, degrees: 0 },
        { label: "rotate", player: { x: 3, y: 4 }, degrees: 70 },
        { label: "translate+rotate", player: { x: 3.8, y: 4 }, degrees: 70 }
      ] as const;
      const initialState = states[0];
      const initial = await observe(world, 0, initialState.player, 0);
      const initialAnchor = { ...initial.semanticBest.worldPosition };
      const initialOffset = {
        x: initialAnchor.x - initialState.player.x,
        y: initialAnchor.y - initialState.player.y
      };
      const rows: Array<Record<string, unknown>> = [];

      for (const [tick, state] of states.entries()) {
        const radians = state.degrees * Math.PI / 180;
        const current = tick === 0 ? initial : await observe(world, tick, state.player, radians);
        const playerDelta = {
          x: state.player.x - initialState.player.x,
          y: state.player.y - initialState.player.y
        };
        const rotatedOffset = rotate(initialOffset, radians);
        const anchors = {
          WORLD_FIXED: { ...initialAnchor },
          PLAYER_TRANSLATED: {
            x: initialAnchor.x + playerDelta.x,
            y: initialAnchor.y + playerDelta.y
          },
          PLAYER_RIGID: {
            x: state.player.x + rotatedOffset.x,
            y: state.player.y + rotatedOffset.y
          }
        };

        for (const [frame, anchor] of Object.entries(anchors)) {
          const projected = nearestToAnchor(current.candidates, anchor);
          rows.push({
            state: state.label,
            playerPosition: state.player,
            degrees: state.degrees,
            frame,
            anchor,
            projectedSampleId: projected.sampleId,
            semanticBestSampleId: current.semanticBest.sampleId,
            pressureDistance: distance(projected.worldPosition, anchor),
            projectedUtility: projected.utility,
            semanticBestUtility: current.semanticBest.utility,
            utilityGapFromBest: current.semanticBest.utility - projected.utility,
            projectedWorldPosition: projected.worldPosition
          });
        }
      }

      expect(rows).toHaveLength(states.length * 3);
      const rigidRows = rows.filter((row) => row.frame === "PLAYER_RIGID");
      expect(rigidRows.every((row) => Number(row.pressureDistance) <= 1e-9)).toBe(true);

      console.info(`[A1_OPPORTUNITY_REFERENCE_FRAMES] ${JSON.stringify({
        samplingWindow: A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow,
        initialSampleId: initial.semanticBest.sampleId,
        initialAnchor,
        initialOffset,
        rows,
        summary: Object.fromEntries(["WORLD_FIXED", "PLAYER_TRANSLATED", "PLAYER_RIGID"].map((frame) => {
          const frameRows = rows.filter((row) => row.frame === frame);
          return [frame, {
            maxPressureDistance: Math.max(...frameRows.map((row) => Number(row.pressureDistance))),
            maxUtilityGapFromBest: Math.max(...frameRows.map((row) => Number(row.utilityGapFromBest)))
          }];
        }))
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("shows declared-frame projection is endpoint-defined while tick-local continuation is sampling-rate dependent", async () => {
    const world = await LabWorld.create("open");
    try {
      const player = { x: 3, y: 4 };
      const initial = await observe(world, 0, player, 0);
      const initialAnchor = { ...initial.semanticBest.worldPosition };
      const initialOffset = {
        x: initialAnchor.x - player.x,
        y: initialAnchor.y - player.y
      };
      const finalRadians = Math.PI;
      const finalObservation = await observe(world, 100, player, finalRadians);
      const anchors = {
        WORLD_FIXED: { ...initialAnchor },
        PLAYER_TRANSLATED: { ...initialAnchor },
        PLAYER_RIGID: {
          x: player.x + rotate(initialOffset, finalRadians).x,
          y: player.y + rotate(initialOffset, finalRadians).y
        }
      };
      const endpointFrameProjection = Object.fromEntries(Object.entries(anchors).map(([frame, anchor]) => {
        const projected = nearestToAnchor(finalObservation.candidates, anchor);
        return [frame, {
          sampleId: projected.sampleId,
          worldPosition: projected.worldPosition,
          pressureDistance: distance(projected.worldPosition, anchor),
          utilityGapFromBest: finalObservation.semanticBest.utility - projected.utility
        }];
      }));

      const traceLocalContinuation = async (degrees: readonly number[]) => {
        let committedTarget = { ...initialAnchor };
        let committedSampleId = initial.semanticBest.sampleId;
        for (let index = 1; index < degrees.length; index += 1) {
          const radians = (degrees[index] ?? 0) * Math.PI / 180;
          const current = await observe(world, index, player, radians);
          const projected = nearestToAnchor(current.candidates, committedTarget);
          committedTarget = { ...projected.worldPosition };
          committedSampleId = projected.sampleId;
        }
        return { committedTarget, committedSampleId };
      };

      const directLocal = await traceLocalContinuation([0, 180]);
      const denseLocal = await traceLocalContinuation(Array.from({ length: 37 }, (_, index) => index * 5));
      const localEndpointDivergence = distance(directLocal.committedTarget, denseLocal.committedTarget);

      expect(localEndpointDivergence).toBeGreaterThan(1);
      expect(Number(endpointFrameProjection.WORLD_FIXED?.pressureDistance)).toBeLessThanOrEqual(1e-9);
      expect(Number(endpointFrameProjection.PLAYER_TRANSLATED?.pressureDistance)).toBeLessThanOrEqual(1e-9);
      expect(Number(endpointFrameProjection.PLAYER_RIGID?.pressureDistance)).toBeLessThanOrEqual(1e-9);

      console.info(`[A1_OPPORTUNITY_REFERENCE_FRAME_RATE_INVARIANCE] ${JSON.stringify({
        initialSampleId: initial.semanticBest.sampleId,
        initialAnchor,
        endpointFrameProjection,
        localContinuation: {
          direct: directLocal,
          dense5Degree: denseLocal,
          endpointDivergence: localEndpointDivergence
        }
      })}`);
    } finally {
      world.dispose();
    }
  });
});