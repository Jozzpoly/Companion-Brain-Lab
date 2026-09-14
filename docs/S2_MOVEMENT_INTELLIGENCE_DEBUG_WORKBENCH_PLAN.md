# S2 — Movement Intelligence + Debug Workbench

Status: **ACTIVE — S2-A AUTOMATED PASS; S2-B AUTOMATED PASS / OWNER DEBUG GATE OPEN**

Detailed S2-B qualification evidence: `docs/S2B_DIRECT_TRAVERSAL_QUALIFICATION.md`.

## Core research question

> Can one companion maintain a useful relationship to a moving player through constrained 2D geometry by separating relationship intent, route feasibility, movement execution, progress/recovery and player-aware cooperation — while making the entire causal chain visible enough for rapid Owner diagnosis?

## Stage rule: observability precedes repair

When something looks stupid, the workbench should make it possible to determine quickly:

- what the companion wanted;
- what it believed was traversable;
- what route / immediate movement it chose;
- what physically happened;
- whether progress was made;
- what blocked it;
- why it replanned, waited, yielded, recovered or reconsidered the relationship target.

These are public causal states, not hidden model reasoning.

## Working responsibility seams

```text
relationship intent
        ↓
traversal / route request
        ↓
route / movement plan
        ↓
local movement execution
        ↓
World / physics authority
        ↓
progress / blocker observation
        ↓
replan / wait / yield / recover / reconsider
```

The exact classes are not canonical. The research question is whether these boundaries improve causality, testability and donor potential.

---

## S2-A — Debug Workbench

Status: **AUTOMATED PASS**.

Established:

- bounded rolling research trace;
- semantic event stream;
- public debug channels;
- incident capture (`I`);
- presets `PLAY / BRAIN / NAV / MOTION / ALL` (`B` cycles them);
- scenario/mode, relationship-slot and contact transition events;
- requested-vs-actual movement evidence.

S2-A deliberately changed no companion movement behavior.

---

## S2-B — Whole-body direct traversal

Status: **AUTOMATED PASS / OWNER DEBUG GATE OPEN**.

Qualified application SHA: `152fc799bd87d0fdd57198d3a825df295bf29799`.

S2-B distinguishes:

- destination point being clear;
- the whole companion body being able/unable to travel directly to that target.

The read-only World query exposes:

- clear / blocked;
- actor radius;
- total path length;
- first static blocker identity;
- hit distance and normalized fraction;
- hit-center;
- contact point;
- contact normal.

Dynamic player/companion bodies are deliberately excluded. Static feasibility and contested-passage cooperation are separate research questions.

The NAV workbench visualizes the whole swept corridor and blocker geometry and records the same values in semantic events and incident bundles.

**S2-B does not change navigation behavior.** The known doorway/pillar failures should remain reproducible, but substantially easier to explain.

---

## S2-C — Minimal deterministic static routing

Status: **NOT STARTED**.

Begin only after S2-B browser evidence is trusted.

Current-best bounded hypothesis:

1. reason about authored geometry with companion-radius clearance;
2. derive a small deterministic set of useful vertices / passage portals;
3. connect two nodes only when the same S2-B whole-body direct traversal says the segment is clear;
4. deterministic shortest-path search;
5. simplify/smooth only through the same feasibility primitive;
6. expose candidate graph, rejected edges, chosen route, waypoint index, route cost and rejection reason through NAV debug.

This is an experimental substrate, not a declaration that the final game will use visibility graphs.

Primary falsifiers:

- route around the pillar;
- doorway approach from offset positions;
- narrow clearance where center-point routing would lie;
- target movement invalidating an old route;
- truly unreachable target;
- deterministic equal-cost route choice;
- excessive brittle geometry special-casing.

---

## S2-D — Progress intelligence / stuck classification

Status: **NOT STARTED**.

Observe bounded facts such as:

- route distance remaining;
- requested vs actual movement;
- waypoint progress;
- recent displacement;
- contact history;
- target movement / route invalidation;
- time since meaningful progress.

Low speed alone must never mean stuck. A companion intentionally standing at its goal is not stuck.

Desired causal vocabulary may include:

- `blocked-static`;
- `blocked-player`;
- `route-invalid`;
- `target-moved`;
- `waiting`;
- `yielding`;
- `unreachable`.

Recovery follows classification. Do not use ad-hoc behavior such as “if stationary 0.5 s, turn left”.

---

## S2-E — Constrained-space cooperation

Status: **NOT STARTED**.

Static routing cannot solve two actors contesting the same narrow passage.

First bounded hypothesis, only after routing/progress are visible:

- detect a short-horizon shared passage conflict;
- companion normally cedes scarce passage to the player;
- enter an explicit `YIELDING` state;
- expose reason and resume condition;
- generalize beyond the authored doorway fixture.

No `if (scenario === "doorway")` behavior is acceptable.

---

## Debug Workbench direction

Current:

- causal channel categories;
- recent semantic events;
- rolling trace;
- incident capture;
- brain candidate/selection evidence;
- requested vs actual motion;
- whole-body direct traversal corridor;
- blocker hit-center/contact/normal.

Candidate next QoL, only as active research earns it:

- route graph / accepted and rejected edge overlay;
- route polyline + waypoint progression;
- route cost / revision;
- progress window and stuck classification;
- dynamic conflict / predicted corridor overlay;
- explicit state-transition reason + resume condition;
- auto-pause on selected failures;
- 0.25x / 0.5x / 1x / 2x time controls;
- bounded replay / trace scrub.

Owner-facing criterion:

> When something looks wrong, can the Owner understand what the system believed and what prevented it within seconds rather than reverse-engineering behavior from motion alone?

---

## Explicitly deferred

Do not automatically add:

- combat/enemies;
- command systems;
- LLM/higher cognition;
- personality/memory;
- multi-companion squad logic;
- ORCA/RVO crowd avoidance;
- full navmesh/crowd dependency;
- soft collision;
- animation/final UI polish.

The qualified hard-contact S0 baseline remains valuable because it exposes movement-intelligence failures instead of hiding them.

## Current next move

1. publish the exact qualified S2-B browser artifact;
2. reproduce pillar/doorway failures in `NAV` / `ALL`;
3. verify that corridor/blocker diagnostics agree with visible reality;
4. only then start S2-C static routing.
