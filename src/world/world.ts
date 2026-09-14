import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
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

export class LabWorld {
  private tickValue = 0;

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
    const actors = this.physical.step(intents);
    this.tickValue += 1;
    const spec = scenario(this.scenarioIdValue);
    return {
      tick: this.tickValue,
      scenarioId: this.scenarioIdValue,
      width: spec.width,
      height: spec.height,
      actors,
      obstacles: spec.obstacles
    };
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
