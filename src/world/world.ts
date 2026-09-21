import {
  RapierPhysicalWorld,
  S0_STEP_SECONDS,
  type PhysicalRehearsalResult,
  type PhysicalRehearsalVelocityInput,
  type PhysicalWorldBodyMotionIntent
} from "../physics/rapier-physical-world";
import {
  buildAuthorityA0WorldStepEvidence,
  cloneAuthorityA0WorldStepEvidence,
  type AuthorityA0WorldStepEvidence
} from "./authority-a0-step-evidence";
import { movementCapabilityFromScenario, type MovementCapability } from "./movement-capability";
import { scenario } from "./scenarios";
import {
  initialCooperativeEpisodeSnapshot,
  resolveCooperativeEpisodeAfterPhysics,
  type CooperativeEpisodeActionAttempt,
  type CooperativeEpisodeActionOutcome,
  type CooperativeEpisodeOutcome,
  type CooperativeEpisodeRules,
  type CooperativeEpisodeSnapshot
} from "./cooperative-episode-contract";
import { SharedPressureLoop, type SharedPressureSnapshot } from "./shared-pressure";
import {
  initialSharedDangerSnapshot,
  resolveSharedDangerAfterPhysics,
  validateWorldActionAttempts,
  type SharedDangerEpisodeOutcome,
  type SharedDangerRules,
  type SharedDangerSnapshot,
  type WorldActionAttempt,
  type WorldActionOutcome
} from "./shared-danger-contract";
import type {
  ActorId,
  DirectTraversalResult,
  MotionIntent,
  ScenarioId,
  StaticCircleOccupancyResult,
  StaticCircleTraversalResult,
  StaticTraversalOptions,
  Vec2,
  WorldSnapshot,
  WorldBodyId
} from "./types";

export type AuthorityA0StepObserver = (evidence: AuthorityA0WorldStepEvidence) => void;

export const S1_SHARED_DANGER_RULES: SharedDangerRules = {
  interventionRange: 0.9,
  attackRange: 0.78,
  windupTicks: 45,
  recoveryTicks: 30
};

export const S5_COOPERATIVE_EPISODE_RULES: CooperativeEpisodeRules = {
  repelRange: 1.15,
  pressureRange: 0.82,
  pressureBreakRange: 1.3,
  pressureTicks: 60,
  drivenBackTicks: 45,
  calmTicks: 90,
  home: { x: 10.4, y: 4 },
  homeArrivalRange: 0.18
};

export interface WorldSituationStepInput {
  motionIntents: readonly MotionIntent[];
  actionAttempts?: readonly WorldActionAttempt[];
  cooperativeEpisodeAttempts?: readonly CooperativeEpisodeActionAttempt[];
}

export interface WorldSituationStepResult {
  snapshot: WorldSnapshot;
  actionOutcomes: readonly WorldActionOutcome[];
  sharedDanger: SharedDangerSnapshot | null;
  episodeOutcome: SharedDangerEpisodeOutcome;
  cooperativeEpisodeActionOutcomes: readonly CooperativeEpisodeActionOutcome[];
  cooperativeEpisode: CooperativeEpisodeSnapshot | null;
  cooperativeEpisodeOutcome: CooperativeEpisodeOutcome;
}

/** Public World-boundary timebase truth. Coordination must not import Rapier internals directly. */
export const WORLD_STEP_SECONDS = S0_STEP_SECONDS;

const authorityA0StepObservers = new Set<AuthorityA0StepObserver>();

function body(snapshot: WorldSnapshot, id: WorldBodyId) {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`World snapshot missing body: ${id}`);
  return value;
}

export function subscribeAuthorityA0StepEvidence(observer: AuthorityA0StepObserver): () => void {
  authorityA0StepObservers.add(observer);
  return () => {
    authorityA0StepObservers.delete(observer);
  };
}

function publishAuthorityA0StepEvidence(evidence: AuthorityA0WorldStepEvidence): void {
  for (const observer of authorityA0StepObservers) {
    try {
      observer(cloneAuthorityA0WorldStepEvidence(evidence));
    } catch (error) {
      console.error("[AUTHORITY_A0_OBSERVER] observer failed without affecting World authority", error);
    }
  }
}

export class LabWorld {
  private tickValue = 0;
  private latestAuthorityA0EvidenceValue: AuthorityA0WorldStepEvidence | null = null;
  private sharedDangerValue: SharedDangerSnapshot | null;
  private cooperativeEpisodeValue: CooperativeEpisodeSnapshot | null;

  private constructor(
    private readonly scenarioIdValue: ScenarioId,
    private readonly physical: RapierPhysicalWorld,
    private readonly sharedPressureLoop: SharedPressureLoop
  ) {
    this.sharedDangerValue =
      scenarioIdValue === "shared-danger" ? initialSharedDangerSnapshot() : null;
    this.cooperativeEpisodeValue =
      scenarioIdValue === "cooperative-episode"
        ? initialCooperativeEpisodeSnapshot(S5_COOPERATIVE_EPISODE_RULES)
        : null;
  }

  static async create(id: ScenarioId): Promise<LabWorld> {
    return new LabWorld(
      id,
      await RapierPhysicalWorld.create(scenario(id)),
      new SharedPressureLoop(id)
    );
  }

  dispose(): void {
    this.physical.dispose();
  }

  actorMovementCapability(actorId: ActorId): MovementCapability {
    return movementCapabilityFromScenario(scenario(this.scenarioIdValue), actorId);
  }

  latestAuthorityA0StepEvidence(): AuthorityA0WorldStepEvidence | null {
    return this.latestAuthorityA0EvidenceValue
      ? cloneAuthorityA0WorldStepEvidence(this.latestAuthorityA0EvidenceValue)
      : null;
  }

  sharedPressure(): SharedPressureSnapshot {
    return this.sharedPressureLoop.snapshot();
  }

  sharedDanger(): SharedDangerSnapshot | null {
    return this.sharedDangerValue
      ? { ...this.sharedDangerValue, interruptedBy: [...this.sharedDangerValue.interruptedBy] }
      : null;
  }

  cooperativeEpisode(): CooperativeEpisodeSnapshot | null {
    return this.cooperativeEpisodeValue
      ? {
          ...this.cooperativeEpisodeValue,
          repelledBy: [...this.cooperativeEpisodeValue.repelledBy],
          drivenBackDirection: this.cooperativeEpisodeValue.drivenBackDirection
            ? { ...this.cooperativeEpisodeValue.drivenBackDirection }
            : null
        }
      : null;
  }

  directTraversal(actorId: ActorId, target: Vec2): DirectTraversalResult {
    return this.physical.directTraversal(actorId, target);
  }

  staticCircleOccupancy(center: Vec2, radius: number): StaticCircleOccupancyResult {
    return this.physical.staticCircleOccupancy(center, radius);
  }

  staticCircleTraversal(
    from: Vec2,
    target: Vec2,
    radius: number,
    options: StaticTraversalOptions = {}
  ): StaticCircleTraversalResult {
    return this.physical.staticCircleTraversal(from, target, radius, options);
  }

  rehearseVelocitySequence(
    sequence: readonly (readonly PhysicalRehearsalVelocityInput[])[]
  ): PhysicalRehearsalResult {
    return this.physical.rehearseVelocitySequence(sequence);
  }

  step(intents: readonly MotionIntent[]): WorldSnapshot {
    return this.stepSituation({ motionIntents: intents }).snapshot;
  }

  stepSituation(input: WorldSituationStepInput): WorldSituationStepResult {
    const actionAttempts = validateWorldActionAttempts(input.actionAttempts ?? []);
    if (!this.sharedDangerValue && actionAttempts.length > 0) {
      throw new Error("World action attempts require an active shared-danger apparatus.");
    }
    const cooperativeEpisodeAttempts = input.cooperativeEpisodeAttempts ?? [];
    if (!this.cooperativeEpisodeValue && cooperativeEpisodeAttempts.length > 0) {
      throw new Error("Cooperative episode actions require the cooperative-episode scenario.");
    }

    const before = this.snapshot();
    const worldDrivenIntents = [
      ...this.sharedDangerWorldMotion(before),
      ...this.cooperativeEpisodeWorldMotion(before)
    ];
    const actors = this.physical.step(input.motionIntents, worldDrivenIntents);
    this.tickValue += 1;
    const spec = scenario(this.scenarioIdValue);
    const after: WorldSnapshot = {
      tick: this.tickValue,
      scenarioId: this.scenarioIdValue,
      width: spec.width,
      height: spec.height,
      actors,
      obstacles: spec.obstacles
    };

    let actionOutcomes: readonly WorldActionOutcome[] = [];
    let episodeOutcome: SharedDangerEpisodeOutcome = "NONE";
    if (this.sharedDangerValue) {
      const player = body(after, "player");
      const companion = body(after, "companion");
      const hostile = body(after, "hostile");
      const resolved = resolveSharedDangerAfterPhysics({
        observationTick: before.tick,
        before: this.sharedDangerValue,
        postPhysics: {
          hostilePosition: hostile.position,
          playerPosition: player.position,
          companionPosition: companion.position
        },
        attempts: actionAttempts,
        rules: S1_SHARED_DANGER_RULES
      });
      this.sharedDangerValue = resolved.after;
      actionOutcomes = resolved.actionOutcomes;
      episodeOutcome = resolved.episodeOutcome;
    }

    let cooperativeEpisodeActionOutcomes: readonly CooperativeEpisodeActionOutcome[] = [];
    let cooperativeEpisodeOutcome: CooperativeEpisodeOutcome = "NONE";
    if (this.cooperativeEpisodeValue) {
      const player = body(after, "player");
      const companion = body(after, "companion");
      const hostile = body(after, "hostile");
      const resolved = resolveCooperativeEpisodeAfterPhysics({
        observationTick: before.tick,
        before: this.cooperativeEpisodeValue,
        postPhysics: {
          hostilePosition: hostile.position,
          playerPosition: player.position,
          companionPosition: companion.position
        },
        attempts: cooperativeEpisodeAttempts,
        rules: S5_COOPERATIVE_EPISODE_RULES
      });
      this.cooperativeEpisodeValue = resolved.after;
      cooperativeEpisodeActionOutcomes = resolved.actionOutcomes;
      cooperativeEpisodeOutcome = resolved.episodeOutcome;
    }

    // Legacy Stage B evidence remains world-owned but is disabled for the
    // shared-danger scenario. It must not become the new situation authority.
    this.sharedPressureLoop.observe(after);
    this.latestAuthorityA0EvidenceValue = buildAuthorityA0WorldStepEvidence({
      before,
      after,
      intents: input.motionIntents,
      playerCapability: this.actorMovementCapability("player"),
      companionCapability: this.actorMovementCapability("companion")
    });
    if (authorityA0StepObservers.size > 0) {
      publishAuthorityA0StepEvidence(this.latestAuthorityA0EvidenceValue);
    }

    return {
      snapshot: after,
      actionOutcomes,
      sharedDanger: this.sharedDanger(),
      episodeOutcome,
      cooperativeEpisodeActionOutcomes,
      cooperativeEpisode: this.cooperativeEpisode(),
      cooperativeEpisodeOutcome
    };
  }

  private sharedDangerWorldMotion(snapshot: WorldSnapshot): PhysicalWorldBodyMotionIntent[] {
    const danger = this.sharedDangerValue;
    if (!danger) return [];

    if (danger.phase !== "APPROACHING") {
      return [{ bodyId: "hostile", move: { x: 0, y: 0 } }];
    }

    const hostile = body(snapshot, "hostile");
    const player = body(snapshot, "player");
    const delta = {
      x: player.position.x - hostile.position.x,
      y: player.position.y - hostile.position.y
    };
    const length = Math.hypot(delta.x, delta.y);
    const move = length > 1e-9
      ? { x: delta.x / length, y: delta.y / length }
      : { x: 0, y: 0 };
    return [{ bodyId: "hostile", move }];
  }

  private cooperativeEpisodeWorldMotion(snapshot: WorldSnapshot): PhysicalWorldBodyMotionIntent[] {
    const episode = this.cooperativeEpisodeValue;
    if (!episode) return [];

    if (episode.phase === "CALM" || episode.phase === "PRESSURING") {
      return [{ bodyId: "hostile", move: { x: 0, y: 0 } }];
    }

    if (episode.phase === "DRIVEN_BACK") {
      return [{
        bodyId: "hostile",
        move: episode.drivenBackDirection
          ? { ...episode.drivenBackDirection }
          : { x: 0, y: 0 }
      }];
    }

    const hostile = body(snapshot, "hostile");
    const target = episode.phase === "RESETTING"
      ? S5_COOPERATIVE_EPISODE_RULES.home
      : body(snapshot, "player").position;
    const delta = {
      x: target.x - hostile.position.x,
      y: target.y - hostile.position.y
    };
    const length = Math.hypot(delta.x, delta.y);
    const move = length > 1e-9
      ? { x: delta.x / length, y: delta.y / length }
      : { x: 0, y: 0 };
    return [{ bodyId: "hostile", move }];
  }

  snapshot(): WorldSnapshot {
    const spec = scenario(this.scenarioIdValue);
    return {
      tick: this.tickValue,
      scenarioId: this.scenarioIdValue,
      width: spec.width,
      height: spec.height,
      actors: this.physical.snapshot(),
      obstacles: spec.obstacles
    };
  }
}
