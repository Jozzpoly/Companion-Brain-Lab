import { describe, expect, it } from "vitest";
import {
  buildA1ConcreteCommandProposalSet,
  type A1ConcreteCommandProposal
} from "./a1-concrete-command-proposals";
import {
  buildA1FixedCommandCrossFutureProfile,
  type A1FixedCommandCrossFutureProfile
} from "./a1-fixed-command-cross-future-profile";
import { buildA1G4CrossFutureRelationGraphs } from "./a1-g4-command-relation-graph";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionIntent(x: number, y: number): MotionIntent {
  return { actorId: "companion", move: { x, y } };
}

function companionHold(): MotionIntent {
  return companionIntent(0, 0);
}

function buildDecision(input: {
  world: LabWorld;
  playerMove: Vec2;
  snapshot?: WorldSnapshot;
  horizonSeconds?: number;
  localAlternativeDeltaSpeed?: number;
}) {
  const snapshot = input.snapshot ?? input.world.snapshot();
  const horizonSeconds = input.horizonSeconds ?? 0.5;
  const situation = buildA1Situation({
    snapshot,
    playerIntent: playerIntent(input.playerMove.x, input.playerMove.y),
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0 ? null : input.world.latestAuthorityA0StepEvidence()
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventionPlan = buildA1PlayerFutureInterventionPlan(futures);
  const proposalSet = buildA1ConcreteCommandProposalSet({
    situation,
    interventionPlan,
    localAlternativeDeltaSpeed: input.localAlternativeDeltaSpeed ?? 1
  });
  return { situation, interventionPlan, proposalSet };
}

function buildProfiles(input: {
  world: LabWorld;
  decision: ReturnType<typeof buildDecision>;
}): A1FixedCommandCrossFutureProfile[] {
  return input.decision.proposalSet.proposals.map((proposal) =>
    buildA1FixedCommandCrossFutureProfile({
      world: input.world,
      situation: input.decision.situation,
      interventionPlan: input.decision.interventionPlan,
      proposal
    })
  );
}

function graphFor(
  result: ReturnType<typeof buildA1G4CrossFutureRelationGraphs>,
  family: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD"
) {
  const graph = result.graphs.find((candidate) => candidate.futureFamily === family);
  if (!graph) throw new Error(`missing ${family} graph`);
  return graph;
}

function proposalByOrigin(input: {
  decision: ReturnType<typeof buildDecision>;
  futureFamily: "OWNER_REQUEST_CONTINUATION" | "BODY_RESPONSE_CONTINUATION" | "TRANSITION_HOLD";
  seedFamily: string;
}): A1ConcreteCommandProposal {
  const proposal = input.decision.proposalSet.proposals.find((candidate) =>
    candidate.generationOrigins.some((origin) =>
      origin.futureFamily === input.futureFamily && origin.seedFamily === input.seedFamily
    )
  );
  if (!proposal) throw new Error(`missing ${input.futureFamily}/${input.seedFamily} proposal`);
  return proposal;
}

function unorderedPairMatches(
  pair: { proposalAId: string; proposalBId: string },
  a: string,
  b: string
): boolean {
  return (pair.proposalAId === a && pair.proposalBId === b) ||
    (pair.proposalAId === b && pair.proposalBId === a);
}

describe("Authority-A1.2r per-player-future G4 relation graphs", () => {
  it("preserves the exact proposal set while keeping unresolved/absent futures outside pairwise G4", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const profiles = buildProfiles({ world, decision });
      const before = world.snapshot();
      const result = buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles
      });
      const proposalIds = decision.proposalSet.proposals.map((proposal) => proposal.proposalId);

      expect(result.proposalIds).toEqual(proposalIds);
      expect(result.graphs).toHaveLength(3);
      for (const graph of result.graphs) {
        expect(graph.nodes.map((node) => node.proposalId)).toEqual(proposalIds);
        expect(graph.nodes).toHaveLength(decision.proposalSet.proposalCount);
        expect(graph.comparisonCount).toBe(
          graph.comparableProposalIds.length * (graph.comparableProposalIds.length - 1) / 2
        );
        expect(graph.comparisonCount).toBe(
          graph.preferenceEdges.length + graph.noPreferencePairs.length + graph.forcedContentionPairs.length
        );
      }

      const h2 = graphFor(result, "BODY_RESPONSE_CONTINUATION");
      expect(h2.comparableProposalIds).toHaveLength(0);
      expect(h2.comparisonCount).toBe(0);
      expect(h2.nodes.every(
        (node) => node.relationStatus === "UNAVAILABLE_PLAYER_FUTURE_UNRESOLVED"
      )).toBe(true);

      const h3 = graphFor(result, "TRANSITION_HOLD");
      expect(h3.futureId).toBeNull();
      expect(h3.comparableProposalIds).toHaveLength(0);
      expect(h3.nodes.every(
        (node) => node.relationStatus === "UNAVAILABLE_PLAYER_FUTURE_ABSENT"
      )).toBe(true);

      expect(result.futureSeparationClaim).toBe("H1_H2_H3_GRAPHS_NEVER_AGGREGATED_A1_2R");
      expect(result.robustnessAggregationClaim).toBe("NONE_A1_2R");
      expect(result.scalarScoreClaim).toBe("NONE_A1_2R");
      expect(result.selectionClaim).toBe("NONE_RELATION_GRAPH_ONLY_A1_2R");
      expect(result.runtimeAuthorityClaim).toBe("NONE_A1_2R");
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("uses one concrete node for family aliases and prefers the clear tangent proposal over the head-on pressure proposal", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        localAlternativeDeltaSpeed: 3
      });
      const hold = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "HOLD"
      });
      const pressure = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_RADIAL_INWARD"
      });
      const tangent = proposalByOrigin({
        decision,
        futureFamily: "OWNER_REQUEST_CONTINUATION",
        seedFamily: "RELATIVE_TANGENT_POSITIVE"
      });

      expect(hold.proposalId).toBe(pressure.proposalId);
      expect(pressure.generationOrigins.some((origin) => origin.seedFamily === "HOLD")).toBe(true);
      expect(pressure.generationOrigins.some(
        (origin) => origin.seedFamily === "RELATIVE_RADIAL_INWARD"
      )).toBe(true);

      const profiles = buildProfiles({ world, decision });
      const result = buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles
      });
      const h1 = graphFor(result, "OWNER_REQUEST_CONTINUATION");
      expect(h1.nodes.filter((node) => node.proposalId === pressure.proposalId)).toHaveLength(1);

      const edge = h1.preferenceEdges.find((candidate) =>
        candidate.preferredProposalId === tangent.proposalId &&
        candidate.yieldingProposalId === pressure.proposalId
      );
      expect(edge).toBeDefined();
      expect(edge?.policy.status).toBe("YIELD_PREFERRED_OVER_NEW_CONTACT");
      expect(edge?.policy.preferredCandidateId).toBe(tangent.proposalId);
      expect(h1.actionIdentityClaim).toBe("A1_2O_PROPOSAL_ID_PROPAGATED_THROUGH_A1_2P_G3_AGENCY");
      expect(h1.relationshipUtilityClaim).toBe("NONE_SEPARATE_A1_2Q_EVIDENCE_A1_2R");
      expect(h1.transitivePreferenceClaim).toBe("NONE_A1_2R");
    } finally {
      world.dispose();
    }
  });

  it("publishes forced-contention connectivity without inventing transitive preference", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const after = world.step([playerIntent(0, 0), companionIntent(-1, 0)]);
      const decision = buildDecision({
        world,
        playerMove: { x: 0, y: 0 },
        snapshot: after,
        horizonSeconds: 3,
        localAlternativeDeltaSpeed: 1
      });
      const profiles = buildProfiles({ world, decision });
      const result = buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles
      });
      const h1 = graphFor(result, "OWNER_REQUEST_CONTINUATION");

      expect(h1.forcedContentionPairs.length).toBeGreaterThan(0);
      expect(h1.forcedContentionComponents.length).toBeGreaterThan(0);
      for (const pair of h1.forcedContentionPairs) {
        const component = h1.forcedContentionComponents.find((candidate) =>
          candidate.proposalIds.includes(pair.proposalAId) &&
          candidate.proposalIds.includes(pair.proposalBId)
        );
        expect(component).toBeDefined();
        expect(component?.semantics)
          .toBe("CONNECTED_BY_PAIRWISE_FORCED_CONTENTION_ONLY_NO_TRANSITIVE_PREFERENCE");
      }
      expect(h1.preferenceEdges.every((edge) => edge.preferredProposalId !== edge.yieldingProposalId)).toBe(true);
      expect(h1.scalarScoreClaim).toBe("NONE_A1_2R");
      expect("winnerProposalId" in h1).toBe(false);
      expect("rankedProposalIds" in h1).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("keeps H1/H2/H3 as separate graphs over the same concrete action set during reversal", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const decision = buildDecision({ world, playerMove: { x: -1, y: 0 }, snapshot: after });
      const profiles = buildProfiles({ world, decision });
      const result = buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles
      });
      const ids = decision.proposalSet.proposals.map((proposal) => proposal.proposalId);
      const h1 = graphFor(result, "OWNER_REQUEST_CONTINUATION");
      const h2 = graphFor(result, "BODY_RESPONSE_CONTINUATION");
      const h3 = graphFor(result, "TRANSITION_HOLD");

      expect(h1.futureId).not.toBeNull();
      expect(h2.futureId).not.toBeNull();
      expect(h3.futureId).not.toBeNull();
      expect(new Set([h1.futureId, h2.futureId, h3.futureId]).size).toBe(3);
      expect(h1.nodes.map((node) => node.proposalId)).toEqual(ids);
      expect(h2.nodes.map((node) => node.proposalId)).toEqual(ids);
      expect(h3.nodes.map((node) => node.proposalId)).toEqual(ids);
      expect(result.futureSeparationClaim).toBe("H1_H2_H3_GRAPHS_NEVER_AGGREGATED_A1_2R");
      expect("preferenceEdges" in result).toBe(false);
      expect("forcedContentionComponents" in result).toBe(false);
      expect("winnerProposalId" in result).toBe(false);
    } finally {
      world.dispose();
    }
  });

  it("rejects incomplete proposal coverage and broken downstream proposal identity provenance", async () => {
    const world = await LabWorld.create("open");
    try {
      const decision = buildDecision({ world, playerMove: { x: 1, y: 0 } });
      const profiles = buildProfiles({ world, decision });
      expect(profiles.length).toBeGreaterThan(1);

      expect(() => buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles: profiles.slice(1)
      })).toThrow(/exactly one A1\.2p profile for every A1\.2o proposal/i);

      const first = profiles[0]!;
      const forgedEntries = first.entries.map((entry) => {
        if (entry.status !== "REHEARSED") return entry;
        return {
          ...entry,
          g3: {
            ...entry.g3,
            companionCandidateId: `${entry.g3.companionCandidateId}-wrong`
          }
        };
      });
      const forged: A1FixedCommandCrossFutureProfile = {
        ...first,
        entries: forgedEntries
      };
      expect(() => buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles: [forged, ...profiles.slice(1)]
      })).toThrow(/downstream evidence does not propagate concrete proposal identity/i);
    } finally {
      world.dispose();
    }
  });

  it("classifies every comparable pair exactly once as preference, no-preference or forced contention", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const decision = buildDecision({
        world,
        playerMove: { x: 1, y: 0 },
        horizonSeconds: 1,
        localAlternativeDeltaSpeed: 3
      });
      const result = buildA1G4CrossFutureRelationGraphs({
        proposalSet: decision.proposalSet,
        profiles: buildProfiles({ world, decision })
      });
      const h1 = graphFor(result, "OWNER_REQUEST_CONTINUATION");
      const seen = new Set<string>();
      const key = (a: string, b: string) => [a, b].sort().join("::");

      for (const edge of h1.preferenceEdges) {
        const pairKey = key(edge.preferredProposalId, edge.yieldingProposalId);
        expect(seen.has(pairKey)).toBe(false);
        seen.add(pairKey);
      }
      for (const pair of [...h1.noPreferencePairs, ...h1.forcedContentionPairs]) {
        const pairKey = key(pair.proposalAId, pair.proposalBId);
        expect(seen.has(pairKey)).toBe(false);
        seen.add(pairKey);
      }
      expect(seen.size).toBe(h1.comparisonCount);

      for (let aIndex = 0; aIndex < h1.comparableProposalIds.length; aIndex += 1) {
        for (let bIndex = aIndex + 1; bIndex < h1.comparableProposalIds.length; bIndex += 1) {
          const a = h1.comparableProposalIds[aIndex]!;
          const b = h1.comparableProposalIds[bIndex]!;
          expect(seen.has(key(a, b))).toBe(true);
          const inNoPreference = h1.noPreferencePairs.some((pair) => unorderedPairMatches(pair, a, b));
          const inForced = h1.forcedContentionPairs.some((pair) => unorderedPairMatches(pair, a, b));
          const inPreference = h1.preferenceEdges.some((edge) =>
            (edge.preferredProposalId === a && edge.yieldingProposalId === b) ||
            (edge.preferredProposalId === b && edge.yieldingProposalId === a)
          );
          expect(Number(inNoPreference) + Number(inForced) + Number(inPreference)).toBe(1);
        }
      }
    } finally {
      world.dispose();
    }
  });
});
