import { describe, expect, it } from "vitest";
import { buildA1ConcreteCommandProposalSet } from "./a1-concrete-command-proposals";
import { buildA1FixedCommandCrossFutureProfile } from "./a1-fixed-command-cross-future-profile";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import {
  buildA1FixedCommandRadialPaceProfile,
  type A1FixedCommandRadialPaceProfile
} from "./a1-radial-pace-evidence";
import { A1_DEFAULT_RELATIONSHIP_OBJECTIVE } from "./a1-relationship-utility";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, WorldSnapshot } from "../world/types";

const H1 = "OWNER_REQUEST_CONTINUATION" as const;
const DEFAULT_RADIAL = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial;

function intent(actorId: "player" | "companion", x: number): MotionIntent {
  return { actorId, move: { x, y: 0 } };
}

function hold(actorId: "player" | "companion"): MotionIntent {
  return intent(actorId, 0);
}

function situation(input: {
  world: LabWorld;
  snapshot: WorldSnapshot;
  playerIntentX: number;
}): A1Situation {
  return buildA1Situation({
    snapshot: input.snapshot,
    playerIntent: intent("player", input.playerIntentX),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: input.snapshot.tick === 0
      ? null
      : input.world.latestAuthorityA0StepEvidence()
  });
}

function profiles(input: {
  world: LabWorld;
  situation: A1Situation;
  horizonSeconds?: number;
  localAlternativeDeltaSpeed?: number;
}) {
  const futures = buildA1PlayerFutureHypotheses({
    situation: input.situation,
    horizonSeconds: input.horizonSeconds ?? 0.5,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventions = buildA1PlayerFutureInterventionPlan(futures);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation: input.situation,
    interventionPlan: interventions,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed ?? 1
  });
  const physical = proposalSet.proposals.map((proposal) => ({
    proposal,
    profile: buildA1FixedCommandCrossFutureProfile({
      world: input.world,
      situation: input.situation,
      interventionPlan: interventions,
      proposal
    })
  }));
  return { futures, interventions, proposalSet, physical };
}

function pace(
  physical: ReturnType<typeof profiles>["physical"][number]["profile"],
  state: A1Situation,
  radialObjective = DEFAULT_RADIAL
): A1FixedCommandRadialPaceProfile {
  return buildA1FixedCommandRadialPaceProfile({
    profile: physical,
    situation: state,
    radialObjective
  });
}

function h1(profile: A1FixedCommandRadialPaceProfile) {
  const entry = profile.entries.find((candidate) => candidate.futureFamily === H1);
  if (!entry) throw new Error("missing H1 PACE entry");
  return entry;
}

describe("Authority-A1.2u policy-free radial PACE evidence", () => {
  it("preserves future availability and upstream provenance instead of manufacturing PACE evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const state = situation({ world, snapshot: world.snapshot(), playerIntentX: 1 });
      const built = profiles({ world, situation: state });
      const physical = built.physical[0]!.profile;
      const result = pace(physical, state);

      expect(result.entries.map((entry) => entry.sourceStatus)).toEqual(
        physical.entries.map((entry) => entry.status)
      );
      expect(result.entries.map((entry) => entry.source)).toEqual(physical.entries);
      expect(result.paceAvailableCount).toBe(physical.rehearsedCount);
      expect(result.paceUnavailableCount).toBe(
        physical.unresolvedCount + physical.absentCount + physical.upstreamRejectedCount
      );
      for (const entry of result.entries) {
        expect(entry.radialPace === null).toBe(entry.sourceStatus !== "REHEARSED");
      }
      expect(result.relationshipUtilityUsage).toBe("NONE_A1_2U");
      expect(result.directionalObjectiveUsage).toBe("NONE_A1_2U");
      expect(result.classificationClaim).toBe("NONE_RAW_CONTINUOUS_EVIDENCE_A1_2U");
      expect(result.selectionClaim).toBe("NONE_A1_2U");
      expect(result.runtimeAuthorityClaim).toBe("NONE_A1_2U");
    } finally {
      world.dispose();
    }
  });

  it("uses preferredRadius as radial semantics while retaining sigma/weight as provenance only", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([intent("player", 1), hold("companion")]);
      const state = situation({ world, snapshot: after, playerIntentX: -1 });
      const physical = profiles({ world, situation: state }).physical[0]!.profile;
      const canonical = pace(physical, state, { preferredRadius: 1.45, sigma: 0.45, weight: 1 });
      const provenanceOnlyChange = pace(physical, state, { preferredRadius: 1.45, sigma: 2, weight: 7 });

      expect(provenanceOnlyChange.radialObjective).toEqual({ preferredRadius: 1.45, sigma: 2, weight: 7 });
      expect(provenanceOnlyChange.initialSignedRadialError).toBe(canonical.initialSignedRadialError);
      expect(provenanceOnlyChange.initialAbsoluteRadialError).toBe(canonical.initialAbsoluteRadialError);
      expect(provenanceOnlyChange.entries.map((entry) => entry.radialPace)).toEqual(
        canonical.entries.map((entry) => entry.radialPace)
      );

      const shiftedCentre = pace(physical, state, { preferredRadius: 2, sigma: 0.45, weight: 1 });
      expect(shiftedCentre.initialRadius).toBe(canonical.initialRadius);
      expect(shiftedCentre.initialSignedRadialError - canonical.initialSignedRadialError).toBeCloseTo(-0.55, 12);
      expect(shiftedCentre.radialObjectiveUsage).toBe(
        "PREFERRED_RADIUS_DRIVES_ERROR_SIGMA_WEIGHT_PRESERVED_AS_PROVENANCE_ONLY_A1_2U"
      );
    } finally {
      world.dispose();
    }
  });

  it("keeps equal-speed reversal honest: maintenance exists but the seam invents no catch-up classification", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([intent("player", 1), hold("companion")]);
      const state = situation({ world, snapshot: after, playerIntentX: -1 });
      const built = profiles({ world, situation: state });
      const rows = built.physical.map(({ proposal, profile }) => ({
        proposal,
        entry: h1(pace(profile, state)).radialPace
      })).filter((row) => row.entry !== null);

      const feedForward = rows.find((row) =>
        Math.abs(row.proposal.commandVelocity.x + 3) <= 1e-9 &&
        Math.abs(row.proposal.commandVelocity.y) <= 1e-9
      );
      if (!feedForward?.entry) throw new Error("missing -3 m/s H1 feed-forward PACE evidence");

      expect(Math.abs(feedForward.entry.absoluteRadialErrorDelta)).toBeLessThan(1e-3);
      expect(rows.some((row) => row.entry!.absoluteRadialErrorDelta > 0.05)).toBe(true);
      expect(rows.every((row) => Number.isFinite(row.entry!.absoluteRadialErrorDelta))).toBe(true);
    } finally {
      world.dispose();
    }
  });

  it("preserves sign semantics across the radial objective: too-close states can improve by opening distance", async () => {
    const world = await LabWorld.create("open");
    try {
      const horizonSeconds = 0.5;
      for (let step = 0; step < 84; step += 1) {
        world.step([hold("player"), intent("companion", -1)]);
      }
      const snapshot = world.step([hold("player"), hold("companion")]);
      const state = situation({ world, snapshot, playerIntentX: -1 });
      const built = profiles({ world, situation: state, horizonSeconds });
      const rows = built.physical.map(({ proposal, profile }) => ({
        proposal,
        entry: h1(pace(profile, state)).radialPace
      })).filter((row) => row.entry !== null);
      const best = rows.reduce((left, right) =>
        right.entry!.absoluteRadialErrorDelta < left.entry!.absoluteRadialErrorDelta ? right : left
      );

      expect(best.entry!.initialSignedRadialError).toBeLessThan(-0.4);
      expect(best.entry!.absoluteRadialErrorDelta).toBeLessThan(-0.1);
      expect(best.entry!.radialSeparationDelta).toBeGreaterThan(0.1);
      expect(best.entry!.absoluteRadialErrorRate).toBeCloseTo(
        best.entry!.absoluteRadialErrorDelta / horizonSeconds,
        8
      );
    } finally {
      world.dispose();
    }
  });

  it("rejects invalid radial-objective provenance before emitting evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const state = situation({ world, snapshot: world.snapshot(), playerIntentX: 1 });
      const physical = profiles({ world, situation: state }).physical[0]!.profile;

      expect(() => pace(physical, state, { preferredRadius: 0, sigma: 0.45, weight: 1 }))
        .toThrow(/preferredRadius must be positive and finite/i);
      expect(() => pace(physical, state, { preferredRadius: 1.45, sigma: 0, weight: 1 }))
        .toThrow(/sigma provenance must be positive and finite/i);
      expect(() => pace(physical, state, { preferredRadius: 1.45, sigma: 0.45, weight: 0 }))
        .toThrow(/weight provenance must be positive and finite/i);
    } finally {
      world.dispose();
    }
  });
});
