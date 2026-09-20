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
  type WorldBodyId
} from "./types";

export type AuthorityA0StepObserver = (evidence: AuthorityA0WorldStepEvidence) => void;

export const S1_SHARED_DANGER_RULES: SharedDangerRules = {
  interventionRange: 0.9,
  attackRange: 0.78,
  windupTicks: 45,
  recoveryTicks: 30
};

export interface WorldSituationStepInput {
  motionIntents: readonly MotionIntent[];
  actionAttempts?: readonly WorldActionAttempt[];
}

export interface WorldSituationStepResult {
  snapshot: WorldSnapshot;
  actionOutcomes: readonly WorldActionOutcome[];
  sharedDanger: SharedDangerSnapshot | null;
  episodeOutcome: SharedDangerEpisodeOutcome;
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

  private constructor(
    private readonly scenarioIdValue: ScenarioId,
    private readonly physical: RapierPhysicalWorld,
    private readonly sharedPressureLoop: SharedPressureLoop
  ) {
    this.sharedDangerValue =
      scenarioIdValue === "shared-danger" ? initialSharedDangerSnapshot() : null;
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

    const before = this.snapshot();
    const worldDrivenIntents = this.sharedDangerWorldMotion(before);
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
      episodeOutcome
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
