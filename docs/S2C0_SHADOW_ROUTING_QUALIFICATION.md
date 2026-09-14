# S2-C0 — Shadow Static Routing Qualification

Status: **MECHANICAL / DEBUG QUALIFICATION PASS · OWNER BROWSER GATE OPEN**  
Qualified runtime SHA: `1ceb689bb829cec0da0e9eb819a8295da8545853`  
Qualifying GitHub Actions run: `34792325275`

S2-C0 exists to qualify static route reasoning **before** granting routing authority over companion movement.

## What is qualified

The experiment now has a deterministic, read-only static visibility-graph planner built entirely above the public World spatial-query boundary.

The planner:

- receives `WorldSnapshot`, start, target and actor radius;
- uses `LabWorld.staticCircleTraversal(from, to, radius)` for every candidate graph edge;
- does not depend on Rapier or Phaser directly;
- distinguishes `direct`, `routed`, `unreachable` and `invalid-target`;
- exposes every graph node and candidate edge;
- preserves the first static blocker for rejected edges;
- uses deterministic shortest-path search with stable tie-breaking;
- exposes route node sequence, waypoints, cost, gameplay clearance and explicit corner epsilon;
- is read-only with respect to World state.

## Qualified automated evidence

Exact runtime head `1ceb689bb829cec0da0e9eb819a8295da8545853` passed:

- strict TypeScript compile;
- 6/6 test files;
- 40/40 tests;
- production Vite build;
- dependency install audit with 0 vulnerabilities.

Current test split:

- S1 relational positioning: 8/8;
- S2-C0 static router: 7/7;
- S0 physical/domain: 9/9;
- S2-B traversal/world-query contracts: 10/10;
- S2-A research trace: 4/4;
- S2-A debug workbench: 2/2.

The router tests explicitly cover:

1. direct travel in open space;
2. deterministic routing around the central pillar;
3. routing through the authored doorway to an offset target;
4. target invalid because the actor body cannot occupy it;
5. target valid but unreachable because an enlarged body cannot fit through the doorway;
6. planner read-only behavior;
7. explicit rejection of invalid clearance configuration.

## Important falsification found during S2-C0

The first visibility-graph implementation failed the pillar while already passing the doorway case.

Cause: corner nodes were exactly tangent to the inflated obstacle boundary. The whole-body shape cast correctly treated an edge running on that boundary as contact, disconnecting the graph.

The repair is explicit rather than hidden inside solver tolerance:

- gameplay route clearance: `0.08` world units;
- numerical corner epsilon: `0.02` world units.

After this change the full 40-test suite passes, including the pillar route. The epsilon remains public debug state and is not presented as a gameplay tuning parameter.

## Owner-facing debug workbench

`NAV` / `ALL` now expose two independent layers:

### Direct whole-body evidence

- CLEAR / BLOCKED direct traversal;
- body-width corridor;
- blocker identity;
- hit distance/fraction;
- hit-center body position;
- contact point;
- contact normal.

### Shadow route evidence

- all graph nodes;
- faint accepted candidate edges;
- faint rejected candidate edges;
- selected route polyline;
- route status;
- route cost;
- route node sequence;
- accepted/rejected edge counts;
- gameplay clearance;
- numerical corner epsilon;
- plain-language route reason.

Research trace records `nav.shadow.<status>` only when route status/path changes rather than every physics tick. The live NAV channel is still sampled in the bounded rolling trace, and `I` incident capture includes the current route/debug values.

## Authority boundary — critical

**The S2-C0 planner does not control movement.**

`MotionIntent` is still produced by the existing S1/S2-B MANUAL / CHASE / RELATIONAL paths. Shadow routing is computed after the authoritative World step for observation only.

Therefore a successful S2-C0 route does **not** prove that the companion can execute that route.

This separation is intentional: route correctness is being qualified independently from waypoint execution, local movement feel, progress monitoring and player cooperation.

## Explicit non-claims

S2-C0 does not claim to solve:

- waypoint following;
- route caching / revision policy;
- path smoothing during execution;
- progress/stuck detection;
- recovery/replan behavior;
- player occupancy or contested passages;
- doorway yielding;
- crowd avoidance;
- soft collision;
- combat, commands or LLM cognition;
- general production navigation architecture.

The visibility graph remains a bounded research substrate for current simple rectangular static geometry.

## Browser / Owner gate

Public preview should be pinned to the exact qualified runtime SHA before Owner evaluation.

Recommended first inspection:

1. select `NAV` or `ALL` with `B`;
2. use `2` (pillar) and `3` (doorway);
3. move the player so RELATIONAL selects targets across / around the obstacle;
4. verify that red direct-block evidence agrees with visible geometry;
5. verify that the blue shadow route goes around the pillar or through the doorway without impossible edges;
6. inspect whether rejected graph edges make the route explanation understandable rather than merely noisy;
7. press `I` on any suspicious case so the bounded incident bundle captures the route/debug state.

S2-C0 is mechanically qualified, but visual/debug legibility and semantic agreement with what the Owner sees remain **unproven until the browser gate**.

## Next boundary if Owner evidence agrees

Do **not** jump directly to dynamic yielding.

The next bounded step is S2-C1: give a qualified static route controlled authority over **only the next waypoint / local movement target**, while preserving the existing physical World authority and making route revision, waypoint advancement and direct-vs-routed execution visible. Progress/stuck classification should follow as its own gate rather than being hidden inside the first route executor.
