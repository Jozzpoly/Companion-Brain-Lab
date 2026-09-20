import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import { evaluateA1H1PrimaryShadowHorizon } from "./a1-h1-primary-shadow";
import { buildA1ExplicitManualDirectCommand } from "./a1-manual-direct-authority";
import { buildA1Situation } from "./a1-situation";

function tickZeroSituation(world: LabWorld) {
  return buildA1Situation({
    snapshot: world.snapshot(),
    playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: world.latestAuthorityA0StepEvidence()
  });
}

describe("Authority-A1 P2 explicit manual DIRECT promotion seam", () => {
  it("promotes one explicitly supplied current H1 frontier proposal into one real DIRECT World command", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const situation = tickZeroSituation(world);
      const frontier = evaluateA1H1PrimaryShadowHorizon({
        world,
        situation,
        horizonSeconds: 1
      });
      expect(frontier.shadowDecisionState).toBe("SINGLETON_H1_FRONTIER");
      expect(frontier.frontierCandidates).toHaveLength(1);
      const proposalId = frontier.frontierCandidates[0]!.proposalId;
      const before = world.snapshot();

      const command = buildA1ExplicitManualDirectCommand({
        world,
        situation,
        expectedSourceTick: 0,
        horizonSeconds: 1,
        proposalId
      });

      expect(world.snapshot()).toEqual(before);
      expect(command.sourceTick).toBe(0);
      expect(command.validForOutcomeTick).toBe(1);
      expect(command.proposalId).toBe(proposalId);
      expect(command.frontierProposalIds).toEqual([proposalId]);
      expect(command.commandRepresentationError).toBeLessThanOrEqual(1e-12);
      expect(command.selectionSource).toBe("EXPLICIT_CALLER_PROPOSAL_ID_P2");
      expect(command.automaticSelectionClaim).toBe("NONE_P2");
      expect(command.horizonPolicyClaim).toBe("EXPLICIT_CALLER_SUPPLIED_HORIZON_P2");
      expect(command.authorityScopeClaim).toBe("SOURCE_TICK_TO_NEXT_WORLD_STEP_ONLY_P2");
      expect(command.runtimeAuthorityClaim).toBe("EXPLICIT_CALLER_ONE_STEP_DIRECT_P2");

      const after = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        command.motionIntent
      ]);
      const a0 = world.latestAuthorityA0StepEvidence();
      expect(after.tick).toBe(command.validForOutcomeTick);
      expect(a0?.observationTick).toBe(command.sourceTick);
      expect(a0?.outcomeTick).toBe(command.validForOutcomeTick);
      expect(a0?.companionVelocityCommand.velocity.x).toBeCloseTo(command.commandVelocity.x, 12);
      expect(a0?.companionVelocityCommand.velocity.y).toBeCloseTo(command.commandVelocity.y, 12);
    } finally {
      world.dispose();
    }
  });

  it("rejects a stale explicit source tick instead of reusing an old authorization", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const situation = tickZeroSituation(world);
      expect(() => buildA1ExplicitManualDirectCommand({
        world,
        situation,
        expectedSourceTick: 1,
        horizonSeconds: 1,
        proposalId: "stale-proposal"
      })).toThrow(/explicit request is stale/);
      expect(world.snapshot().tick).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("rejects an explicit id outside the exact current H1 frontier without fallback selection", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const situation = tickZeroSituation(world);
      expect(() => buildA1ExplicitManualDirectCommand({
        world,
        situation,
        expectedSourceTick: 0,
        horizonSeconds: 1,
        proposalId: "not-a-frontier-proposal"
      })).toThrow(/not in the exact H1 structured frontier/);
      expect(world.snapshot().tick).toBe(0);
    } finally {
      world.dispose();
    }
  });
});
