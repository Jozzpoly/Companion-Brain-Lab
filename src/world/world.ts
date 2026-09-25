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
import {
  activeTaskPressureCenter,
  initialTaskPressureSnapshot,
  resolveTaskPressureAfterPhysics,
  type TaskPressureRules,
  type TaskPressureSnapshot
} from "./task-pressure-contract";
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
  ExperimentalSquadMotionIntent,
  MotionIntent,
  ScenarioId,
  ScenarioSpec,
  SquadMemberId,
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

export const SQUAD_FIELD_LAB_PRESSURE_RULES: CooperativeEpisodeRules = {
  repelRange: 1.2,
  pressureRange: 0.86,
  pressureBreakRange: 1.38,
  pressureTicks: 72,
  drivenBackTicks: 48,
  calmTicks: 120,
  home: { x: 7.1, y: 5 },
  homeArrivalRange: 0.2
};

export const SQUAD_FIELD_LAB_TASK_PRESSURE_RULES: TaskPressureRules = {
  taskCenters: [
    { x: 9, y: 3.2 },
    { x: 9, y: 6.8 }
  ],
  taskRadius: 0.78,
  contestRadius: 1.0,
  requiredProgressTicks: 120,
  hostileHome: { x: 13.4, y: 5 },
  hostileHomeArrivalRange: 0.22
};

export interface WorldSituationStepInput {
  motionIntents: readonly MotionIntent[];
  actionAttempts?: readonly WorldActionAttempt[];
  cooperativeEpisodeAttempts?: readonly CooperativeEpisodeActionAttempt[];
  experimentalSquadMotionIntents?: readonly ExperimentalSquadMotionIntent[];
}

export interface WorldSituationStepResult {
  snapshot: WorldSnapshot;
  actionOutcomes: readonly WorldActionOutcome[];
  sharedDanger: SharedDangerSnapshot | null;
  episodeOutcome: SharedDangerEpisodeOutcome;
  cooperativeEpisodeActionOutcomes: readonly CooperativeEpisodeActionOutcome[];
  cooperativeEpisode: CooperativeEpisodeSnapshot | null;
  cooperativeEpisodeOutcome: CooperativeEpisodeOutcome;
  taskPressure: TaskPressureSnapshot | null;
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
  private readonly cooperativeEpisodeRulesValue: CooperativeEpisodeRules | null;
  private taskPressureValue: TaskPressureSnapshot | null;
  private readonly taskPressureRulesValue: TaskPressureRules | null;

  private constructor(
    private readonly scenarioSpecValue: ScenarioSpec,
    private readonly physical: RapierPhysicalWorld,
    private readonly sharedPressureLoop: SharedPressureLoop
  ) {
    this.sharedDangerValue =
      scenarioSpecValue.id === "shared-danger" ? initialSharedDangerSnapshot() : null;
    this.cooperativeEpisodeRulesValue =
      scenarioSpecValue.id === "cooperative-episode"
        ? S5_COOPERATIVE_EPISODE_RULES
        : scenarioSpecValue.id === "squad-field-lab-pressure"
          ? SQUAD_FIELD_LAB_PRESSURE_RULES
          : null;
    this.cooperativeEpisodeValue = this.cooperativeEpisodeRulesValue
      ? initialCooperativeEpisodeSnapshot(this.cooperativeEpisodeRulesValue)
      : null;
    this.taskPressureRulesValue =
      scenarioSpecValue.id === "squad-field-lab-task-pressure"
        ? SQUAD_FIELD_LAB_TASK_PRESSURE_RULES
        : null;
    this.taskPressureValue = this.taskPressureRulesValue
      ? initialTaskPressureSnapshot(this.taskPressureRulesValue)
      : null;
  }

  static async create(id: ScenarioId): Promise<LabWorld> {
    return LabWorld.createFromSpec(scenario(id));
  }

  static async createFromSpec(spec: ScenarioSpec): Promise<LabWorld> {
    return new LabWorld(
      spec,
      await RapierPhysicalWorld.create(spec),
      new SharedPressureLoop(spec.id)
    );
  }

  dispose(): void {
    this.physical.dispose();
  }

  actorMovementCapability(actorId: ActorId): MovementCapability {
    return movementCapabilityFromScenario(this.scenarioSpecValue, actorId);
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

  taskPressure(): TaskPressureSnapshot | null {
    return this.taskPressureValue
      ? {
          ...this.taskPressureValue,
          stageCompletionTicks: [...this.taskPressureValue.stageCompletionTicks]
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
      throw new Error("Cooperative episode actions require an active cooperative-pressure scenario.");
    }
    const experimentalSquadMotionIntents = input.experimentalSquadMotionIntents ?? [];
    if (
      this.scenarioSpecValue.id !== "squad-field-lab" &&
      this.scenarioSpecValue.id !== "squad-field-lab-pressure" &&
      this.scenarioSpecValue.id !== "squad-field-lab-task-pressure" &&
      experimentalSquadMotionIntents.length > 0
    ) {
      throw new Error("Experimental squad motion is confined to Squad Field Lab scenarios.");
    }
    for (const intent of experimentalSquadMotionIntents) {
      if (intent.bodyId !== "squad-2" && intent.bodyId !== "squad-3" && intent.bodyId !== "squad-4") {
        throw new Error(`Experimental squad motion cannot claim canonical body authority: ${String(intent.bodyId)}`);
      }
    }

    const before = this.snapshot();
    const worldDrivenIntents = [
      ...this.sharedDangerWorldMotion(before),
      ...this.cooperativeEpisodeWorldMotion(before),
      ...this.taskPressureWorldMotion(before)
    ];
    const actors = this.physical.step(
      input.motionIntents,
      worldDrivenIntents,
      experimentalSquadMotionIntents
    );
    this.tickValue += 1;
    const spec = this.scenarioSpecValue;
    const after: WorldSnapshot = {
      tick: this.tickValue,
      scenarioId: this.scenarioSpecValue.id,
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
    if (this.cooperativeEpisodeValue && this.cooperativeEpisodeRulesValue) {
      const player = body(after, "player");
      const hostile = body(after, "hostile");
      const squadPositions: Partial<Record<SquadMemberId, Vec2>> = {};
      for (const memberId of ["companion", "squad-2", "squad-3", "squad-4"] as const) {
        const member = after.actors.find((candidate) => candidate.id === memberId);
        if (member) squadPositions[memberId] = { ...member.position };
      }
      const resolved = resolveCooperativeEpisodeAfterPhysics({
        observationTick: before.tick,
        before: this.cooperativeEpisodeValue,
        postPhysics: {
          hostilePosition: hostile.position,
          playerPosition: player.position,
          squadPositions
        },
        attempts: cooperativeEpisodeAttempts,
        rules: this.cooperativeEpisodeRulesValue
      });
      this.cooperativeEpisodeValue = resolved.after;
      cooperativeEpisodeActionOutcomes = resolved.actionOutcomes;
      cooperativeEpisodeOutcome = resolved.episodeOutcome;
    }

    if (this.taskPressureValue && this.taskPressureRulesValue) {
      const player = body(after, "player");
      const hostile = body(after, "hostile");
      this.taskPressureValue = resolveTaskPressureAfterPhysics({
        observationTick: before.tick,
        before: this.taskPressureValue,
        playerPosition: player.position,
        hostilePosition: hostile.position,
        playerContacts: player.contacts,
        rules: this.taskPressureRulesValue
      });
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
      cooperativeEpisodeOutcome,
      taskPressure: this.taskPressure()
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

  private taskPressureWorldMotion(snapshot: WorldSnapshot): PhysicalWorldBodyMotionIntent[] {
    const state = this.taskPressureValue;
    const rules = this.taskPressureRulesValue;
    if (!state || !rules) return [];

    if (state.phase === "IDLE" || state.phase === "SETTLED") {
      return [{ bodyId: "hostile", move: { x: 0, y: 0 } }];
    }

    const hostile = body(snapshot, "hostile");
    const target = state.phase === "COMPLETED"
      ? rules.hostileHome
      : activeTaskPressureCenter(state, rules);
    const delta = {
      x: target.x - hostile.position.x,
      y: target.y - hostile.position.y
    };
    const length = Math.hypot(delta.x, delta.y);
    return [{
      bodyId: "hostile",
      move: length > 1e-9
        ? { x: delta.x / length, y: delta.y / length }
        : { x: 0, y: 0 }
    }];
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
      ? this.cooperativeEpisodeRulesValue?.home ?? body(snapshot, "player").position
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
    const spec = this.scenarioSpecValue;
    return {
      tick: this.tickValue,
      scenarioId: this.scenarioSpecValue.id,
      width: spec.width,
      height: spec.height,
      actors: this.physical.snapshot(),
      obstacles: spec.obstacles
    };
  }
}
