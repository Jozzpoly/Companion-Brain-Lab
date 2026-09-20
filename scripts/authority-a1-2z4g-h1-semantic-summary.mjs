import { mkdir, readFile, writeFile } from "node:fs/promises";

const INPUT_PATH = "artifacts/a1-2z4g-stage-attribution-trace.json";
const OUTPUT_PATH = "artifacts/a1-2z4g-h1-semantic-summary.json";
const TANGENT_FAMILIES = new Set([
  "RELATIVE_TANGENT_POSITIVE",
  "RELATIVE_TANGENT_NEGATIVE"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isH1TangentOrigin(origin) {
  return origin.futureFamily === "OWNER_REQUEST_CONTINUATION" && TANGENT_FAMILIES.has(origin.seedFamily);
}

function h1TangentOrigins(proposal) {
  return proposal.h1GenerationOrigins.filter(isH1TangentOrigin);
}

function summarizeHorizon(capture, horizon) {
  const trace = horizon.stageTrace;
  invariant(trace?.kind === "A1_H1_PRIMARY_STAGE_ATTRIBUTION_TRACE",
    `tick ${capture.tick} h=${horizon.horizonSeconds}: missing qualified stage trace.`);
  invariant(trace.sourceTick === capture.tick,
    `tick ${capture.tick} h=${horizon.horizonSeconds}: source tick drift.`);

  const tangentProposals = trace.proposals.filter((proposal) => h1TangentOrigins(proposal).length > 0);
  const families = tangentProposals.flatMap(h1TangentOrigins).map((origin) => origin.seedFamily).sort();

  invariant(tangentProposals.length === 2,
    `tick ${capture.tick} h=${horizon.horizonSeconds}: expected exactly two H1 tangent proposals, got ${tangentProposals.length}.`);
  invariant(families.includes("RELATIVE_TANGENT_POSITIVE"),
    `tick ${capture.tick} h=${horizon.horizonSeconds}: missing H1 positive tangent.`);
  invariant(families.includes("RELATIVE_TANGENT_NEGATIVE"),
    `tick ${capture.tick} h=${horizon.horizonSeconds}: missing H1 negative tangent.`);

  return {
    horizonSeconds: horizon.horizonSeconds,
    h1TangentProposalCount: tangentProposals.length,
    h1TangentFamilies: families,
    stageSupport: {
      proposal: tangentProposals.length,
      h1Rehearsed: tangentProposals.filter((proposal) => proposal.h1PhysicalStatus === "REHEARSED").length,
      comparisonEligible: tangentProposals.filter((proposal) => proposal.comparisonEligible).length,
      g4Frontier: tangentProposals.filter((proposal) => proposal.g4Frontier).length,
      structuredFrontier: tangentProposals.filter((proposal) => proposal.structuredFrontier).length
    },
    tangentProposals: tangentProposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      h1TangentOrigins: h1TangentOrigins(proposal).map((origin) => ({
        seedId: origin.seedId,
        taggedSeedId: origin.taggedSeedId,
        seedFamily: origin.seedFamily,
        desiredVelocity: { ...origin.desiredVelocity },
        commandVelocity: { ...origin.commandVelocity },
        capabilityClipped: origin.capabilityClipped
      })),
      commandVelocity: { ...proposal.commandVelocity },
      h1PhysicalStatus: proposal.h1PhysicalStatus,
      g3Decision: proposal.g3Decision,
      g3Status: proposal.g3Status,
      relationStatus: proposal.relationStatus,
      comparisonEligible: proposal.comparisonEligible,
      q: proposal.q,
      paceDelta: proposal.paceDelta,
      dominatedByProposalIds: [...proposal.dominatedByProposalIds],
      g4Frontier: proposal.g4Frontier,
      qPaceDominatedByProposalIds: [...proposal.qPaceDominatedByProposalIds],
      structuredFrontier: proposal.structuredFrontier
    }))
  };
}

const input = JSON.parse(await readFile(INPUT_PATH, "utf8"));
invariant(input.schema === "companion-brain-lab-authority-a1-2z4g-stage-attribution-trace-v1",
  `Unexpected Z4g input schema: ${input.schema}`);
invariant(input.authority === "ZERO_MOVEMENT_AUTHORITY_RESEARCH_ONLY_STAGE_ATTRIBUTION",
  `Z4g input authority changed: ${input.authority}`);
invariant(Array.isArray(input.captures) && input.captures.length === 3,
  "Expected exact Z4g captures for ticks 7, 8 and 9.");
invariant(JSON.stringify(input.captures.map((capture) => capture.tick)) === JSON.stringify([7, 8, 9]),
  `Unexpected Z4g tick sequence: ${JSON.stringify(input.captures.map((capture) => capture.tick))}`);

const captures = input.captures.map((capture) => ({
  tick: capture.tick,
  playerPosition: capture.player.position,
  companionPosition: capture.companion.position,
  companionActualVelocity: capture.companion.actualVelocity,
  baselineCompanionCommandVelocity: capture.companion.baselineCommandVelocity,
  previousA0: capture.previousA0,
  horizons: capture.horizons.map((horizon) => summarizeHorizon(capture, horizon))
}));

for (const capture of captures) {
  for (const horizon of capture.horizons) {
    invariant(horizon.stageSupport.proposal === 2,
      `tick ${capture.tick} h=${horizon.horizonSeconds}: H1 tangent proposal support drifted.`);
    invariant(horizon.stageSupport.h1Rehearsed === 2,
      `tick ${capture.tick} h=${horizon.horizonSeconds}: H1 tangent physical rehearsal support drifted.`);
    invariant(horizon.stageSupport.comparisonEligible === 2,
      `tick ${capture.tick} h=${horizon.horizonSeconds}: H1 tangent comparison eligibility drifted.`);
    invariant(horizon.stageSupport.g4Frontier === 2,
      `tick ${capture.tick} h=${horizon.horizonSeconds}: H1 tangent G4 support drifted.`);
  }
}

const tick7 = captures.find((capture) => capture.tick === 7);
const tick8 = captures.find((capture) => capture.tick === 8);
const tick9 = captures.find((capture) => capture.tick === 9);
invariant(tick7 && tick8 && tick9, "Missing required Z4g capture ticks.");
invariant(tick7.horizons.filter((horizon) => horizon.stageSupport.structuredFrontier > 0).length === 4,
  "Expected H1 tangent structured-frontier support in 4/5 tick-7 horizons.");
invariant(tick8.horizons.every((horizon) => horizon.stageSupport.structuredFrontier === 0),
  "Expected H1 tangent structured-frontier collapse in all tick-8 horizons.");
invariant(tick9.horizons.filter((horizon) => horizon.stageSupport.structuredFrontier > 0).length === 1,
  "Expected H1 tangent structured-frontier return in 1/5 tick-9 horizons.");

const summary = {
  schema: "companion-brain-lab-authority-a1-2z4g-h1-semantic-summary-v1",
  sourceSha: input.sourceSha,
  sourceArtifactSchema: input.schema,
  parentQualifiedZ4fSha: input.parentQualifiedZ4fSha,
  authority: "ZERO_MOVEMENT_AUTHORITY_RESEARCH_ONLY_H1_SEMANTIC_SUMMARY",
  semanticCorrection: {
    canonicalTangentScope: "H1_OWNER_REQUEST_CONTINUATION_ONLY",
    rawProposalIdentity: "POSITIVE_NEGATIVE_PRESERVED_SEPARATELY",
    reason: "Do not count tangent lineage inherited from H2/H3 as H1 tangent proposal support."
  },
  captures,
  conclusion: {
    seedProposalPhysicalG3G4Support: "PRESENT_FOR_BOTH_H1_TANGENTS_AT_ALL_15_TICK_HORIZON_OBSERVATIONS",
    tick8LossStage: "Q_PACE_PARETO_STRUCTURED_FRONTIER_ONLY",
    movementAuthority: "NONE"
  }
};

await mkdir("artifacts", { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log("[AUTHORITY_A1_2Z4G_H1_SEMANTIC_SUMMARY]", JSON.stringify(summary));
