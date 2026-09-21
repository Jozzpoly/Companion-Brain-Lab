import type { ActorSpec, ObstacleSpec, ScenarioId, ScenarioSpec } from "./types";

const WIDTH = 12;
const HEIGHT = 8;
const RADIUS = 0.3;
const SPEED = 3;

function actor(
  id: ActorSpec["id"],
  x: number,
  y: number,
  options: Partial<Pick<ActorSpec, "radius" | "speed" | "collisionMode">> = {}
): ActorSpec {
  return {
    id,
    position: { x, y },
    radius: options.radius ?? RADIUS,
    speed: options.speed ?? SPEED,
    collisionMode: options.collisionMode
  };
}

const doorwayWalls: readonly ObstacleSpec[] = [
  { id: "door.wall.top", x: 5.7, y: 0, width: 0.6, height: 3.3 },
  { id: "door.wall.bottom", x: 5.7, y: 4.7, width: 0.6, height: 3.3 }
];

export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioSpec>> = {
  open: {
    id: "open",
    label: "Open field",
    width: WIDTH,
    height: HEIGHT,
    actors: [actor("player", 3, 4), actor("companion", 8, 4)],
    obstacles: []
  },
  pillar: {
    id: "pillar",
    label: "Central pillar",
    width: WIDTH,
    height: HEIGHT,
    actors: [actor("player", 3, 4), actor("companion", 9, 4)],
    obstacles: [{ id: "pillar.center", x: 5.5, y: 2, width: 1, height: 4 }]
  },
  doorway: {
    id: "doorway",
    label: "Narrow doorway",
    width: WIDTH,
    height: HEIGHT,
    actors: [actor("player", 3.8, 4), actor("companion", 8.2, 4)],
    obstacles: doorwayWalls
  },
  "head-on": {
    id: "head-on",
    label: "Head-on contact",
    width: WIDTH,
    height: HEIGHT,
    actors: [actor("player", 4.5, 4), actor("companion", 7.5, 4)],
    obstacles: []
  },
  "shared-danger": {
    id: "shared-danger",
    label: "Shared danger apparatus",
    width: WIDTH,
    height: HEIGHT,
    actors: [
      actor("player", 3, 4),
      actor("companion", 5.2, 4),
      actor("hostile", 8.5, 4, { radius: 0.32, speed: 1.4, collisionMode: "sensor" })
    ],
    obstacles: []
  },
  "cooperative-episode": {
    id: "cooperative-episode",
    label: "Cooperative episode · manual baseline",
    width: WIDTH,
    height: HEIGHT,
    actors: [
      actor("player", 3, 4),
      actor("companion", 5.2, 4),
      actor("hostile", 10.4, 4, { radius: 0.34, speed: 1.8, collisionMode: "sensor" })
    ],
    obstacles: []
  }
};

export function scenario(id: ScenarioId): ScenarioSpec {
  return SCENARIOS[id];
}
