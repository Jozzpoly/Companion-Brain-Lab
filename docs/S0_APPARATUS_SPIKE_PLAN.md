# Companion Brain Lab — S0 Physical Apparatus Spike Plan

Status: **execution-ready bounded experiment**  
Date: 2026-09-13

S0 exists for one reason:

> **Prove that the laboratory can represent and inspect player↔companion physical cooperation without the apparatus itself lying to us.**

S0 does **not** implement autonomous companion intelligence.

If S0 is successful, the next stage may implement the first relational-positioning baseline. If S0 fails, fix or replace the apparatus before brain work begins.

---

## 1. S0 research claim

S0 should earn only this claim:

> A browser-playable, headless-testable fixed-step domain world can host a player and companion as real colliding bodies, accept independent desired movement, resolve physical motion through a replaceable collision kernel, and expose enough causal debug state to distinguish requested motion from actual motion and obstruction.

Do not claim:

- good companion movement;
- good game feel;
- good navigation;
- combat AI;
- pathfinding architecture;
- final physics choice;
- cross-platform determinism;
- shared runtime readiness.

---

## 2. Provisional toolchain for the spike

Use the current stable/fresh versions already close to the sibling project's environment where practical:

- Node `22`;
- TypeScript `7.0.2`;
- Vite `8.2.2`;
- Vitest `5.0.0`;
- Phaser `4.2.1`;
- `@dimforge/rapier2d` `0.20.0`.

These are spike pins, not platform commitments.

Why this set:

- Phaser/Vite/TypeScript/Vitest are already familiar and current in the sibling repository;
- Phaser `4.2.1` is the current npm `latest` at audit time;
- Rapier 2D is maintained, TypeScript-friendly and exposes the exact collision/query/character movement primitives being tested;
- using a similar JS toolchain lowers irrelevant integration cost while preserving a new domain model.

Do not import Cloudflare Worker / OpenAI / provider dependencies into S0.

---

## 3. Minimal repository shape

Keep source responsibilities visibly separate from day one, but do not over-framework them.

Suggested bounded shape:

```text
src/
  world/
    world.ts
    types.ts
    scenario.ts
  physics/
    rapier-physical-world.ts
  app/
    scene.ts
    input.ts
    debug-overlay.ts
  test/
    ...scenario/contract tests...
```

Names may change during implementation. The responsibility split matters more than folder names.

Rules:

- `world/` may use a narrow physics interface but should not expose Phaser objects;
- `physics/` may expose domain-friendly results but not gameplay policy;
- `app/` mirrors/visualizes domain state and translates raw player input;
- tests should be able to run World/physics without creating a Phaser game.

Do not create generic `core`, `engine`, `agent-framework`, dependency injection frameworks or plugin architectures in S0.

---

## 4. Minimal domain entities

Only:

### Player

- id;
- position;
- radius;
- facing / aim direction;
- desired movement;
- actual movement / velocity projection for debug.

### Companion

Same physical fields as player.

No AI state beyond a debug/manual control channel in S0.

### Static obstacle

- id;
- rectangle or simple convex physical shape;
- physical collision;
- domain/debug label.

Do not add items, locations, speech, inventory, memory or semantic task state.

---

## 5. Physical control contract

Use a small domain-shaped input rather than passing Rapier/Phaser objects around.

Conceptually:

```text
ActorMotionIntent
  actor
  desired movement vector
  optional desired facing
```

World/frame host gathers the player's and companion's motion intents first.

The physical layer resolves them into something conceptually like:

```text
ActorMotionResult
  requested translation
  actual translation
  contacts / obstruction
```

Exact TypeScript types are an implementation detail.

Critical invariant:

> A brain/controller may request motion; only the physical/domain frame may establish the resulting position.

---

## 6. Actor contact semantics — S0 baseline

Start from **solid player↔companion contact**.

Do not automatically teleport, ghost, phase or silently push the companion out of the way.

This is intentionally harsh because S0 needs to expose obstruction truth.

The exact simultaneous-motion resolution method is an explicit spike risk. Candidate approaches may include Rapier character-controller movement or a small kinematic resolution layer using Rapier collision queries.

S0 must document any ordering bias. For example, if player movement is resolved before companion movement, the debug output and tests must make that policy explicit rather than pretending resolution is simultaneous.

### Required falsification

Create a head-on meeting scenario and a doorway scenario where both bodies request conflicting movement.

If the physical resolver produces unstable jitter, deep overlap, order-dependent teleport-like corrections, or results we cannot explain causally, the Rapier integration does **not** pass merely because bodies do not visibly cross walls.

---

## 7. First authored scenarios

### `open`

Large empty rectangle with player and companion separated.

Purpose: movement/facing/debug qualification.

### `pillar`

One central rectangular obstacle.

Purpose: wall collision, sliding, contact inspection.

### `doorway`

Two wall rectangles making a passage only modestly wider than one actor.

Purpose: player/companion obstruction and ordering evidence.

### `head-on`

Player and companion begin aligned and can be driven directly at one another.

Purpose: actor contact stress.

Each scenario has an exact reset state.

---

## 8. Controls

S0 should let the Owner manipulate both bodies without AI contamination.

Minimum:

- normal player WASD / directional movement;
- simple facing/aim indicator (mouse or movement direction — choose the smallest reliable input);
- a debug modifier/key mode that lets the Owner directly drive the companion, **or** a tiny deterministic scripted companion motion fixture selectable in UI;
- reset scenario;
- scenario switch;
- pause;
- single simulation step;
- debug overlay toggle.

The exact bindings are not product UX and may remain ugly.

---

## 9. Debug surface

Always available behind a toggle:

- simulation tick;
- player and companion collider outlines;
- static collider outlines;
- desired movement arrows;
- actual movement arrows;
- contact points/normals if available from the physical kernel;
- requested vs resolved movement magnitude;
- current scenario;
- pause state;
- recent obstruction/contact records;
- any motion-resolution ordering policy currently active.

The Owner should be able to look at a strange motion and answer:

> "Did the controller ask for this, or did collision resolution cause it?"

If the debug surface cannot answer that, S0 is incomplete.

---

## 10. Automated qualification

### Domain/authority tests

- app/renderer cannot directly set canonical actor positions through its public integration seam;
- one call to frame step advances one World tick;
- both actors can supply independent motion intents to one frame;
- reset recreates authored initial positions;
- invalid/non-finite motion input is rejected before corrupting physical state.

### Collision tests

- actor cannot cross a static wall under ordinary movement;
- companion cannot cross a static wall;
- actor circles do not remain deeply interpenetrating after a head-on contact case;
- doorway conflict remains bounded and explainable;
- actual translation differs from requested translation when blocked and the difference is observable;
- contact/obstruction output identifies the relevant physical interaction when available.

### Rendering independence

- headless scenario stepping produces state without Phaser initialization;
- Phaser render objects mirror canonical transforms rather than owning them.

### Fixed-step tests

- N fixed steps with the same deterministic scripted motion fixture produce the same local final state in repeated runs in the same test environment;
- pause performs zero domain steps;
- single-step performs exactly one.

Do not promote this to a cross-platform determinism claim.

---

## 11. Manual / Owner qualification

S0 Owner play is short and physical, not a companion-intelligence evaluation.

Try deliberately adversarial movement:

- ram the companion into a wall;
- squeeze past it in the doorway;
- drive both actors head-on;
- pin one body between another body and geometry;
- reverse direction repeatedly;
- scrape along walls and corners;
- pause and single-step during contact;
- reset repeatedly.

Owner questions:

1. Does movement look stable enough that later AI failures will be interpretable?
2. Are contacts readable rather than mysterious?
3. Does the player still feel directly controlled?
4. Do any physics artifacts dominate the experience?
5. Can debug overlays explain what happened?

A successful S0 may still feel visually primitive.

---

## 12. Explicit PASS / FAIL gate

### PASS

S0 passes when:

- all automated authority/fixed-step/basic-contact checks pass;
- no material unexplained collision instability remains in the tiny scenario set;
- Owner can deliberately produce obstruction and distinguish controller intent from physics resolution;
- app/rendering does not own World state;
- reset/pause/single-step are trustworthy;
- the apparatus is small enough that modifying collision policy remains easy.

### FAIL

S0 fails if any of these are true:

- actor contact is so unstable that AI evaluation would be contaminated;
- physics state leaks throughout game/UI code and becomes difficult to replace;
- player movement feels dominated by rigid-body artifacts;
- the only way to avoid obstruction is already to hide it with special companion cheats;
- headless tests cannot drive the same domain/physical path as the browser;
- debug state cannot explain requested vs actual movement.

A FAIL should trigger physical-substrate repair or replacement, **not** compensating AI behavior.

---

## 13. What happens only after S0 PASS

Re-plan the next stage from S0 evidence.

The likely next bounded experiment is **S1 relational positioning baseline**, comparing:

1. fixed-point following;
2. region-based following;
3. small candidate-position selection with hysteresis/obstruction awareness.

But S1 must not be implemented by inertia. S0 Owner evidence may show that collision policy, body radius, movement response, input feel or debug apparatus needs revision first.

---

## 14. Sibling donor opportunities after S0

Only after S0 works should we compare its frame/physical boundary against `Llm-Live-NPC` again.

Possible outcomes:

- **no donor:** Companion-specific apparatus remains local;
- **concept donor:** lessons about multi-actor frame ownership feed back into sibling design;
- **adapted donor:** a small motion/contact debug helper is useful in the sibling;
- **future common candidate:** repeated use eventually proves a lower-level frame/observation contract useful in both.

Do not extract a shared package during S0.
