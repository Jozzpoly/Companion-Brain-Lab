import {
  qualifyA1DirectCandidateStatic,
  type A1DirectStaticQualification
} from "./a1-direct-static-qualification";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import {
  buildA1SpatialCommitmentDirectRealization,
  type A1SpatialCommitmentDirectRealizationEvidence
} from "./a1-spatial-commitment-direct-realization";
import type {
  A1SpatialCommitmentPlayerFutureSetEvidence,
  A1SpatialCommitmentPlayerFutureSetEntry
} from "./a1-spatial-commitment-player-future-set";
import type { ActorSnapshot, Vec2 } from "../world/types";
import type { LabWorld } from "../world/world";

const EPSILON = 1e-9;

export type A1SpatialCommitmentJointFutureSetStatus =
  | "REFERENCE_UNRESOLVED"
  | "COMPANION_DIRECT_STATIC_BLOCKED"
  | "REHEARSED";

export interface A1SpatialCommitmentJointFutureRehearsedEntry {
  futureId: string;
  futureFamily: A1SpatialCommitmentPlayerFutureSetEntry["futureFamily"];
  status: "REHEARSED";
  anchorOccupancyStatus: "SAMPLED_PLAYER_FUTURE_OVERLAP" | "NO_SAMPLED_PLAYER_FUTURE_OVERLAP";
  contactFrameCount: number;
  firstContactStepIndex: number | null;
  minSampledCenterDistance: number;
  finalPlayerDistanceToAnchor: number;
  finalCompanionDistanceToAnchor: number;
}

export interface A1SpatialCommitmentJointFutureCausalUnresolvedEntry {
  futureId: string;
  futureFamily: A1SpatialCommitmentPlayerFutureSetEntry["futureFamily"];
  status: "CAUSAL_UNRESOLVED";
  unresolvedReason: string;
  anchorOccupancyStatus: null;
}

export interface A1SpatialCommitmentJointFutureReferenceUnresolvedEntry {
  futureId: string;
  futureFamily: A1SpatialCommitmentPlayerFutureSetEntry["futureFamily"];
  status: "REFERENCE_UNRESOLVED";
  anchorOccupancyStatus: "REFERENCE_UNRESOLVED";
}

export interface A1SpatialCommitmentJointFutureStaticBlockedEntry {
  futureId: string;
  futureFamily: A1SpatialCommitmentPlayerFutureSetEntry["futureFamily"];
  status: "COMPANION_DIRECT_STATIC_BLOCKED";
  anchorOccupancyStatus:
    | "SAMPLED_PLAYER_FUTURE_OVERLAP"
    | "NO_SAMPLED_PLAYER_FUTURE_OVERLAP"
    | "REFERENCE_UNRESOLVED";
  staticBlockStatus: Exclude<
    A1DirectStaticQualification["g2"]["status"],
    "PASS_STATIC_HARD_LEGALITY"
  >;
  staticBlockReason: string;
  blockerLabel: string | null;
}

export type A1SpatialCommitmentJointFutureEntry =
  | A1SpatialCommitmentJointFutureRehearsedEntry
  | A1SpatialCommitmentJointFutureCausalUnresolvedEntry
  | A1SpatialCommitmentJointFutureReferenceUnresolvedEntry
  | A1SpatialCommitmentJointFutureStaticBlockedEntry;

export interface A1SpatialCommitmentJointFutureSetEvidence {
  kind: "A1_SPATIAL_COMMITMENT_JOINT_FUTURE_SET_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  status: A1SpatialCommitmentJointFutureSetStatus;
  horizonSeconds: number;
  directRealization: A1SpatialCommitmentDirectRealizationEvidence;
  staticQualification: A1DirectStaticQualification | null;
  futures: readonly A1SpatialCommitmentJointFutureEntry[];
  contactFutureIds: readonly string[];
  noContactRehearsedFutureIds: readonly string[];
  causalUnresolvedFutureIds: readonly string[];
  referenceUnresolvedFutureIds: readonly string[];
  staticBlockedFutureIds: readonly string[];
  contactEvidenceClaim: "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY";
  noContactSafetyClaim: "NONE_NO_CONTACT_DOES_NOT_ESTABLISH_GENERAL_SAFETY";
  anchorOccupancyEquivalenceClaim: "NONE_ANCHOR_OVERLAP_IS_NOT_JOINT_CONTACT";
  cooperationPolicyClaim: "NONE_EVIDENCE_ONLY";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
}

function actor(
  actors: readonly ActorSnapshot[],
  id: "player" | "companion"
): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1 commitment joint future is missing ${id} body evidence.`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function aligned(input: {
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  futureSet: A1SpatialCommitmentPlayerFutureSetEvidence;
}): void {
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.futureSet.sourceTick !== input.situation.tick ||
    input.futureSet.commitmentSourceTick !== input.fit.commitmentSourceTick
  ) {
    throw new Error("A1 commitment joint future requires aligned fit, situation and player-future set.");
  }
  if (
    input.futureSet.aggregationClaim !== "NONE_PRESERVE_DISTINCT_PLAYER_FUTURES" ||
    input.futureSet.selectionClaim !== "NONE" ||
    input.futureSet.runtimeAuthorityClaim !== "NONE"
  ) {
    throw new Error("A1 commitment joint future refuses aggregated, selected or authoritative player-future evidence.");
  }
}

export function buildA1SpatialCommitmentJointFutureSetEvidence(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  playerFutureSet: A1SpatialCommitmentPlayerFutureSetEvidence;
}): A1SpatialCommitmentJointFutureSetEvidence {
  aligned({
    fit: input.fit,
    situation: input.situation,
    futureSet: input.playerFutureSet
  });
  const directRealization = buildA1SpatialCommitmentDirectRealization({
    fit: input.fit,
    situation: input.situation,
    horizonSeconds: input.playerFutureSet.horizonSeconds
  });
  const common = {
    kind: "A1_SPATIAL_COMMITMENT_JOINT_FUTURE_SET_EVIDENCE" as const,
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    horizonSeconds: input.playerFutureSet.horizonSeconds,
    directRealization,
    contactEvidenceClaim: "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY" as const,
    noContactSafetyClaim: "NONE_NO_CONTACT_DOES_NOT_ESTABLISH_GENERAL_SAFETY" as const,
    anchorOccupancyEquivalenceClaim: "NONE_ANCHOR_OVERLAP_IS_NOT_JOINT_CONTACT" as const,
    cooperationPolicyClaim: "NONE_EVIDENCE_ONLY" as const,
    selectionClaim: "NONE" as const,
    runtimeAuthorityClaim: "NONE" as const
  };

  if (directRealization.status === "REFERENCE_UNRESOLVED" || !directRealization.realization) {
    const futures: A1SpatialCommitmentJointFutureEntry[] = input.playerFutureSet.futures.map((future) =>
      future.interventionStatus === "UNRESOLVED"
        ? {
            futureId: future.futureId,
            futureFamily: future.futureFamily,
            status: "CAUSAL_UNRESOLVED",
            unresolvedReason: future.unresolvedReason,
            anchorOccupancyStatus: null
          }
        : {
            futureId: future.futureId,
            futureFamily: future.futureFamily,
            status: "REFERENCE_UNRESOLVED",
            anchorOccupancyStatus: "REFERENCE_UNRESOLVED"
          }
    );
    return {
      ...common,
      status: "REFERENCE_UNRESOLVED",
      staticQualification: null,
      futures,
      contactFutureIds: [],
      noContactRehearsedFutureIds: [],
      causalUnresolvedFutureIds: futures.filter((value) => value.status === "CAUSAL_UNRESOLVED").map((value) => value.futureId),
      referenceUnresolvedFutureIds: futures.filter((value) => value.status === "REFERENCE_UNRESOLVED").map((value) => value.futureId),
      staticBlockedFutureIds: []
    };
  }

  const qualification = qualifyA1DirectCandidateStatic({
    situation: input.situation,
    realization: directRealization.realization,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });

  if (qualification.g2.status !== "PASS_STATIC_HARD_LEGALITY") {
    const blockedG2 = qualification.g2;
    const futures: A1SpatialCommitmentJointFutureEntry[] =
      input.playerFutureSet.futures.map((future) =>
        future.interventionStatus === "UNRESOLVED"
          ? {
              futureId: future.futureId,
              futureFamily: future.futureFamily,
              status: "CAUSAL_UNRESOLVED" as const,
              unresolvedReason: future.unresolvedReason,
              anchorOccupancyStatus: null
            }
          : {
              futureId: future.futureId,
              futureFamily: future.futureFamily,
              status: "COMPANION_DIRECT_STATIC_BLOCKED" as const,
              anchorOccupancyStatus: future.occupancy.status,
              staticBlockStatus: blockedG2.status,
              staticBlockReason: blockedG2.reason,
              blockerLabel: blockedG2.blockerLabel
            }
      );
    return {
      ...common,
      status: "COMPANION_DIRECT_STATIC_BLOCKED",
      staticQualification: qualification,
      futures,
      contactFutureIds: [],
      noContactRehearsedFutureIds: [],
      causalUnresolvedFutureIds: futures
        .filter((value) => value.status === "CAUSAL_UNRESOLVED")
        .map((value) => value.futureId),
      referenceUnresolvedFutureIds: [],
      staticBlockedFutureIds: futures
        .filter((value) => value.status === "COMPANION_DIRECT_STATIC_BLOCKED")
        .map((value) => value.futureId)
    };
  }

  const sourcePlayer = input.situation.situated.playerBody.position;
  const sourceCompanion = input.situation.situated.companionBody.position;
  const anchor = directRealization.anchorWorldPosition;
  if (!anchor) throw new Error("A1 commitment joint future lost resolved anchor.");

  const entries: A1SpatialCommitmentJointFutureEntry[] = [];
  for (const future of input.playerFutureSet.futures) {
    if (future.interventionStatus === "UNRESOLVED") {
      entries.push({
        futureId: future.futureId,
        futureFamily: future.futureFamily,
        status: "CAUSAL_UNRESOLVED",
        unresolvedReason: future.unresolvedReason,
        anchorOccupancyStatus: null
      });
      continue;
    }
    if (future.occupancy.status === "REFERENCE_UNRESOLVED") {
      throw new Error("A1 commitment joint future found reference-unresolved occupancy under resolved commitment realization.");
    }
    const intervention = input.playerFutureSet.sourcePlan.interventions.find(
      (candidate) => candidate.futureId === future.futureId
    );
    if (!intervention || intervention.status !== "REHEARSABLE") {
      throw new Error(`A1 commitment joint future lost rehearsable intervention ${future.futureId}.`);
    }
    const rehearsal = rehearseA1DirectJointPhysicalFuture({
      world: input.world,
      situation: input.situation,
      playerIntervention: intervention,
      companionRealization: directRealization.realization
    });

    let minSampledCenterDistance = distance(sourcePlayer, sourceCompanion);
    let contactFrameCount = 0;
    let firstContactStepIndex: number | null = null;
    for (const frame of rehearsal.physical.frames) {
      const player = actor(frame.actors, "player");
      const companion = actor(frame.actors, "companion");
      minSampledCenterDistance = Math.min(
        minSampledCenterDistance,
        distance(player.position, companion.position)
      );
      const reciprocalContact =
        player.contacts.some((contact) => contact.with === "companion") &&
        companion.contacts.some((contact) => contact.with === "player");
      if (reciprocalContact) {
        contactFrameCount += 1;
        firstContactStepIndex ??= frame.stepIndex;
      }
    }
    const final = rehearsal.physical.frames.at(-1);
    if (!final) throw new Error("A1 commitment joint future rehearsal returned no frames.");
    const finalPlayer = actor(final.actors, "player");
    const finalCompanion = actor(final.actors, "companion");

    entries.push({
      futureId: future.futureId,
      futureFamily: future.futureFamily,
      status: "REHEARSED",
      anchorOccupancyStatus: future.occupancy.status,
      contactFrameCount,
      firstContactStepIndex,
      minSampledCenterDistance,
      finalPlayerDistanceToAnchor: distance(finalPlayer.position, anchor),
      finalCompanionDistanceToAnchor: distance(finalCompanion.position, anchor)
    });
  }

  const rehearsed = entries.filter(
    (value): value is A1SpatialCommitmentJointFutureRehearsedEntry =>
      value.status === "REHEARSED"
  );
  const contactFutureIds = rehearsed
    .filter((value) => value.contactFrameCount > 0)
    .map((value) => value.futureId);
  const noContactRehearsedFutureIds = rehearsed
    .filter((value) => value.contactFrameCount === 0)
    .map((value) => value.futureId);

  return {
    ...common,
    status: "REHEARSED",
    staticQualification: qualification,
    futures: entries,
    contactFutureIds,
    noContactRehearsedFutureIds,
    causalUnresolvedFutureIds: entries
      .filter((value) => value.status === "CAUSAL_UNRESOLVED")
      .map((value) => value.futureId),
    referenceUnresolvedFutureIds: [],
    staticBlockedFutureIds: [],
  };
}
