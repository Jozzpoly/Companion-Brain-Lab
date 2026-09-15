import {
  buildSituatedEvidenceFrame,
  type SituatedEvidenceFrame
} from "../coordination/situated-evidence";
import {
  evaluateOutcomeAttribution,
  type OutcomeAttributionEvidence
} from "../coordination/outcome-attribution";
import {
  velocityCommandFromMotionIntent,
  type VelocityCommand
} from "../coordination/velocity-command";
import type { MovementCapability } from "./movement-capability";
import type { MotionIntent, WorldSnapshot } from "./types";

export interface AuthorityA0WorldStepEvidence {
  observationTick: number;
  outcomeTick: number;
  situated: SituatedEvidenceFrame;
  companionVelocityCommand: VelocityCommand;
  companionOutcomeAttribution: OutcomeAttributionEvidence;
}

function intentFor(
  intents: readonly MotionIntent[],
  actorId: MotionIntent["actorId"]
): MotionIntent {
  const value = intents.find((candidate) => candidate.actorId === actorId);
  return value
    ? { actorId, move: { ...value.move } }
    : { actorId, move: { x: 0, y: 0 } };
}

function actor(snapshot: WorldSnapshot, actorId: MotionIntent["actorId"]) {
  const value = snapshot.actors.find((candidate) => candidate.id === actorId);
  if (!value) throw new Error(`A0 World step evidence missing ${actorId} actor.`);
  return value;
}

export function buildAuthorityA0WorldStepEvidence(input: {
  before: WorldSnapshot;
  after: WorldSnapshot;
  intents: readonly MotionIntent[];
  playerCapability: MovementCapability;
  companionCapability: MovementCapability;
}): AuthorityA0WorldStepEvidence {
  if (input.after.tick !== input.before.tick + 1) {
    throw new Error("A0 World step evidence requires adjacent observation/outcome ticks.");
  }

  const playerIntent = intentFor(input.intents, "player");
  const companionIntent = intentFor(input.intents, "companion");
  const companionVelocityCommand = velocityCommandFromMotionIntent({
    intent: companionIntent,
    capability: input.companionCapability,
    sourceTick: input.before.tick
  });

  return {
    observationTick: input.before.tick,
    outcomeTick: input.after.tick,
    situated: buildSituatedEvidenceFrame({
      snapshot: input.before,
      playerControlMove: playerIntent.move,
      playerCapability: input.playerCapability,
      companionCapability: input.companionCapability
    }),
    companionVelocityCommand,
    companionOutcomeAttribution: evaluateOutcomeAttribution({
      before: actor(input.before, "companion"),
      after: actor(input.after, "companion"),
      commandedVelocity: companionVelocityCommand.velocity
    })
  };
}

export function cloneAuthorityA0WorldStepEvidence(
  value: AuthorityA0WorldStepEvidence
): AuthorityA0WorldStepEvidence {
  return {
    observationTick: value.observationTick,
    outcomeTick: value.outcomeTick,
    situated: {
      tick: value.situated.tick,
      playerControl: {
        sourceTick: value.situated.playerControl.sourceTick,
        move: { ...value.situated.playerControl.move },
        active: value.situated.playerControl.active
      },
      playerBody: {
        ...value.situated.playerBody,
        position: { ...value.situated.playerBody.position },
        requestedVelocity: { ...value.situated.playerBody.requestedVelocity },
        actualVelocity: { ...value.situated.playerBody.actualVelocity },
        contacts: [...value.situated.playerBody.contacts]
      },
      playerMotionProvenance: { ...value.situated.playerMotionProvenance },
      playerCapability: { ...value.situated.playerCapability },
      companionBody: {
        ...value.situated.companionBody,
        position: { ...value.situated.companionBody.position },
        requestedVelocity: { ...value.situated.companionBody.requestedVelocity },
        actualVelocity: { ...value.situated.companionBody.actualVelocity },
        contacts: [...value.situated.companionBody.contacts]
      },
      companionCapability: { ...value.situated.companionCapability }
    },
    companionVelocityCommand: {
      ...value.companionVelocityCommand,
      velocity: { ...value.companionVelocityCommand.velocity }
    },
    companionOutcomeAttribution: {
      ...value.companionOutcomeAttribution,
      contacts: [...value.companionOutcomeAttribution.contacts]
    }
  };
}
