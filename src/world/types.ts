export type ActorId = "player" | "companion";

/**
 * Explicitly experimental squad identities.
 *
 * Historical single-companion evidence remains bound to ActorId/"companion".
 * These bodies may exist and move in the Field Lab without silently widening
 * S1-S4 or legacy brain claims to multi-companion cognition.
 */
export type ExperimentalSquadMemberId = "squad-2" | "squad-3" | "squad-4";
export type SquadMemberId = "companion" | ExperimentalSquadMemberId;
export type FieldLabSituation = "TRAINING" | "PRESSURE" | "TASK_PRESSURE";
export type FieldLabLayout = "OPEN" | "DOORWAY" | "PILLAR" | "MIXED";
export type WorldBodyId = ActorId | ExperimentalSquadMemberId | "hostile";
export type ScenarioId =
  | "open"
  | "pillar"
  | "doorway"
  | "head-on"
  | "shared-danger"
  | "cooperative-episode"
  | "squad-field-lab"
  | "squad-field-lab-pressure"
  | "squad-field-lab-task-pressure";

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

export type BodyCollisionMode = "solid" | "sensor";

export interface ActorSpec {
  /**
   * Historical name retained for compatibility. S1 extends authored physical
   * bodies beyond externally controlled player/companion actors.
   */
  id: WorldBodyId;
  position: Vec2;
  radius: number;
  speed: number;
  collisionMode?: BodyCollisionMode;
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

/**
 * Field-Lab-only manual/order motion for additional embodied squad members.
 * This is deliberately separate from canonical MotionIntent so Authority-A0
 * and historical single-companion evidence keep their original contract.
 */
export interface ExperimentalSquadMotionIntent {
  bodyId: ExperimentalSquadMemberId;
  move: Vec2;
}

export interface ContactRecord {
  with: string;
  contactCount: number;
}

export interface ActorSnapshot {
  id: WorldBodyId;
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

export interface DirectTraversalBlocker {
  label: string;
  distance: number;
  fraction: number;
  hitCenter: Vec2;
  contactPoint: Vec2;
  normal: Vec2;
}

export type StaticTraversalInitialOverlapPolicy = "block" | "allow-egress";

export interface StaticTraversalOptions {
  initialOverlap?: StaticTraversalInitialOverlapPolicy;
}

export interface StaticCircleTraversalResult {
  from: Vec2;
  to: Vec2;
  radius: number;
  distance: number;
  clear: boolean;
  blocker: DirectTraversalBlocker | null;
}

export interface StaticCircleOccupancyResult {
  center: Vec2;
  radius: number;
  clear: boolean;
  blockers: readonly string[];
}

export interface DirectTraversalResult extends StaticCircleTraversalResult {
  actorId: ActorId;
}
