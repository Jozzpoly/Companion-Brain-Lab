import type { A1DirectCandidateRealization } from "./a1-companion-candidates";
import type { A1Situation } from "./a1-situation";
import type {
  StaticCircleTraversalResult,
  StaticTraversalOptions,
  Vec2
} from "../world/types";

const EPSILON = 1e-8;

export type A1DirectStaticQualificationG0 =
  | { status: "PASS"; reasons: readonly [] }
  | { status: "FAIL_EVIDENCE_ALIGNMENT"; reasons: readonly string[] };

export type A1DirectStaticQualificationG1 =
  | { status: "PASS_DIRECT_COMMAND_ADMISSIBLE"; reason: string }
  | { status: "FAIL_DIRECT_REALIZATION"; reason: string }
  | { status: "NOT_EVALUATED_G0_FAIL"; reason: string };

export type A1DirectStaticQualificationG2 =
  | {
      status: "PASS_STATIC_HARD_LEGALITY";
      reason: string;
      intendedEndpoint: Vec2;
      blockerLabel: null;
    }
  | {
      status: "FAIL_STATIC_HARD_LEGALITY";
      reason: string;
      intendedEndpoint: Vec2;
      blockerLabel: string;
    }
  | {
      status: "NOT_EVALUATED_UPSTREAM_FAIL";
      reason: string;
      intendedEndpoint: null;
      blockerLabel: null;
    };

export interface A1DirectStaticQualification {
  kind: "A1_DIRECT_STATIC_QUALIFICATION";
  sourceTick: number;
  horizonSeconds: number;
  candidateId: string;
  candidateFamily: A1DirectCandidateRealization["family"];
  commandVelocity: Vec2;
  companionOrigin: Vec2;
  companionRadius: number;
  g0: A1DirectStaticQualificationG0;
  g1: A1DirectStaticQualificationG1;
  g2: A1DirectStaticQualificationG2;
  gateSemantics: "A1_2D_G0_G1_G2_DIRECT_STATIC_DONOR";
  utilityClaim: "NONE_QUALIFICATION_ONLY_A1_2J";
  jointSafetyClaim: "NONE_A1_2J_QUALIFICATION_ONLY";
  cooperationClaim: "NONE_A1_2J_QUALIFICATION_ONLY";
  runtimeAuthorityClaim: "NONE_A1_2J_QUALIFICATION_ONLY";
}

export type A1DirectStaticTraversalQuery = (
  from: Vec2,
  target: Vec2,
  radius: number,
  options?: StaticTraversalOptions
) => StaticCircleTraversalResult;

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function approximatelyEqual(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPSILON;
}

function base(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
}): Omit<A1DirectStaticQualification, "g0" | "g1" | "g2"> {
  return {
    kind: "A1_DIRECT_STATIC_QUALIFICATION",
    sourceTick: input.situation.tick,
    horizonSeconds: input.realization.horizonSeconds,
    candidateId: input.realization.candidateId,
    candidateFamily: input.realization.family,
    commandVelocity: finiteVector(input.realization.commandVelocity, "A1.2j DIRECT command velocity"),
    companionOrigin: finiteVector(
      input.situation.situated.companionBody.position,
      "A1.2j companion origin"
    ),
    companionRadius: input.situation.situated.companionCapability.radius,
    gateSemantics: "A1_2D_G0_G1_G2_DIRECT_STATIC_DONOR",
    utilityClaim: "NONE_QUALIFICATION_ONLY_A1_2J",
    jointSafetyClaim: "NONE_A1_2J_QUALIFICATION_ONLY",
    cooperationClaim: "NONE_A1_2J_QUALIFICATION_ONLY",
    runtimeAuthorityClaim: "NONE_A1_2J_QUALIFICATION_ONLY"
  };
}

function g0Reasons(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
}): string[] {
  const reasons: string[] = [];
  const tick = input.situation.tick;
  if (!Number.isInteger(tick) || tick < 0) reasons.push("A1 situation tick is not a non-negative integer");
  if (input.situation.situated.tick !== tick) {
    reasons.push("situated evidence tick does not equal A1 situation tick");
  }
  if (input.situation.situated.companionBody.sourceTick !== tick) {
    reasons.push("companion body source tick does not equal A1 situation tick");
  }
  if (input.realization.sourceTick !== tick) {
    reasons.push("DIRECT realization source tick does not equal A1 situation tick");
  }
  return reasons;
}

function g1FailureReason(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
}): string | null {
  const capability = input.situation.situated.companionCapability;
  const realization = input.realization;

  if (capability.actorId !== "companion") {
    return "current MovementCapability does not belong to companion";
  }
  if (!Number.isFinite(capability.maxSpeed) || capability.maxSpeed <= 0) {
    return "current companion MovementCapability maxSpeed is not positive and finite";
  }
  if (!Number.isFinite(capability.radius) || capability.radius <= 0) {
    return "current companion MovementCapability radius is not positive and finite";
  }
  if (realization.kind !== "A1_DIRECT_CANDIDATE_REALIZATION") {
    return "A1.2j qualification accepts DIRECT realization evidence only";
  }
  if (realization.reachabilityClaim !== "DIRECT_COMMAND_ADMISSIBLE_ONLY") {
    return "DIRECT realization does not carry the qualified A1.2b reachability claim";
  }
  if (realization.worldLegalityClaim !== "NONE_A1_2B") {
    return "DIRECT realization unexpectedly claims World legality before G2";
  }
  if (!approximatelyEqual(realization.capabilityMaxSpeed, capability.maxSpeed)) {
    return "DIRECT realization maxSpeed does not match current companion MovementCapability";
  }
  if (!Number.isFinite(realization.horizonSeconds) || realization.horizonSeconds <= 0) {
    return "DIRECT realization horizon must be positive and finite";
  }

  const commandVelocity = finiteVector(realization.commandVelocity, "A1.2j DIRECT command velocity");
  if (magnitude(commandVelocity) > capability.maxSpeed + EPSILON) {
    return "DIRECT command velocity exceeds current companion MovementCapability maxSpeed";
  }

  const predictedDisplacement = finiteVector(
    realization.predictedDisplacement,
    "A1.2j DIRECT predicted displacement"
  );
  const expectedDisplacement = {
    x: commandVelocity.x * realization.horizonSeconds,
    y: commandVelocity.y * realization.horizonSeconds
  };
  if (vectorDistance(predictedDisplacement, expectedDisplacement) > EPSILON) {
    return "DIRECT predicted displacement does not match command velocity over the declared horizon";
  }

  return null;
}

function validatedStaticTraversal(input: {
  result: StaticCircleTraversalResult;
  from: Vec2;
  to: Vec2;
  radius: number;
}): StaticCircleTraversalResult {
  if (
    vectorDistance(input.result.from, input.from) > EPSILON ||
    vectorDistance(input.result.to, input.to) > EPSILON ||
    !approximatelyEqual(input.result.radius, input.radius)
  ) {
    throw new Error("A1.2j static traversal result does not align with the requested companion sweep.");
  }
  if (input.result.clear && input.result.blocker) {
    throw new Error("A1.2j static traversal cannot be clear while reporting a blocker.");
  }
  if (!input.result.clear && !input.result.blocker) {
    throw new Error("A1.2j blocked static traversal requires first-blocker evidence.");
  }
  return input.result;
}

/**
 * Qualification-only extraction of the already-qualified A1.2d DIRECT gate
 * semantics. No player future, utility row, G3 claim or runtime authority is
 * produced here.
 */
export function qualifyA1DirectCandidateStatic(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
  staticTraversal: A1DirectStaticTraversalQuery;
}): A1DirectStaticQualification {
  const common = base(input);
  const alignmentReasons = g0Reasons(input);
  if (alignmentReasons.length > 0) {
    return {
      ...common,
      g0: { status: "FAIL_EVIDENCE_ALIGNMENT", reasons: alignmentReasons },
      g1: {
        status: "NOT_EVALUATED_G0_FAIL",
        reason: "DIRECT command admissibility was not evaluated because evidence alignment failed"
      },
      g2: {
        status: "NOT_EVALUATED_UPSTREAM_FAIL",
        reason: "static legality was not evaluated because G0 failed",
        intendedEndpoint: null,
        blockerLabel: null
      }
    };
  }

  const g1Failure = g1FailureReason(input);
  if (g1Failure) {
    return {
      ...common,
      g0: { status: "PASS", reasons: [] },
      g1: { status: "FAIL_DIRECT_REALIZATION", reason: g1Failure },
      g2: {
        status: "NOT_EVALUATED_UPSTREAM_FAIL",
        reason: "static legality was not evaluated because G1 failed",
        intendedEndpoint: null,
        blockerLabel: null
      }
    };
  }

  const intendedEndpoint = add(common.companionOrigin, input.realization.predictedDisplacement);
  const traversal = validatedStaticTraversal({
    result: input.staticTraversal(
      common.companionOrigin,
      intendedEndpoint,
      common.companionRadius,
      { initialOverlap: "allow-egress" }
    ),
    from: common.companionOrigin,
    to: intendedEndpoint,
    radius: common.companionRadius
  });

  if (!traversal.clear) {
    const blockerLabel = traversal.blocker!.label;
    return {
      ...common,
      g0: { status: "PASS", reasons: [] },
      g1: {
        status: "PASS_DIRECT_COMMAND_ADMISSIBLE",
        reason: "qualified A1.2b DIRECT realization matches current companion MovementCapability"
      },
      g2: {
        status: "FAIL_STATIC_HARD_LEGALITY",
        reason: `companion hard-radius DIRECT sweep is blocked by ${blockerLabel}`,
        intendedEndpoint,
        blockerLabel
      }
    };
  }

  return {
    ...common,
    g0: { status: "PASS", reasons: [] },
    g1: {
      status: "PASS_DIRECT_COMMAND_ADMISSIBLE",
      reason: "qualified A1.2b DIRECT realization matches current companion MovementCapability"
    },
    g2: {
      status: "PASS_STATIC_HARD_LEGALITY",
      reason: "companion hard-radius DIRECT sweep is clear of static World geometry",
      intendedEndpoint,
      blockerLabel: null
    }
  };
}
