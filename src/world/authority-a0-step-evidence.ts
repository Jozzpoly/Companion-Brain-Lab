import {
  bodyEvidenceFromSnapshot,
  buildSituatedEvidenceFrame,
  classifyObservedPlayerMotion,
  type PlayerBodyEvidence,
  type PlayerMotionProvenanceEvidence,
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
import type { MotionIntent, ScenarioId, WorldSnapshot } from "./types";

export interface AuthorityA0WorldStepEvidence {
  scenarioId: ScenarioId;
  observationTick: number;
  outcomeTick: number;
  situated: SituatedEvidenceFrame;
  playerOutcomeBody: PlayerBodyEvidence;
  playerOutcomeMotionProvenance: PlayerMotionProvenanceEvidence;
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

function cloneBody(value: PlayerBodyEvidence): PlayerBodyEvidence {
  return {
    ...value,
    position: { ...value.position },
    requestedVelocity: { ...value.requestedVelocity },
    actualVelocity: { ...value.actualVelocity },
    contacts: [...value.contacts]
  };
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
  if (input.after.scenarioId !== input.before.scenarioId) {
    throw new Error("A0 World step evidence requires one scenario across observation and outcome.");
  }

  const playerIntent = intentFor(input.intents, "player");
  const companionIntent = intentFor(input.intents, "companion");
  const companionVelocityCommand = velocityCommandFromMotionIntent({
    intent: companionIntent,
    capability: input.companionCapability,
    sourceTick: input.before.tick
  });
  const playerOutcomeBody = bodyEvidenceFromSnapshot(input.after, "player");

  return {
    scenarioId: input.before.scenarioId,
    observationTick: input.before.tick,
    outcomeTick: input.after.tick,
    situated: buildSituatedEvidenceFrame({
      snapshot: input.before,
      playerControlMove: playerIntent.move,
      playerCapability: input.playerCapability,
      companionCapability: input.companionCapability
    }),
    playerOutcomeBody,
    playerOutcomeMotionProvenance: classifyObservedPlayerMotion(playerOutcomeBody),
    companionVelocityCommand,
    companionOutcomeAttribution: evaluateOutcomeAttribution({
      before: actor(input.before, "companion"),
      after: actor(input.after, "companion"),
      observationTick: input.before.tick,
      outcomeTick: input.after.tick,
      commandedVelocity: companionVelocityCommand.velocity
    })
  };
}

export function cloneAuthorityA0WorldStepEvidence(
  value: AuthorityA0WorldStepEvidence
): AuthorityA0WorldStepEvidence {
  return {
    scenarioId: value.scenarioId,
    observationTick: value.observationTick,
    outcomeTick: value.outcomeTick,
    situated: {
      tick: value.situated.tick,
      playerControl: {
        sourceTick: value.situated.playerControl.sourceTick,
        move: { ...value.situated.playerControl.move },
        active: value.situated.playerControl.active
      },
      playerBody: cloneBody(value.situated.playerBody),
      playerMotionProvenance: { ...value.situated.playerMotionProvenance },
      playerCapability: { ...value.situated.playerCapability },
      companionBody: cloneBody(value.situated.companionBody),
      companionCapability: { ...value.situated.companionCapability }
    },
    playerOutcomeBody: cloneBody(value.playerOutcomeBody),
    playerOutcomeMotionProvenance: { ...value.playerOutcomeMotionProvenance },
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
