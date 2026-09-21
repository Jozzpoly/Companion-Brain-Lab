import type { ActorSpec, ObstacleSpec, ScenarioId, ScenarioSpec, SquadMemberId } from "./types";

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
  },
  "squad-field-lab": {
    id: "squad-field-lab",
    label: "Companion / Squad Field Lab",
    width: 16,
    height: 10,
    actors: [
      actor("player", 3, 5),
      actor("companion", 4.6, 5),
      actor("squad-2", 4.8, 3.8),
      actor("squad-3", 4.8, 6.2),
      actor("squad-4", 6.0, 5)
    ],
    obstacles: [
      { id: "fieldlab.wall.top", x: 8, y: 0, width: 0.6, height: 3.9 },
      { id: "fieldlab.wall.bottom", x: 8, y: 6.1, width: 0.6, height: 3.9 },
      { id: "fieldlab.pillar", x: 11.4, y: 4.1, width: 1.2, height: 1.8 }
    ]
  }
};

export function scenario(id: ScenarioId): ScenarioSpec {
  return SCENARIOS[id];
}

const FIELD_LAB_MEMBER_SPAWNS: Readonly<Record<SquadMemberId, { x: number; y: number }>> = {
  companion: { x: 4.6, y: 5 },
  "squad-2": { x: 4.8, y: 3.8 },
  "squad-3": { x: 4.8, y: 6.2 },
  "squad-4": { x: 6.0, y: 5 }
};

/**
 * Rebuilds the same authored Field Lab with a real bounded squad roster.
 * Missing members are absent from the ScenarioSpec and therefore absent from
 * Rapier; this is not a UI visibility trick.
 */
export function squadFieldLabScenario(activeMembers: readonly SquadMemberId[]): ScenarioSpec {
  const unique = [...new Set(activeMembers)];
  if (unique.length < 1 || unique.length > 4 || !unique.includes("companion")) {
    throw new Error("Field Lab squad roster must contain canonical companion and 1-4 total members.");
  }

  const base = SCENARIOS["squad-field-lab"];
  return {
    ...base,
    actors: [
      actor("player", 3, 5),
      ...unique.map((memberId) => {
        const spawn = FIELD_LAB_MEMBER_SPAWNS[memberId];
        return actor(memberId, spawn.x, spawn.y);
      })
    ],
    obstacles: base.obstacles.map((obstacle) => ({ ...obstacle }))
  };
}

