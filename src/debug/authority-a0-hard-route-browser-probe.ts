import { evaluateHardRouteTruth, type HardRouteTruthEvidence } from "../navigation/hard-route-truth";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";

export interface AuthorityA0HardRouteBrowserQualification {
  fixture: "narrow-boundary-hard-only-passage-v1";
  target: Vec2;
  evidence: HardRouteTruthEvidence;
}

export async function runAuthorityA0HardRouteBrowserQualification(): Promise<AuthorityA0HardRouteBrowserQualification> {
  const spec: ScenarioSpec = {
    id: "open",
    label: "A0 browser narrow hard-only passage",
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: { x: 2, y: 7 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 8, y: 4 }, radius: 0.3, speed: 3 }
    ],
    obstacles: [
      { id: "hard-only-wall", x: 5.5, y: 0.7, width: 1, height: 7.3 }
    ]
  };
  const target = { x: 3, y: 4 };
  const physical = await RapierPhysicalWorld.create(spec);

  try {
    const snapshot: WorldSnapshot = {
      tick: 0,
      scenarioId: spec.id,
      width: spec.width,
      height: spec.height,
      actors: physical.snapshot(),
      obstacles: spec.obstacles
    };
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (!companion) throw new Error("A0 hard-route browser qualification missing companion actor.");

    return {
      fixture: "narrow-boundary-hard-only-passage-v1",
      target,
      evidence: evaluateHardRouteTruth({
        snapshot,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      })
    };
  } finally {
    physical.dispose();
  }
}
