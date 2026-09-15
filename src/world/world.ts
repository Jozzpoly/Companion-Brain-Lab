import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import {
  buildAuthorityA0WorldStepEvidence,
  cloneAuthorityA0WorldStepEvidence,
  type AuthorityA0WorldStepEvidence
} from "./authority-a0-step-evidence";
import { movementCapabilityFromScenario, type MovementCapability } from "./movement-capability";
import { scenario } from "./scenarios";
import type {
  ActorId,
  DirectTraversalResult,
  MotionIntent,
  ScenarioId,
  StaticCircleOccupancyResult,
  StaticCircleTraversalResult,
  StaticTraversalOptions,
  Vec2,
  WorldSnapshot
} from "./types";

export type AuthorityA0StepObserver = (evidence: AuthorityA0WorldStepEvidence) => void;

const authorityA0StepObservers = new Set<AuthorityA0StepObserver>();

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

  private constructor(
    private readonly scenarioIdValue: ScenarioId,
    private readonly physical: RapierPhysicalWorld
  ) {}

  static async create(id: ScenarioId): Promise<LabWorld> {
    return new LabWorld(id, await RapierPhysicalWorld.create(scenario(id)));
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

  step(intents: readonly MotionIntent[]): WorldSnapshot {
    const before = this.snapshot();
    const actors = this.physical.step(intents);
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
    this.latestAuthorityA0EvidenceValue = buildAuthorityA0WorldStepEvidence({
      before,
      after,
      intents,
      playerCapability: this.actorMovementCapability("player"),
      companionCapability: this.actorMovementCapability("companion")
    });
    if (authorityA0StepObservers.size > 0) {
      publishAuthorityA0StepEvidence(this.latestAuthorityA0EvidenceValue);
    }
    return after;
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
