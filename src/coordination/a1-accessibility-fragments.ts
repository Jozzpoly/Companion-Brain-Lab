import type { Vec2 } from "../world/types";
import type {
  A1RelationshipProjectionField,
  A1RelationshipProjectionSample
} from "./a1-relationship-projection";
import type {
  A1RelationshipSemanticField,
  A1RelationshipSemanticSample
} from "./a1-relationship-utility";

const EPSILON = 1e-12;

export type A1AccessibilityCoverage = "PARTIAL" | "COMPLETE";
export type A1OrientationComparability = "COMPARABLE" | "NON_COMPARABLE";

export interface A1AccessibleFragment {
  fingerprint: string;
  memberSampleIds: readonly string[];
  semanticBestSampleId: string;
  representativeSampleId: string;
  utilityMin: number;
  utilityMax: number;
  desiredFitCount: number;
  comfortErasedConnectivityCount: number;
}

export interface A1AccessibilityEvidence {
  kind: "A1_SAMPLED_ACCESSIBILITY";
  sourceTick: number;
  semanticSourceTick: number;
  coverage: A1AccessibilityCoverage;
  qualificationStrategy: A1RelationshipProjectionField["routeQualificationStrategy"];
  confirmedReachableSampleIds: readonly string[];
  hardUnreachableSampleIds: readonly string[];
  untestedSampleIds: readonly string[];
  notApplicableSampleIds: readonly string[];
  fragments: readonly A1AccessibleFragment[];
  potentialConnectorSampleIds: readonly string[];
  reason: string;
}

export interface A1FragmentContinuityMatch {
  previousFingerprint: string;
  currentFingerprint: string;
  overlapRatio: number;
  previousRepresentativeSampleId: string;
  currentRepresentativeSampleId: string;
  representativeWorldDelta: number;
}

export interface A1AccessibilityContinuityEvidence {
  kind: "A1_SAMPLED_ACCESSIBILITY_CONTINUITY";
  previousTick: number;
  currentTick: number;
  orientationComparability: A1OrientationComparability;
  semanticEligibleOverlapRatio: number | null;
  confirmedReachableOverlapRatio: number | null;
  fragmentMatches: readonly A1FragmentContinuityMatch[];
  accessibilityChanged: boolean | null;
  playerTranslationDelta: number;
  reason: string;
}

interface AlignedObservation {
  field: A1RelationshipSemanticField;
  projection: A1RelationshipProjectionField;
  accessibility: A1AccessibilityEvidence;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function circularDirectionDistance(a: number, b: number, directionCount: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, directionCount - raw);
}

export function a1RelativeSamplesAdjacent(
  field: Pick<A1RelationshipSemanticField, "sampleDirections">,
  a: Pick<A1RelationshipSemanticSample, "radiusIndex" | "directionIndex">,
  b: Pick<A1RelationshipSemanticSample, "radiusIndex" | "directionIndex">
): boolean {
  const radial = Math.abs(a.radiusIndex - b.radiusIndex);
  const angular = circularDirectionDistance(a.directionIndex, b.directionIndex, field.sampleDirections);
  if (radial === 0 && angular === 0) return false;
  return radial <= 1 && angular <= 1;
}

function semanticById(field: A1RelationshipSemanticField): Map<string, A1RelationshipSemanticSample> {
  const result = new Map(field.samples.map((sample) => [sample.id, sample]));
  if (result.size !== field.samples.length) {
    throw new Error("A1 accessibility requires unique semantic sample ids.");
  }
  return result;
}

function projectionById(field: A1RelationshipProjectionField): Map<string, A1RelationshipProjectionSample> {
  const result = new Map(field.samples.map((sample) => [sample.sampleId, sample]));
  if (result.size !== field.samples.length) {
    throw new Error("A1 accessibility requires unique projection sample ids.");
  }
  return result;
}

function validateAlignment(
  field: A1RelationshipSemanticField,
  projection: A1RelationshipProjectionField
): {
  semantic: Map<string, A1RelationshipSemanticSample>;
  projected: Map<string, A1RelationshipProjectionSample>;
} {
  if (field.sourceTick !== projection.sourceTick || projection.semanticSourceTick !== field.sourceTick) {
    throw new Error("A1 accessibility requires same-tick semantic and projection evidence.");
  }
  const semantic = semanticById(field);
  const projected = projectionById(projection);
  if (semantic.size !== projected.size) {
    throw new Error("A1 accessibility semantic/projection sample counts diverged.");
  }
  for (const id of semantic.keys()) {
    if (!projected.has(id)) throw new Error(`A1 accessibility projection is missing semantic sample ${id}.`);
  }
  return { semantic, projected };
}

function utilityOrder(
  semantic: ReadonlyMap<string, A1RelationshipSemanticSample>,
  a: string,
  b: string
): number {
  const sampleA = semantic.get(a);
  const sampleB = semantic.get(b);
  if (!sampleA || !sampleB) throw new Error("A1 accessibility lost semantic utility provenance.");
  const delta = sampleB.utility.totalUtility - sampleA.utility.totalUtility;
  if (Math.abs(delta) > EPSILON) return delta;
  if (sampleA.radiusIndex !== sampleB.radiusIndex) return sampleA.radiusIndex - sampleB.radiusIndex;
  return sampleA.directionIndex - sampleB.directionIndex;
}

function connectedComponents(input: {
  field: A1RelationshipSemanticField;
  semantic: ReadonlyMap<string, A1RelationshipSemanticSample>;
  ids: readonly string[];
}): string[][] {
  const allowed = new Set(input.ids);
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const seed of [...input.ids].sort((a, b) => utilityOrder(input.semantic, a, b))) {
    if (visited.has(seed)) continue;
    const queue = [seed];
    const members: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId) || !allowed.has(currentId)) continue;
      const current = input.semantic.get(currentId);
      if (!current) throw new Error(`A1 accessibility missing semantic sample ${currentId}.`);
      visited.add(currentId);
      members.push(currentId);

      for (const candidateId of input.ids) {
        if (visited.has(candidateId) || !allowed.has(candidateId)) continue;
        const candidate = input.semantic.get(candidateId);
        if (!candidate) throw new Error(`A1 accessibility missing semantic sample ${candidateId}.`);
        if (a1RelativeSamplesAdjacent(input.field, current, candidate)) queue.push(candidateId);
      }
    }

    members.sort((a, b) => utilityOrder(input.semantic, a, b));
    components.push(members);
  }

  return components;
}

function buildFragment(input: {
  members: readonly string[];
  semantic: ReadonlyMap<string, A1RelationshipSemanticSample>;
  projected: ReadonlyMap<string, A1RelationshipProjectionSample>;
}): A1AccessibleFragment {
  if (input.members.length === 0) throw new Error("A1 accessibility fragment requires at least one member.");
  const ordered = [...input.members].sort((a, b) => utilityOrder(input.semantic, a, b));
  const best = ordered[0];
  if (!best) throw new Error("A1 accessibility fragment lost its semantic best member.");
  const utilities = ordered.map((id) => {
    const sample = input.semantic.get(id);
    if (!sample) throw new Error(`A1 accessibility fragment missing semantic sample ${id}.`);
    return sample.utility.totalUtility;
  });
  let desiredFitCount = 0;
  let comfortErasedConnectivityCount = 0;
  for (const id of ordered) {
    const projection = input.projected.get(id);
    if (!projection) throw new Error(`A1 accessibility fragment missing projection sample ${id}.`);
    if (projection.desiredFit) desiredFitCount += 1;
    if (projection.routeTruth?.comfortErasesHardConnectivity) comfortErasedConnectivityCount += 1;
  }
  const memberSampleIds = [...ordered].sort();
  return {
    fingerprint: memberSampleIds.join("|"),
    memberSampleIds,
    semanticBestSampleId: best,
    representativeSampleId: best,
    utilityMin: Math.min(...utilities),
    utilityMax: Math.max(...utilities),
    desiredFitCount,
    comfortErasedConnectivityCount
  };
}

function potentialConnectorIds(input: {
  field: A1RelationshipSemanticField;
  semantic: ReadonlyMap<string, A1RelationshipSemanticSample>;
  reachableIds: readonly string[];
  untestedIds: readonly string[];
  fragments: readonly A1AccessibleFragment[];
}): string[] {
  if (input.untestedIds.length === 0 || input.fragments.length < 2) return [];
  const fragmentByMember = new Map<string, number>();
  input.fragments.forEach((fragment, index) => {
    for (const id of fragment.memberSampleIds) fragmentByMember.set(id, index);
  });
  const graphIds = [...input.reachableIds, ...input.untestedIds];
  const graphComponents = connectedComponents({
    field: input.field,
    semantic: input.semantic,
    ids: graphIds
  });
  const result = new Set<string>();

  for (const component of graphComponents) {
    const touchedFragments = new Set<number>();
    const unknown: string[] = [];
    for (const id of component) {
      const fragment = fragmentByMember.get(id);
      if (fragment !== undefined) touchedFragments.add(fragment);
      if (input.untestedIds.includes(id)) unknown.push(id);
    }
    if (touchedFragments.size >= 2) {
      for (const id of unknown) result.add(id);
    }
  }

  return [...result].sort();
}

export function buildA1AccessibilityEvidence(input: {
  field: A1RelationshipSemanticField;
  projection: A1RelationshipProjectionField;
}): A1AccessibilityEvidence {
  const aligned = validateAlignment(input.field, input.projection);
  const confirmedReachableSampleIds: string[] = [];
  const hardUnreachableSampleIds: string[] = [];
  const untestedSampleIds: string[] = [];
  const notApplicableSampleIds: string[] = [];

  for (const semanticSample of input.field.samples) {
    if (!semanticSample.semanticEligible) continue;
    const projected = aligned.projected.get(semanticSample.id);
    if (!projected) throw new Error(`A1 accessibility missing projection for ${semanticSample.id}.`);
    if (projected.routeQualification === "HARD_REACHABLE") confirmedReachableSampleIds.push(semanticSample.id);
    else if (projected.routeQualification === "HARD_UNREACHABLE") hardUnreachableSampleIds.push(semanticSample.id);
    else if (projected.routeQualification === "UNTESTED") untestedSampleIds.push(semanticSample.id);
    else notApplicableSampleIds.push(semanticSample.id);
  }

  const components = connectedComponents({
    field: input.field,
    semantic: aligned.semantic,
    ids: confirmedReachableSampleIds
  });
  const fragments = components
    .map((members) => buildFragment({
      members,
      semantic: aligned.semantic,
      projected: aligned.projected
    }))
    .sort((a, b) => {
      const utilityDelta = b.utilityMax - a.utilityMax;
      if (Math.abs(utilityDelta) > EPSILON) return utilityDelta;
      return a.fingerprint.localeCompare(b.fingerprint);
    });
  const potentialConnectorSampleIds = potentialConnectorIds({
    field: input.field,
    semantic: aligned.semantic,
    reachableIds: confirmedReachableSampleIds,
    untestedIds: untestedSampleIds,
    fragments
  });
  const coverage: A1AccessibilityCoverage = input.projection.routeCoverageComplete ? "COMPLETE" : "PARTIAL";

  return {
    kind: "A1_SAMPLED_ACCESSIBILITY",
    sourceTick: input.projection.sourceTick,
    semanticSourceTick: input.field.sourceTick,
    coverage,
    qualificationStrategy: input.projection.routeQualificationStrategy,
    confirmedReachableSampleIds: [...confirmedReachableSampleIds].sort(),
    hardUnreachableSampleIds: [...hardUnreachableSampleIds].sort(),
    untestedSampleIds: [...untestedSampleIds].sort(),
    notApplicableSampleIds: [...notApplicableSampleIds].sort(),
    fragments,
    potentialConnectorSampleIds,
    reason: coverage === "COMPLETE"
      ? `complete sampled accessibility evidence: ${fragments.length} confirmed fragment(s)`
      : `partial sampled accessibility evidence: ${fragments.length} confirmed fragment(s), ${untestedSampleIds.length} untested sample(s), ${potentialConnectorSampleIds.length} possible connector sample(s)`
  };
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const id of setA) if (setB.has(id)) intersection += 1;
  return intersection / union.size;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

function validateObservation(observation: AlignedObservation): void {
  validateAlignment(observation.field, observation.projection);
  if (
    observation.accessibility.sourceTick !== observation.field.sourceTick ||
    observation.accessibility.semanticSourceTick !== observation.field.sourceTick
  ) {
    throw new Error("A1 accessibility continuity requires aligned accessibility evidence.");
  }
}

function orientationRegime(field: A1RelationshipSemanticField): "DIRECTIONAL" | "DIRECTIONLESS" {
  return field.samplingBasisSource === "SEMANTIC_ORIENTATION" ? "DIRECTIONAL" : "DIRECTIONLESS";
}

function representativeWorldPosition(
  projection: A1RelationshipProjectionField,
  sampleId: string
): Vec2 {
  const sample = projection.samples.find((candidate) => candidate.sampleId === sampleId);
  if (!sample) throw new Error(`A1 continuity missing representative projection ${sampleId}.`);
  return sample.worldPosition;
}

function matchFragments(input: {
  previous: AlignedObservation;
  current: AlignedObservation;
}): A1FragmentContinuityMatch[] {
  const pairs: Array<{
    previous: A1AccessibleFragment;
    current: A1AccessibleFragment;
    overlapRatio: number;
  }> = [];
  for (const previous of input.previous.accessibility.fragments) {
    for (const current of input.current.accessibility.fragments) {
      const overlapRatio = jaccard(previous.memberSampleIds, current.memberSampleIds);
      if (overlapRatio > 0) pairs.push({ previous, current, overlapRatio });
    }
  }
  pairs.sort((a, b) => {
    const overlapDelta = b.overlapRatio - a.overlapRatio;
    if (Math.abs(overlapDelta) > EPSILON) return overlapDelta;
    const previousOrder = a.previous.fingerprint.localeCompare(b.previous.fingerprint);
    if (previousOrder !== 0) return previousOrder;
    return a.current.fingerprint.localeCompare(b.current.fingerprint);
  });

  const usedPrevious = new Set<string>();
  const usedCurrent = new Set<string>();
  const result: A1FragmentContinuityMatch[] = [];
  for (const pair of pairs) {
    if (usedPrevious.has(pair.previous.fingerprint) || usedCurrent.has(pair.current.fingerprint)) continue;
    usedPrevious.add(pair.previous.fingerprint);
    usedCurrent.add(pair.current.fingerprint);
    result.push({
      previousFingerprint: pair.previous.fingerprint,
      currentFingerprint: pair.current.fingerprint,
      overlapRatio: pair.overlapRatio,
      previousRepresentativeSampleId: pair.previous.representativeSampleId,
      currentRepresentativeSampleId: pair.current.representativeSampleId,
      representativeWorldDelta: distance(
        representativeWorldPosition(input.previous.projection, pair.previous.representativeSampleId),
        representativeWorldPosition(input.current.projection, pair.current.representativeSampleId)
      )
    });
  }
  return result;
}

export function compareA1AccessibilityContinuity(input: {
  previous: AlignedObservation;
  current: AlignedObservation;
}): A1AccessibilityContinuityEvidence {
  validateObservation(input.previous);
  validateObservation(input.current);
  if (input.current.field.sourceTick <= input.previous.field.sourceTick) {
    throw new Error("A1 accessibility continuity requires forward World time.");
  }

  const orientationComparability: A1OrientationComparability =
    orientationRegime(input.previous.field) === orientationRegime(input.current.field)
      ? "COMPARABLE"
      : "NON_COMPARABLE";
  const comparable = orientationComparability === "COMPARABLE";
  const bothComplete =
    input.previous.accessibility.coverage === "COMPLETE" &&
    input.current.accessibility.coverage === "COMPLETE";
  const semanticEligibleOverlapRatio = comparable
    ? jaccard(input.previous.field.semanticEligibleSampleIds, input.current.field.semanticEligibleSampleIds)
    : null;
  const confirmedReachableOverlapRatio = comparable
    ? jaccard(
      input.previous.accessibility.confirmedReachableSampleIds,
      input.current.accessibility.confirmedReachableSampleIds
    )
    : null;
  const fragmentMatches = comparable ? matchFragments(input) : [];
  const accessibilityChanged = comparable && bothComplete
    ? !sameSet(
      input.previous.accessibility.confirmedReachableSampleIds,
      input.current.accessibility.confirmedReachableSampleIds
    )
    : null;
  const playerTranslationDelta = distance(
    input.previous.projection.playerPosition,
    input.current.projection.playerPosition
  );

  return {
    kind: "A1_SAMPLED_ACCESSIBILITY_CONTINUITY",
    previousTick: input.previous.field.sourceTick,
    currentTick: input.current.field.sourceTick,
    orientationComparability,
    semanticEligibleOverlapRatio,
    confirmedReachableOverlapRatio,
    fragmentMatches,
    accessibilityChanged,
    playerTranslationDelta,
    reason: !comparable
      ? "semantic orientation regime changed; relative-lattice continuity is intentionally non-comparable"
      : !bothComplete
        ? "relative semantics are comparable but accessibility change remains unknown under partial route coverage"
        : accessibilityChanged
          ? "complete comparable sampled accessibility changed"
          : "complete comparable sampled accessibility remained stable"
  };
}
