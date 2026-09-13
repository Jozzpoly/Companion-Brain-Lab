import RAPIER from "@dimforge/rapier2d-deterministic-compat";
import type {
  ActorId,
  ActorSnapshot,
  ContactRecord,
  DirectTraversalResult,
  MotionIntent,
  ScenarioSpec,
  StaticCircleTraversalResult,
  Vec2
} from "../world/types";

const STEP_SECONDS = 1 / 60;
const WALL_THICKNESS = 0.2;
const TRAVERSAL_EPSILON = 1e-6;

let rapierReady: Promise<void> | null = null;

function ensureRapier(): Promise<void> {
  rapierReady ??= RAPIER.init().then(() => undefined);
  return rapierReady;
}

function normalized(input: Vec2): Vec2 {
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) {
    throw new Error("Motion input requires finite x/y components.");
  }
  const magnitude = Math.hypot(input.x, input.y);
  if (magnitude <= 1) return { x: input.x, y: input.y };
  return { x: input.x / magnitude, y: input.y / magnitude };
}

function unit(input: Vec2): Vec2 {
  const magnitude = Math.hypot(input.x, input.y);
  return magnitude > TRAVERSAL_EPSILON
    ? { x: input.x / magnitude, y: input.y / magnitude }
    : { x: 0, y: 0 };
}

interface PhysicalActor {
  id: ActorId;
  radius: number;
  speed: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  requestedVelocity: Vec2;
}

export class RapierPhysicalWorld {
  private readonly world: RAPIER.World;
  private readonly actors = new Map<ActorId, PhysicalActor>();
  private readonly colliderLabels = new Map<number, string>();

  private constructor(private readonly spec: ScenarioSpec) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = STEP_SECONDS;
    this.createBoundary();
    for (const obstacle of spec.obstacles) {
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(obstacle.width / 2, obstacle.height / 2)
          .setTranslation(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2)
          .setFriction(0)
          .setRestitution(0)
      );
      this.colliderLabels.set(collider.handle, obstacle.id);
    }

    for (const actor of spec.actors) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(actor.position.x, actor.position.y)
          .setCanSleep(false)
          .setCcdEnabled(true)
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(actor.radius)
          .setFriction(0)
          .setRestitution(0)
          .setDensity(1),
        body
      );
      this.colliderLabels.set(collider.handle, actor.id);
      this.actors.set(actor.id, {
        id: actor.id,
        radius: actor.radius,
        speed: actor.speed,
        body,
        collider,
        requestedVelocity: { x: 0, y: 0 }
      });
    }

    // Deterministic-compat 0.20 makes World scene-query broad phase usable
    // after a physics step. Initial gravity and velocities are zero, so this is
    // a query warm-up outside LabWorld domain time. S0 regression tests protect it.
    this.world.step();
  }

  static async create(spec: ScenarioSpec): Promise<RapierPhysicalWorld> {
    await ensureRapier();
    return new RapierPhysicalWorld(spec);
  }

  dispose(): void {
    this.world.free();
  }

  directTraversal(actorId: ActorId, target: Vec2): DirectTraversalResult {
    const actor = this.actors.get(actorId);
    if (!actor) throw new Error(`Missing actor for traversal query: ${actorId}`);
    const translation = actor.body.translation();
    return {
      actorId,
      ...this.staticCircleTraversal(
        { x: translation.x, y: translation.y },
        target,
        actor.radius
      )
    };
  }

  staticCircleTraversal(from: Vec2, target: Vec2, radius: number): StaticCircleTraversalResult {
    if (
      !Number.isFinite(from.x) ||
      !Number.isFinite(from.y) ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y)
    ) {
      throw new Error("Static traversal requires finite from/to components.");
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error("Static traversal requires a finite positive radius.");
    }

    const start = { ...from };
    const to = { ...target };
    const delta = { x: to.x - start.x, y: to.y - start.y };
    const distance = Math.hypot(delta.x, delta.y);
    const base: Omit<StaticCircleTraversalResult, "clear" | "blocker"> = {
      from: start,
      to,
      radius,
      distance
    };

    if (distance <= TRAVERSAL_EPSILON) {
      return { ...base, clear: true, blocker: null };
    }

    const direction = unit(delta);
    const shape = new RAPIER.Ball(radius);
    const hit = this.world.castShape(
      start,
      0,
      direction,
      shape,
      0,
      distance,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (collider) => {
        const label = this.colliderLabels.get(collider.handle);
        return label !== "player" && label !== "companion";
      }
    );

    if (!hit) return { ...base, clear: true, blocker: null };

    const hitDistance = Math.max(0, Math.min(distance, hit.time_of_impact));
    const hitCenter = {
      x: start.x + direction.x * hitDistance,
      y: start.y + direction.y * hitDistance
    };

    return {
      ...base,
      clear: false,
      blocker: {
        label: this.colliderLabels.get(hit.collider.handle) ?? `collider:${hit.collider.handle}`,
        distance: hitDistance,
        fraction: distance > TRAVERSAL_EPSILON ? hitDistance / distance : 0,
        hitCenter,
        // Deterministic-compat's World.castShape JS wrapper already exposes these
        // in the coordinate convention used by our authored scene. Tests bind this
        // adapter behavior to obstacle geometry instead of transforming speculatively.
        contactPoint: { x: hit.witness1.x, y: hit.witness1.y },
        normal: { x: hit.normal1.x, y: hit.normal1.y }
      }
    };
  }

  step(intents: readonly MotionIntent[]): ActorSnapshot[] {
    const byActor = new Map<ActorId, Vec2>();
    for (const intent of intents) {
      if (byActor.has(intent.actorId)) throw new Error(`Duplicate motion intent: ${intent.actorId}`);
      byActor.set(intent.actorId, normalized(intent.move));
    }

    const before = new Map<ActorId, Vec2>();
    for (const actor of this.actors.values()) {
      const position = actor.body.translation();
      before.set(actor.id, { x: position.x, y: position.y });
      const move = byActor.get(actor.id) ?? { x: 0, y: 0 };
      actor.requestedVelocity = { x: move.x * actor.speed, y: move.y * actor.speed };
      actor.body.setLinvel(actor.requestedVelocity, true);
    }

    this.world.step();

    return [...this.actors.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((actor) => {
        const start = before.get(actor.id);
        if (!start) throw new Error(`Missing pre-step state for ${actor.id}.`);
        const end = actor.body.translation();
        const actualVelocity = {
          x: (end.x - start.x) / STEP_SECONDS,
          y: (end.y - start.y) / STEP_SECONDS
        };
        return {
          id: actor.id,
          position: { x: end.x, y: end.y },
          radius: actor.radius,
          requestedVelocity: { ...actor.requestedVelocity },
          actualVelocity,
          motionError: Math.hypot(
            actualVelocity.x - actor.requestedVelocity.x,
            actualVelocity.y - actor.requestedVelocity.y
          ),
          contacts: this.contactsFor(actor)
        };
      });
  }

  snapshot(): ActorSnapshot[] {
    return [...this.actors.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((actor) => {
        const position = actor.body.translation();
        return {
          id: actor.id,
          position: { x: position.x, y: position.y },
          radius: actor.radius,
          requestedVelocity: { x: 0, y: 0 },
          actualVelocity: { x: 0, y: 0 },
          motionError: 0,
          contacts: this.contactsFor(actor)
        };
      });
  }

  private contactsFor(actor: PhysicalActor): ContactRecord[] {
    const records = new Map<string, number>();
    this.world.contactPairsWith(actor.collider, (other) => {
      const label = this.colliderLabels.get(other.handle) ?? `collider:${other.handle}`;
      this.world.contactPair(actor.collider, other, (manifold) => {
        const count = manifold.numContacts();
        if (count > 0) records.set(label, (records.get(label) ?? 0) + count);
      });
    });
    return [...records.entries()]
      .map(([withLabel, contactCount]) => ({ with: withLabel, contactCount }))
      .sort((a, b) => a.with.localeCompare(b.with));
  }

  private createBoundary(): void {
    const { width, height } = this.spec;
    const walls = [
      { id: "boundary.top", x: width / 2, y: -WALL_THICKNESS / 2, hw: width / 2, hh: WALL_THICKNESS / 2 },
      { id: "boundary.bottom", x: width / 2, y: height + WALL_THICKNESS / 2, hw: width / 2, hh: WALL_THICKNESS / 2 },
      { id: "boundary.left", x: -WALL_THICKNESS / 2, y: height / 2, hw: WALL_THICKNESS / 2, hh: height / 2 },
      { id: "boundary.right", x: width + WALL_THICKNESS / 2, y: height / 2, hw: WALL_THICKNESS / 2, hh: height / 2 }
    ];
    for (const wall of walls) {
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(wall.hw, wall.hh)
          .setTranslation(wall.x, wall.y)
          .setFriction(0)
          .setRestitution(0)
      );
      this.colliderLabels.set(collider.handle, wall.id);
    }
  }
}

export const S0_STEP_SECONDS = STEP_SECONDS;
