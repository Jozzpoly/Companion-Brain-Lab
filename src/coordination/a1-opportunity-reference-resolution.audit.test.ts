import { describe, expect, it } from "vitest";
import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { resolveA1SpatialCommitmentReference } from "./a1-spatial-commitment-reference";

function orientation(
  tick: number,
  direction: Vec2
): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction: { ...direction },
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
    reason: "reference-resolution audit: controlled canonical semantic orientation"
  };
}

function none(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "reference-resolution audit: no canonical semantic orientation"
  };
}

function expectPoint(actual: Vec2 | null, expected: Vec2): void {
  expect(actual).not.toBeNull();
  expect(actual?.x).toBeCloseTo(expected.x, 12);
  expect(actual?.y).toBeCloseTo(expected.y, 12);
}

describe("A1 spatial commitment reference resolution", () => {
  it("distinguishes canonical, explicitly retained, and unresolved PLAYER_RIGID bases without using world-axis sampling as semantics", () => {
    const sourcePlayer = { x: 3, y: 4 };
    const sourceAnchor = { x: 3, y: 5.45 };
    const currentPlayer = { x: 4, y: 4 };
    const sourceDirection = { x: 1, y: 0 };
    const expectedRigidAnchor = { x: 2.55, y: 4 };

    const live = resolveA1SpatialCommitmentReference({
      commitmentSourceTick: 0,
      referenceFrame: "PLAYER_RIGID",
      sourceAnchorWorldPosition: sourceAnchor,
      sourcePlayerWorldPosition: sourcePlayer,
      currentPlayerWorldPosition: currentPlayer,
      sourceSemanticDirection: sourceDirection,
      currentOrientation: orientation(1, { x: 0, y: 1 })
    });
    const retained = resolveA1SpatialCommitmentReference({
      commitmentSourceTick: 0,
      referenceFrame: "PLAYER_RIGID",
      sourceAnchorWorldPosition: sourceAnchor,
      sourcePlayerWorldPosition: sourcePlayer,
      currentPlayerWorldPosition: currentPlayer,
      sourceSemanticDirection: sourceDirection,
      currentOrientation: none(2),
      retainedCurrentSemanticBasis: {
        provenance: "RETAINED_LAST_SEMANTIC_FRAME",
        direction: { x: 0, y: 1 },
        sourceTick: 1
      }
    });
    const unresolved = resolveA1SpatialCommitmentReference({
      commitmentSourceTick: 0,
      referenceFrame: "PLAYER_RIGID",
      sourceAnchorWorldPosition: sourceAnchor,
      sourcePlayerWorldPosition: sourcePlayer,
      currentPlayerWorldPosition: currentPlayer,
      sourceSemanticDirection: sourceDirection,
      currentOrientation: none(2)
    });
    const translatedControl = resolveA1SpatialCommitmentReference({
      commitmentSourceTick: 0,
      referenceFrame: "PLAYER_TRANSLATED",
      sourceAnchorWorldPosition: sourceAnchor,
      sourcePlayerWorldPosition: sourcePlayer,
      currentPlayerWorldPosition: currentPlayer,
      currentOrientation: none(2)
    });

    expect(live.status).toBe("RESOLVED");
    expect(live.currentBasisProvenance).toBe("CANONICAL_SEMANTIC_ORIENTATION");
    expectPoint(live.resolvedAnchorWorldPosition, expectedRigidAnchor);

    expect(retained.status).toBe("RESOLVED");
    expect(retained.currentBasisProvenance).toBe("RETAINED_LAST_SEMANTIC_FRAME");
    expect(retained.currentSamplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
    expectPoint(retained.resolvedAnchorWorldPosition, expectedRigidAnchor);

    expect(unresolved.status).toBe("UNRESOLVED");
    expect(unresolved.unresolvedReason).toBe("CURRENT_BASIS_MISSING");
    expect(unresolved.currentBasisProvenance).toBe("UNRESOLVED");
    expect(unresolved.currentSamplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
    expect(unresolved.resolvedAnchorWorldPosition).toBeNull();

    expect(translatedControl.status).toBe("RESOLVED");
    expect(translatedControl.currentBasisProvenance).toBe("NOT_REQUIRED");
    expectPoint(translatedControl.resolvedAnchorWorldPosition, { x: 4, y: 5.45 });

    console.info(`[A1_SPATIAL_COMMITMENT_REFERENCE_RESOLUTION] ${JSON.stringify({
      source: {
        player: sourcePlayer,
        anchor: sourceAnchor,
        semanticDirection: sourceDirection
      },
      currentPlayer,
      live,
      retained,
      unresolved,
      translatedControl,
      interpretation: "PLAYER_RIGID requires semantic reference evidence. Canonical and explicitly retained bases can resolve the same rigid commitment, while WORLD_AXIS_SAMPLING_ONLY is intentionally insufficient and leaves the anchor unresolved."
    })}`);
  });

  it("refuses PLAYER_RIGID reconstruction when the source semantic basis itself is missing", () => {
    const evidence = resolveA1SpatialCommitmentReference({
      commitmentSourceTick: 0,
      referenceFrame: "PLAYER_RIGID",
      sourceAnchorWorldPosition: { x: 3, y: 5.45 },
      sourcePlayerWorldPosition: { x: 3, y: 4 },
      currentPlayerWorldPosition: { x: 4, y: 4 },
      currentOrientation: orientation(1, { x: 0, y: 1 })
    });

    expect(evidence.status).toBe("UNRESOLVED");
    expect(evidence.unresolvedReason).toBe("SOURCE_BASIS_MISSING");
    expect(evidence.resolvedAnchorWorldPosition).toBeNull();
  });
});
