import type {
  A1PlayerFutureIntervention,
  A1PlayerFutureInterventionPlan,
  A1UnresolvedPlayerFutureIntervention
} from "./a1-player-future-interventions";
import { rehearseA1PlayerFutureIntervention } from "./a1-player-future-rehearsal";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import {
  buildA1SpatialCommitmentPlayerFutureOccupancyEvidence,
  type A1SpatialCommitmentPlayerFutureOccupancyEvidence
} from "./a1-spatial-commitment-player-future-occupancy";
import type { WorldSnapshot } from "../world/types";
import type { LabWorld } from "../world/world";

const ALIGNMENT_EPSILON = 1e-9;

export interface A1SpatialCommitmentRehearsedPlayerFutureEntry {
  futureId: string;
  futureFamily: A1PlayerFutureIntervention["futureFamily"];
  interventionStatus: "REHEARSABLE";
  causalMeaning: Exclude<A1PlayerFutureIntervention["causalMeaning"], null>;
  unresolvedReason: null;
  occupancy: A1SpatialCommitmentPlayerFutureOccupancyEvidence;
}

export interface A1SpatialCommitmentUnresolvedPlayerFutureEntry {
  futureId: string;
  futureFamily: A1PlayerFutureIntervention["futureFamily"];
  interventionStatus: "UNRESOLVED";
  causalMeaning: null;
  unresolvedReason: A1UnresolvedPlayerFutureIntervention["unresolvedReason"];
  occupancy: null;
}

export type A1SpatialCommitmentPlayerFutureSetEntry =
  | A1SpatialCommitmentRehearsedPlayerFutureEntry
  | A1SpatialCommitmentUnresolvedPlayerFutureEntry;

export interface A1SpatialCommitmentPlayerFutureSetEvidence {
  kind: "A1_SPATIAL_COMMITMENT_PLAYER_FUTURE_SET_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  horizonSeconds: number;
  futures: readonly A1SpatialCommitmentPlayerFutureSetEntry[];
  futureCount: number;
  rehearsedCount: number;
  causalUnresolvedCount: number;
  aggregationClaim: "NONE_PRESERVE_DISTINCT_PLAYER_FUTURES";
  probabilityClaim: "NONE_COUNTERFACTUAL_SET_NOT_FORECAST_DISTRIBUTION";
  selectionClaim: "NONE";
  fallbackSubstitutionClaim: "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT";
  liveWorldMutationClaim: "NONE_QUERY_ONLY_REHEARSALS";
  runtimeAuthorityClaim: "NONE";
  sourcePlan: A1PlayerFutureInterventionPlan;
}

function assertSnapshotMatchesLiveWorld(
  snapshot: WorldSnapshot,
  live: WorldSnapshot
): void {
  if (snapshot.tick !== live.tick || snapshot.scenarioId !== live.scenarioId) {
    throw new Error("A1 player-future set requires the supplied snapshot to match live World tick/scenario.");
  }

  for (const id of ["player", "companion"] as const) {
    const expected = snapshot.actors.find((value) => value.id === id);
    const actual = live.actors.find((value) => value.id === id);
    if (!expected || !actual) {
      throw new Error(`A1 player-future set is missing ${id} body evidence.`);
    }
    if (
      Math.hypot(
        expected.position.x - actual.position.x,
        expected.position.y - actual.position.y
      ) > ALIGNMENT_EPSILON ||
      Math.abs(expected.radius - actual.radius) > ALIGNMENT_EPSILON
    ) {
      throw new Error(`A1 player-future set supplied ${id} body does not match live World state.`);
    }
  }
}

function validatePlan(
  fit: A1SpatialCommitmentFitEvidence,
  snapshot: WorldSnapshot,
  plan: A1PlayerFutureInterventionPlan
): void {
  if (
    fit.sourceTick !== snapshot.tick ||
    fit.sourceTick !== plan.sourceTick
  ) {
    throw new Error("A1 player-future set requires same-tick fit, snapshot and intervention plan.");
  }
  if (
    plan.aggregationClaim !== "NONE_PRESERVE_H1_H2_H3_A1_2H" ||
    plan.fallbackSubstitutionClaim !== "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT_A1_2H" ||
    plan.physicsExecutionClaim !== "NONE_A1_2H_PURE_CONTRACT" ||
    plan.commandAuthorityClaim !== "NONE_A1_2H" ||
    plan.runtimeAuthorityClaim !== "NONE_A1_2H"
  ) {
    throw new Error("A1 player-future set refuses a plan with aggregation, substitution, physics or runtime authority.");
  }
  if (plan.interventions.length !== plan.futureCount) {
    throw new Error("A1 player-future set intervention count does not match plan futureCount.");
  }

  const ids = new Set<string>();
  for (const intervention of plan.interventions) {
    if (ids.has(intervention.futureId)) {
      throw new Error(`A1 player-future set refuses duplicate future id: ${intervention.futureId}.`);
    }
    ids.add(intervention.futureId);
    if (intervention.sourceTick !== plan.sourceTick) {
      throw new Error(`A1 player-future set future ${intervention.futureId} is stale relative to its plan.`);
    }
    if (Math.abs(intervention.horizonSeconds - plan.horizonSeconds) > ALIGNMENT_EPSILON) {
      throw new Error(`A1 player-future set future ${intervention.futureId} horizon is misaligned.`);
    }
  }
}

export function buildA1SpatialCommitmentPlayerFutureSetEvidence(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  snapshot: WorldSnapshot;
  plan: A1PlayerFutureInterventionPlan;
}): A1SpatialCommitmentPlayerFutureSetEvidence {
  validatePlan(input.fit, input.snapshot, input.plan);
  assertSnapshotMatchesLiveWorld(input.snapshot, input.world.snapshot());

  const futures = input.plan.interventions.map(
    (intervention): A1SpatialCommitmentPlayerFutureSetEntry => {
      if (intervention.status === "UNRESOLVED") {
        return {
          futureId: intervention.futureId,
          futureFamily: intervention.futureFamily,
          interventionStatus: "UNRESOLVED",
          causalMeaning: null,
          unresolvedReason: intervention.unresolvedReason,
          occupancy: null
        };
      }

      const rehearsal = rehearseA1PlayerFutureIntervention({
        world: input.world,
        intervention
      });
      const occupancy = buildA1SpatialCommitmentPlayerFutureOccupancyEvidence({
        fit: input.fit,
        snapshot: input.snapshot,
        rehearsal
      });
      return {
        futureId: intervention.futureId,
        futureFamily: intervention.futureFamily,
        interventionStatus: "REHEARSABLE",
        causalMeaning: intervention.causalMeaning,
        unresolvedReason: null,
        occupancy
      };
    }
  );

  const rehearsedCount = futures.filter(
    (value) => value.interventionStatus === "REHEARSABLE"
  ).length;
  const causalUnresolvedCount = futures.length - rehearsedCount;

  if (
    rehearsedCount !== input.plan.rehearsableCount ||
    causalUnresolvedCount !== input.plan.unresolvedCount
  ) {
    throw new Error("A1 player-future set changed intervention-plan resolved/unresolved counts.");
  }

  return {
    kind: "A1_SPATIAL_COMMITMENT_PLAYER_FUTURE_SET_EVIDENCE",
    sourceTick: input.fit.sourceTick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    horizonSeconds: input.plan.horizonSeconds,
    futures,
    futureCount: futures.length,
    rehearsedCount,
    causalUnresolvedCount,
    aggregationClaim: "NONE_PRESERVE_DISTINCT_PLAYER_FUTURES",
    probabilityClaim: "NONE_COUNTERFACTUAL_SET_NOT_FORECAST_DISTRIBUTION",
    selectionClaim: "NONE",
    fallbackSubstitutionClaim: "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT",
    liveWorldMutationClaim: "NONE_QUERY_ONLY_REHEARSALS",
    runtimeAuthorityClaim: "NONE",
    sourcePlan: structuredClone(input.plan)
  };
}
