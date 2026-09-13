# S2 — Movement Intelligence + Debug Workbench

Status: **PLANNING / PRE-IMPLEMENTATION**  
Predecessor: S1 relational-positioning informative failure  
Primary Owner requirement: go substantially deeper, with exceptional attention to advanced debug and Owner-facing research QoL.

---

## 1. Why S2 exists

S1 exposed a structural gap rather than a tuning defect.

A companion cannot be judged as spatially intelligent if the system only knows:

> "where would I like to stand relative to the player?"

It must also answer, at minimum:

> "can I actually get there?"
>
> "what route am I currently trying to execute?"
>
> "am I making progress?"
>
> "if not, what is blocking me and what should change?"
>
> "am I obstructing the player while pursuing my own relationship target?"

S2 is therefore not "add pathfinding". It is a bounded attempt to establish a clean, inspectable movement-intelligence loop without prematurely selecting a final navigation architecture.

---

## 2. S2 research question

> Can one companion maintain a useful relationship to a moving player through simple constrained 2D geometry by separating relationship intent, route feasibility, movement execution and progress/recovery — while making the entire causal chain visible enough for rapid Owner diagnosis?

A successful S2 does not require a production navigation stack. It requires an apparatus that makes doorway/pillar failures meaningfully rarer **for the right reasons** and makes remaining failures easy to explain.

---

## 3. Durable responsibility seams to test

These are working seams, not frozen architecture.

```text
Relationship intent
  "where should I be relative to the player?"
        │
        ▼
Traversal / route request
  "how can my body reach that place?"
        │
        ▼
Route / movement plan
  waypoints + feasibility + cost + blocker context
        │
        ▼
Local movement execution
  "what motion should I request this tick?"
        │
        ▼
World / physics authority
  actual movement + contacts + outcomes
        │
        ▼
Progress monitor
  "did the plan work? if not, why?"
        └──────────────► replan / yield / recover / reconsider relationship
```

The important experiment is not the exact class names. It is whether separating these responsibilities improves causality, testability and future reuse.

---

## 4. Immediate technical finding: endpoint validity is insufficient

S1's `candidateIsClear()` checks whether the final relationship point can contain the companion circle. It does not test the swept corridor between the companion and the point.

The first S2 spatial primitive should therefore distinguish at least:

- **point clear** — the body fits at the destination;
- **direct corridor clear** — the whole companion shape can move directly to the destination without static collision;
- **route exists** — a multi-segment static route exists when direct travel is blocked;
- **route currently occupied/contested** — dynamic actors may make a currently valid static route temporarily unsuitable.

For exact corridor checks, Rapier already exposes scene queries and shape casting. Shape casting is specifically intended to test a full shape moving through the scene rather than only a mathematical ray.

Reference: https://rapier.rs/docs/user_guides/javascript/scene_queries/

Do not expose Rapier objects to the companion brain. Wrap spatial queries behind a small read-only world/spatial contract.

---

## 5. Static route competence: current-best bounded hypothesis

### 5.1 Do not jump directly to a general navmesh

A full Recast/Detour-style navigation stack is a legitimate later option, but it is likely too large and semantically noisy for the present tiny 2D lab.

The current world has:

- rectangular bounds;
- axis-aligned rectangular static obstacles;
- circular agents;
- a handful of tiny scenarios.

This gives us an unusually clean experimental opportunity.

### 5.2 Preferred first spike: inflated-obstacle visibility graph

Current-best hypothesis for S2:

1. Inflate static obstacles by companion radius + explicit clearance margin.
2. Treat start, target and useful inflated obstacle corners/portals as graph nodes.
3. Connect node pairs only when a companion-radius corridor between them is clear.
4. Run deterministic shortest-path search.
5. Simplify/smooth the path by skipping waypoints when a farther corridor is directly clear.
6. Cache the route until its target/environment/progress state materially changes.

Why this is attractive now:

- deterministic;
- small implementation surface;
- exact enough for current rectangular geometry;
- naturally handles pillar and doorway topology;
- extremely easy to visualize and falsify;
- avoids grid-resolution artifacts;
- does not commit the project to a later navigation technology.

This is a research substrate, not a declaration that the final game should use visibility graphs.

### 5.3 Alternatives to keep visible

**Grid A\***

Useful baseline, simple and robust, but introduces cell-resolution artifacts and can make clearance/door width depend on arbitrary grid size. Keep as a possible comparison, not first choice.

**Rapier kinematic character controller**

Useful for local collision-adjusted trajectory execution, but it is not a global route planner. Adopting it now would also change the qualified S0 dynamic-body contact semantics, confounding the experiment. Do not switch movement model merely to solve doorway routing.

Reference: https://rapier.rs/docs/user_guides/javascript/character_controller/

**Recast/Detour / recast-navigation-js / navcat**

Serious candidates when geometry, worlds, multiple agents or dynamic navigation justify them. Recast/Detour includes path queries, crowd/avoidance systems and dedicated debug utilities; current JS ports are browser-compatible. This is valuable evidence that a migration path exists if the small custom experiment stops being adequate.

References:
- https://github.com/recastnavigation/recastnavigation
- https://github.com/isaac-mason/recast-navigation-js
- https://github.com/isaac-mason/navcat

Do not add any of these dependencies in the first S2 implementation unless the bounded spike falsifies the smaller approach.

---

## 6. Dynamic cooperation: do not confuse navigation with yielding

A perfect static path through a doorway still does not solve two bodies trying to use the same narrow space at the same time.

S2 should therefore keep **static routing** and **dynamic cooperation** separate.

### 6.1 First dynamic contract

Before inventing a general crowd system, test a companion-specific rule:

> The companion should strongly prefer not to physically deny the player's immediate movement through a constrained passage.

This is not literal obedience and not a permanent "player always wins" architecture. It is a bounded QoL/cooperation hypothesis.

### 6.2 Required observations before behavior

The companion should be able to classify at least:

- requested motion is making progress;
- static geometry blocks current segment;
- player occupies/intersects the immediate corridor;
- companion is in contact with player while requesting motion into that contact;
- route remains valid but temporarily contested;
- relationship target itself moved or became invalid.

Only after these are observable should S2 add a simple yielding/recovery policy.

### 6.3 First recovery vocabulary

Provisional public states:

- `moving`
- `arrived`
- `waiting`
- `yielding`
- `blocked-static`
- `blocked-player`
- `replanning`
- `unreachable`

These are debug/research states, not a final behavior-tree taxonomy.

---

## 7. Progress awareness and stuck detection

S1 has no memory of attempted traversal success. S2 must.

A small progress monitor should track bounded public facts such as:

- current route revision;
- current segment / waypoint;
- remaining route distance;
- desired velocity magnitude;
- actual velocity magnitude;
- progress along route over a short rolling window;
- consecutive ticks/seconds below expected progress;
- current contacts;
- last blocker classification;
- last replan/recovery tick and reason.

A useful stuck condition should require **intent without progress**, not simply low speed. Standing intentionally at a relationship target must never count as stuck.

Thresholds are experimental and must be visible in debug, not magic constants hidden from the Owner.

Potential first rule:

- meaningful movement requested;
- meaningful route distance remains;
- progress over a rolling window is below a small threshold;
- sustained long enough to exclude normal contact jitter.

Then classify cause before selecting recovery.

---

## 8. Relationship positioning must become route-aware

S2 should preserve S1's separation between relationship selection and movement, but candidate scoring must stop pretending Euclidean distance equals traversal cost.

For each candidate, the debug model should eventually be able to expose:

- endpoint validity;
- direct-corridor validity;
- route reachability;
- route length/cost;
- clearance/choke information if available;
- whether the route is presently contested by the player;
- relationship score terms;
- route-derived score terms;
- hysteresis effect;
- final selection reason.

Do not immediately increase from eight candidates to dozens. First make the eight-candidate causal chain honest and inspectable. If sparse sampling itself becomes the next demonstrated failure, expand it then.

---

## 9. Debug Workbench — first-class S2 deliverable

The Owner explicitly requested unusually strong debug and research QoL. Treat this as core apparatus.

A useful precedent is Unreal's Gameplay Debugger: it groups runtime AI data into toggleable categories such as navigation, behavior and perception instead of dumping everything at once. Unreal's Visual Logger additionally records historical state so transient AI failures can be reviewed after they occur.

References:
- https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-gameplay-debugger-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/visual-logger-in-unreal-engine

We should borrow the **principles**, not the UI wholesale.

### 9.1 Debug categories / presets

Replace the current binary `B debug` concept with an extensible workbench.

Candidate presets:

- **PLAY** — nearly clean screen, only essential state;
- **BRAIN** — relationship intent, candidates, scoring, selection reason;
- **NAV** — reachability, graph, route, waypoints, corridor/blockers;
- **MOTION** — desired vs actual velocity, progress, contact normals, stuck state;
- **ALL** — combined forensic mode.

The Owner should be able to switch these without remembering obscure commands. Keep a compact on-screen legend and clickable/tappable controls where practical.

### 9.2 World-space navigation overlays

At minimum S2 should be capable of drawing:

- companion body radius and optional clearance radius;
- inflated static obstacles used by navigation;
- direct shape/corridor probe to target;
- probe hit point + normal + blocker label;
- route graph nodes/edges when enabled;
- chosen route polyline;
- current waypoint and segment;
- route smoothing/skipped segments;
- relationship candidates colored by reachable/unreachable;
- selected candidate and selected route;
- player predicted short-horizon motion if/when dynamic avoidance is tested;
- waiting/yield target if a yield behavior is active.

### 9.3 Causal inspector

A companion inspector should answer in plain language and values:

```text
relationship goal: back-left of player
selected candidate: back-left
endpoint: clear
route: 3 segments / 4.2 m
next waypoint: doorway entry
movement state: yielding
blocker: player
progress: 0.03 m over 0.5 s
stuck timer: 0.42 s
last change: route contested by player -> yield
next reconsideration: when player clears corridor or timeout expires
```

This is public system state, not model chain-of-thought.

### 9.4 Recent event stream

Maintain a compact bounded event stream with events such as:

- relationship target selected/changed;
- direct corridor became blocked/clear;
- route planned/replanned;
- waypoint advanced;
- progress warning;
- stuck entered/cleared;
- blocker classified;
- yield entered/cleared;
- unreachable state;
- collision/contact begin/end if useful.

Every event should carry tick/time, actor, reason and relevant public values.

### 9.5 Trace ring buffer

Create a small in-memory rolling trace buffer. It should retain enough compact public state to inspect several seconds before and after a failure without turning every frame into giant JSON.

Recommended split:

- low-cost per-tick motion/progress sample;
- event-driven semantic events;
- lower-frequency full debug snapshots.

This becomes the basis for later replay/scrubbing/export.

### 9.6 Owner QoL: incident capture

A high-value S2 capability is an **incident capture** action:

- one key/button marks "this was bad";
- preserve the recent trace window;
- capture current scenario/mode/tick and relevant public debug state;
- optionally export a small JSON diagnostic bundle.

This would let the Owner send the exact causal trace together with or instead of a video. Browser GPT can then inspect the trace directly.

Do not require the Owner to understand or edit the JSON.

### 9.7 Auto-pause / breakpoint-like conditions

Useful optional research triggers:

- auto-pause when stuck exceeds threshold;
- auto-pause on unreachable route;
- auto-pause after N rapid replans;
- auto-pause on prolonged player-companion contact while both request incompatible motion.

These should be toggles, not always-on behavior.

### 9.8 Time controls

Preserve existing pause/single-step and plan for:

- 0.25x / 0.5x / 1x / 2x simulation speed;
- deterministic scenario reset;
- clear indication of paused/speed state;
- later, replay/scrub if the trace architecture proves useful.

Do not build a full replay editor before the trace data earns it.

---

## 10. S2 implementation sequence

### S2-A — observability skeleton first

Before changing behavior materially:

1. define public navigation/progress/debug state types;
2. create debug category/preset system;
3. add recent event stream + compact trace ring buffer;
4. add incident capture primitive;
5. preserve old S1 behavior so the workbench can diagnose the known doorway failure.

**Gate:** the existing failure should become easier to explain before we try to fix it.

### S2-B — direct traversal feasibility

1. expose a read-only companion-radius corridor/shape query;
2. show direct-clear vs blocked visually;
3. attach blocker identity/hit point/normal to public debug state;
4. make relationship candidates aware of direct feasibility without yet inventing routing.

**Gate:** doorway/pillar target states must clearly distinguish "point clear" from "cannot travel directly".

### S2-C — minimal static routing

1. prototype inflated-obstacle visibility graph;
2. deterministic shortest path;
3. route cache/revision;
4. waypoint execution;
5. path smoothing via direct-corridor checks;
6. expose all of it in NAV debug.

**Gate:** companion can route around the pillar and through an unoccupied doorway without geometry-specific hardcoded exceptions.

### S2-D — progress monitor and recovery

1. rolling progress measurement;
2. stuck classification;
3. static blocker -> replan;
4. invalid/unreachable target -> report and relationship reconsideration;
5. no silent infinite pushing into static geometry.

**Gate:** every sustained non-progress case has a visible public classification and bounded response.

### S2-E — player-aware doorway cooperation

Only after static navigation is proven:

1. detect immediate player/companion corridor contention;
2. test a simple companion-yields-first policy;
3. provide visible waiting/yield state;
4. stress repeated crossings, reversals and doorway entry from both sides.

**Gate:** fewer prolonged mutual blocks than S1, without teleporting, disabling collision or special-casing the authored doorway object.

### S2-F — Owner comparison and falsification

Run controlled comparisons:

- S1 direct relational baseline;
- S2 route-aware without player-yield logic;
- S2 route-aware + yielding;

Use the same scenarios and fixed starts where possible.

Do not evaluate only whether it "gets through". Evaluate legibility, responsiveness, obstruction, recovery, oscillation, route quality and how quickly the Owner can diagnose odd behavior.

---

## 11. Explicitly deferred

S2 should not automatically include:

- combat;
- enemies;
- commands;
- LLM cognition;
- personality/memory;
- multi-companion squad planning;
- ORCA/RVO crowd avoidance;
- full navmesh dependency;
- soft collision;
- animation polish;
- final UI styling.

Any of these may become justified by evidence, but none should dilute the current movement/debug question.

---

## 12. Falsifiers

S2 should be reconsidered if:

- the visibility-graph spike requires large amounts of brittle geometry special-casing;
- static route correctness remains hard to establish visually or mechanically;
- debug infrastructure becomes coupled directly to one brain implementation;
- the companion appears competent only because collisions are disabled or teleports are introduced;
- yield logic turns into doorway-name-specific scripting;
- route planning thrashes continuously as the player moves;
- route-aware candidate scoring becomes too expensive or opaque even for one/few companions;
- the workbench produces so much visual noise that Owner diagnosis becomes slower, not faster.

If the small routing substrate fails these tests, escalate deliberately to a more general navigation solution rather than continuing to patch it.

---

## 13. What may become a sibling donor later

Do not extract a shared package yet, but watch these seams closely because they may become useful to `Llm-Live-NPC`:

- generic read-only spatial query contract;
- route request/result provenance;
- movement progress/stuck classification;
- compact causal event stream;
- trace ring buffer / incident capture;
- layered debug category system.

Companion-specific relationship scoring, yielding policy and tactical semantics should remain local until repeated evidence shows otherwise.

---

## 14. Current decision

**Proceed with S2-A before implementing a navigation fix.**

Reason: the Owner explicitly wants deeper work and stronger debug. Building the observability skeleton first lets every following navigation/yield experiment produce better evidence and prevents us from hiding another shallow heuristic behind a behavior that merely looks improved.

The first visible S2 milestone should therefore be:

> reproduce the known S1 doorway failure, but with enough live instrumentation that the Owner and agent can immediately see the target, direct traversal feasibility, blocker, progress history and reason no recovery exists yet.

Only after that evidence is clear should S2-B/C change movement behavior.
