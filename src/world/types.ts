export type ActorId = "player" | "companion";
export type ScenarioId = "open" | "pillar" | "doorway" | "head-on";

export interface Vec2 {
  x: number;
  y: number;
}

export interface ObstacleSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActorSpec {
  id: ActorId;
  position: Vec2;
  radius: number;
  speed: number;
}

export interface ScenarioSpec {
  id: ScenarioId;
  label: string;
  width: number;
  height: number;
  actors: readonly ActorSpec[];
  obstacles: readonly ObstacleSpec[];
}

export interface MotionIntent {
  actorId: ActorId;
  move: Vec2;
}

export interface ContactRecord {
  with: string;
  contactCount: number;
}

export interface ActorSnapshot {
  id: ActorId;
  position: Vec2;
  radius: number;
  requestedVelocity: Vec2;
  actualVelocity: Vec2;
  motionError: number;
  contacts: readonly ContactRecord[];
}

export interface WorldSnapshot {
  tick: number;
  scenarioId: ScenarioId;
  width: number;
  height: number;
  actors: readonly ActorSnapshot[];
  obstacles: readonly ObstacleSpec[];
}
