# Companion Brain Lab — First Physical Cooperation Apparatus Audit

Status: **selected experimental skeleton, not final architecture**  
Date: 2026-09-13

This pass answers the next bounded question from the initial research skeleton:

> What is the smallest physical apparatus in which companion intelligence failures become real, observable and useful to study — without prematurely selecting the final brain architecture?

The output is deliberately a **first experimental apparatus hypothesis**. It should be cheap to replace if the first Owner runs show that the apparatus itself is distorting the problem.

---

## 1. Current decision

### Current-best apparatus hypothesis

Use a **browser-first TypeScript laboratory** with:

- Vite + TypeScript + Vitest for the development/test substrate;
- Phaser as **render/input/debug presentation only**;
- a fresh companion-native domain `World` that remains authoritative over game meaning and factual outcomes;
- Rapier 2D as a **bounded collision/query kernel behind the World boundary**, initially emphasizing kinematic/top-down movement rather than rigid-body simulation spectacle;
- one fixed simulation clock independent of rendering;
- one player + one companion as the first causal unit;
- intentionally simple authored 2D geometry;
- deterministic scenario setup/reset and strong public-state debug overlays;
- no LLM, memory system, generic planner, squad brain or final command system in the first slice.

This is **not** a decision that future Companion Brain Lab, `Llm-Live-NPC`, or a shared runtime must use Rapier or Phaser.

It is a decision that the first companion experiment deserves a physical substrate stronger than the current resident world's custom blocker sweep, while keeping physics/rendering subordinate to the domain experiment.

---

## 2. Why the physical substrate is part of the AI experiment

Companion behavior cannot be evaluated independently from the body's capabilities.

If the companion wants to yield but the motion system cannot resolve a narrow passage, the brain will look stupid for a locomotion failure.

If collision automatically pushes the companion out of the player's way, a poor positioning brain may look better than it is.

If actors can overlap freely, we cannot study obstruction, spacing or doorway ownership at all.

Therefore the apparatus must expose a clean distinction between:

```text
brain / positioning intent
        ↓
locomotion request
        ↓
physical resolution
        ↓
actual movement / contacts
        ↓
factual feedback
```

Debugging must make both the **desired** and **physically achieved** movement visible.

---

## 3. Technology audit

### 3.1 Fresh custom collision only

**Advantages**

- smallest dependency surface;
- completely transparent behavior;
- easy deterministic headless tests;
- direct continuity with the current `Llm-Live-NPC` world style.

**Problems**

The sibling currently resolves actors against static AABB blockers with custom swept movement, but does not solve actor↔actor contact. Companion research makes actor↔actor spatial interaction a first-class phenomenon rather than an incidental feature.

Extending the custom solver to moving circles, simultaneous movement, depenetration, sliding, contact reporting and later richer combat geometry risks turning the first AI stage into a collision-engine project.

**Verdict:** reject as the primary v0 physical kernel. Preserve the option for tiny domain-level geometry helpers.

### 3.2 Phaser Arcade Physics

Phaser documents Arcade Physics as a lightweight circle/AABB system appropriate for top-down games and supports fixed-step simulation. That simplicity is attractive.

However, Phaser's current API documentation explicitly warns that its projection/separation approach can lack stability when several objects are close or resting against one another, because resolving one penetration may create another.

That is precisely the regime this laboratory must inspect: player + companion + enemies + walls + narrow passages.

**Verdict:** useful for ordinary arcade games, but a poor epistemic choice for our first companion-body research substrate. Do not make Arcade Physics authoritative here.

Sources:
- https://docs.phaser.io/phaser/concepts/physics/arcade
- https://docs.phaser.io/api-documentation/class/physics-arcade-arcadephysics

### 3.3 Phaser Matter Physics

Matter provides a substantially fuller rigid-body system than Arcade, including more complex shapes, constraints and collision behavior.

That is capable enough, but it makes presentation framework and physical simulation more tightly coupled and gives us much more rigid-body behavior than the first research question needs.

Our immediate need is not realistic boxes, joints or force-driven combat. It is **controlled character movement with trustworthy collision information**.

**Verdict:** valid fallback/candidate for later physics-heavy experiments, not current-best v0.

Source:
- https://docs.phaser.io/phaser/concepts/physics/matter

### 3.4 Rapier 2D behind a domain boundary

Rapier's JavaScript 2D engine offers colliders, collision groups, sensors/events, queries and a kinematic character controller that takes desired translation and computes obstacle-constrained movement. It also exposes collision information generated while resolving character movement.

This is unusually well aligned with the apparatus question:

- the brain can emit desired movement;
- the physical kernel can report corrected movement and contacts;
- the domain World can remain authoritative over semantic outcomes;
- Phaser need not become physical truth;
- player, companion and later enemies can share the same collision/query substrate;
- the same physical layer can run without rendering in scenario tests.

Important caution: current Rapier materials are not perfectly consistent about cross-platform determinism guarantees across package/build variants. We therefore **will not claim cross-browser bitwise determinism until we test the exact chosen build ourselves**. Same-machine repeatability and deterministic scenario inputs are enough for the first apparatus.

Current package signal inspected: `@dimforge/rapier2d` 0.20.0 on npm at audit time.

Sources:
- https://rapier.rs/docs/user_guides/javascript/character_controller/
- https://rapier.rs/docs/user_guides/javascript/collider_collision_groups/
- https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/
- https://www.npmjs.com/package/@dimforge/rapier2d

**Verdict:** current-best v0 physical kernel, subject to a tiny implementation spike before architecture commitment.

### 3.5 Recast / Detour navigation

`recast-navigation-js` currently provides browser/Node navmesh generation, path queries, crowd simulation and temporary obstacles.

It is powerful and credible, but **too much apparatus for the first experiment**. Adding a navmesh/crowd stack before we know whether the first small arenas need it would hide simple causal behavior behind another substantial system.

The current sibling's tiny visibility-graph pathfinder already demonstrates that authored rectangular geometry can support transparent static path planning.

**Verdict:** defer. Revisit when obstacle topology becomes rich enough that simple transparent routing begins consuming research effort or producing misleading movement failures.

Source:
- https://docs.recast-navigation-js.isaacmason.com/

---

## 4. Domain / renderer / physics authority

The first apparatus should preserve this separation:

```text
INPUT / DEBUG UI / RENDERER (Phaser)
             │
             ↓
       domain frame host
             │
      ┌──────┴─────────┐
      ↓                ↓
brain/controllers   domain World rules
      │                │
      └── desired ──────┤
          movement      ↓
                  Rapier collision/query
                         │
                         ↓
                 actual transforms/contacts
                         │
                         ↓
                 domain factual outcomes
```

Rapier may own the numerical physical state needed to resolve movement/collision, but **Rapier objects/handles are not the agent's semantic world model**.

Phaser mirrors domain/physical state for presentation. It does not become gameplay authority.

This preserves an important sibling compatibility boundary without copying the sibling implementation.

---

## 5. Fixed-step model

Use one explicit fixed simulation step, initially **60 Hz as a working default** because the experiment studies close-range movement and rapid local reactions.

This value is a tuning hypothesis, not a durable contract.

The apparatus must support:

- stepping simulation without rendering;
- resetting to an exact authored scenario;
- pausing and single-stepping from debug mode;
- render interpolation or simple render mirroring without changing domain truth;
- later measurement of brain update rates independently from the World/physics tick.

Do **not** make `brain tick = physics tick` a permanent assumption. A local brain may eventually contain sub-systems at different rates.

---

## 6. Initial body model

### Start with simple circular actors

Player, companion and initial enemy actors should begin as circles/balls in top-down space.

Reasons:

- symmetric footprint avoids making body orientation a collision problem before it matters;
- circle contact makes narrow-passage and crowding behavior easy to inspect;
- Rapier directly supports simple ball shapes and recommends simple primitive shapes for character control;
- the brain's facing/aim direction can remain separate from physical orientation.

Do not add skeletal hitboxes or complex weapon bodies yet.

### Start with truthful solid contact

The first baseline should **not hide companion blocking through teleportation, ghosting or automatic player-through-companion collision cheats**.

That will sometimes feel bad. It is useful negative evidence.

The apparatus should log obstruction/contact so we can later compare deliberate policies such as:

- solid symmetric bodies;
- companion-yields-to-player;
- soft player push-through;
- selective collision disable under pathological conditions;
- bounded catch-up/teleport rules.

Those alternatives should be introduced as explicit hypotheses after the baseline demonstrates why they are needed.

This follows an important lesson from shipped buddy AI: cheats can be appropriate when they protect the player relationship, but they should solve an observed experiential failure rather than quietly mask our brain defects.

---

## 7. Static geometry and navigation

### First arenas

Use deliberately simple authored shapes:

1. **open field** — isolates pure relational positioning;
2. **single pillar / obstacle** — exposes route choice and loss/reacquisition of useful relative position;
3. **doorway / narrow corridor** — exposes body blocking, yielding and ordering;
4. **small combat pocket** — enough room for player, companion and one threat to compete for positions.

Do not build a large map.

### Static routing

For v0, prefer a transparent static route layer over a full navmesh.

The sibling's `findNavigationPath()` is a small visibility graph over inflated rectangular blockers. Its conceptual shape is appropriate for these tiny authored arenas and should be considered an **adapted donor candidate** if our geometry remains rectangular.

Source donor at audit time:

`Jozzpoly/Llm-Live-NPC`  
`integration/first-hearth-resident-loop-2026-09-12`  
`src/execution/navigation.ts`

Do not transplant blindly. In Companion Brain Lab it must be separated from dynamic actor avoidance and must report enough path state for debugging.

Dynamic actor interaction belongs initially to local locomotion/positioning, not static path planning.

---

## 8. Minimum combat pressure — intentionally not a combat game yet

A companion lab focused on combat cannot postpone threat forever, but a full combat system would contaminate the first question with too many variables.

### v0 action vocabulary

Keep only enough mechanics to create tactical pressure:

- actor movement;
- facing / aim direction;
- simple melee attack request;
- deterministic attack windup;
- range/arc check at resolution time;
- short recovery/cooldown;
- simple health or hit-count state;
- factual `hit / miss / rejected` outcome;
- optional short stun only if needed to make threat readable.

No inventory, equipment stats, combo trees, stamina, armor, status effects, projectiles or animation-driven hitboxes yet.

### Enemy v0

One deliberately simple hostile actor is enough.

It does not need sophisticated enemy AI. It needs to provide **predictable pressure** so we can test whether the companion's position relative to the player becomes useful or harmful.

Initial modes can be deterministic fixtures, for example:

- stationary threat facing a direction;
- slowly approaching melee threat;
- scripted attack cadence;
- later, one very small reactive enemy controller.

The enemy is apparatus, not the research subject.

---

## 9. First local-brain research question

Do **not** start with a general "combat brain".

Start with:

> **Can one companion maintain a useful, stable spatial relationship to a freely moving player — including stops, reversals, obstacles and narrow passages — without obstructing the player, rubber-banding constantly, or behaving like a point-following drone?**

This is the first local-brain question because:

1. it is required in travel, combat preparation and active combat;
2. it directly affects whether the player experiences the NPC as a partner or nuisance;
3. it can be studied without selecting a general planning architecture;
4. failure is visible immediately in Owner play;
5. it provides the base primitive for later protect/flank/hold/follow semantics;
6. shipped buddy AI work independently identifies companion positioning as a major hard problem.

Naughty Dog's published Ellie work is particularly relevant: they used a **follow region** around the leader, generated multiple candidate positions and evaluated them rather than chasing one fixed offset. They found that being too close restricts player freedom while being too far weakens the companion relationship.

Sources:
- https://www.gamedeveloper.com/design/endure-and-survive-the-ai-of-the-last-of-us
- https://www.gdcvault.com/play/1021010/Ellie-Buddy-AI-in-The-Last-of-us

God of War Ragnarök's companion traversal work is another useful signal that pathing, AI behaviors and dynamic companion positioning deserve dedicated systems rather than being treated as a trivial follow command.

Source:
- https://www.gdcvault.com/play/1029003/Companion-Traversal-in-God-of

---

## 10. First experiment family: relational positioning

This is **not a selection of Utility AI** or another global decision architecture.

Treat position selection itself as a bounded experiment with competing baselines.

### Baseline A — point follower

Companion seeks one fixed offset / target point relative to player.

Purpose: establish the obvious failure baseline.

### Baseline B — follow region

Companion accepts a region/annulus around the player as valid rather than one exact point.

Purpose: test whether freedom inside a relation constraint reduces oscillation and obstruction.

### Baseline C — candidate position selection

Generate a small number of reachable positions around the player and compare them using only currently justified considerations such as:

- desired distance band;
- relative angle to player facing/motion;
- path length / obstruction;
- cost of crossing directly through the player's likely path;
- distance to current position (hysteresis/stability);
- nearby threat exposure once the threat fixture is enabled;
- spacing from other actors when a second companion is eventually introduced.

The score representation is an experiment implementation detail, not a commitment to a project-wide utility architecture.

### Public output

Whichever baseline is active should expose at minimum:

- selected desired position/region;
- desired velocity;
- actual resolved velocity;
- current path/waypoint if any;
- reason for a target-position change in a compact enumerable form;
- recent collision/obstruction contacts.

---

## 11. Required first scenarios

### S0 — physical truth qualification

No autonomous brain required.

Player and companion are independently controllable/debug-driven. Validate:

- solid actor contact;
- wall sliding/collision;
- fixed-step consistency;
- reset;
- desired vs actual movement instrumentation;
- no renderer authority leakage.

**Purpose:** do not blame the brain for broken apparatus.

### S1 — open-field follow

Player walks, runs, stops and changes direction unpredictably.

Questions:

- does the companion maintain presence without orbiting/thrashing?
- does it constantly cross the player's path?
- does it settle naturally when the player stops?

### S2 — reversal / crossover

Player repeatedly reverses direction and makes tight turns.

This attacks fixed-offset chasing and position-switch instability.

### S3 — doorway

Player and companion approach and traverse a narrow opening.

Questions:

- who yields?
- does the companion block the player?
- can it recover after being displaced?
- does it oscillate between candidate sides?

### S4 — separation and regroup

Player deliberately runs away / around an obstacle.

Questions:

- how rapidly should companion urgency increase with distance?
- does it choose a sensible route?
- when does normal positioning become catch-up?
- do we eventually need explicit bounded catch-up cheats?

### S5 — threat readiness

A deterministic hostile enters or becomes relevant while the pair are moving.

No complex combat response yet.

Question:

> Does the companion transition from a travel relationship into a position that looks plausibly ready to cooperate without immediately stealing control of the encounter?

### S6 — minimal melee pressure

One simple hostile attacks on a known cadence.

The companion gets only a minimal assistance behavior sufficient to reveal whether its spatial choices help or interfere with the player.

Do not expand this scenario into the full combat brain until S0–S5 are understood.

---

## 12. Evidence and instrumentation

### Mechanical evidence

- World advances exactly once per simulation tick;
- fixed reset reproduces the same authored initial state;
- brain cannot directly mutate actor transforms or combat outcomes;
- physical contact/result path is observable;
- renderer changes cannot change domain truth;
- scenario fixtures run headlessly where possible.

### Quantitative observations

Do not optimize these blindly; use them to explain Owner feel:

- player↔companion distance distribution;
- time companion spends physically obstructing player movement;
- number/duration of player-companion contacts;
- frequency of companion crossing through the player's forward path;
- desired-position switches per second;
- recovery time after separation;
- path recomputations / failed routes;
- fraction of desired movement lost to collision;
- distance/time spent outside acceptable follow relation;
- later: response time from threat state change to meaningful repositioning.

### Owner judgement

The first qualitative gate is intentionally plain:

> **With no commands and no LLM, does moving around with this NPC begin to feel like moving with someone rather than dragging a marker behind me?**

The Owner should be able to identify annoyance, trust, predictability, useful initiative and unnatural artifacts from short unscripted runs.

---

## 13. Debug UX required from the start

Toggleable overlays should be treated as apparatus, not polish.

Minimum v0 overlays:

- actor physical body circles;
- collision contacts;
- desired movement vector;
- actual resolved movement vector;
- companion acceptable follow region;
- candidate positions and selected position;
- static route/path;
- player facing/motion direction;
- current companion public mode (`manual`, `point-follow`, `region-follow`, etc. — research labels only);
- compact recent decision-change / obstruction log;
- simulation tick and pause/single-step state.

Later threat experiments add:

- perceived threat markers;
- current attention/target;
- threat influence on position candidates;
- attack windup/range/arc visualization.

Do not expose hidden LLM chain-of-thought if higher cognition arrives later. Debug public causal state.

---

## 14. Deliberately deferred

The first apparatus does **not** need:

- final art or animation;
- Blockbench pipeline;
- dialogue;
- LLM API;
- persistent memory;
- save game;
- inventory/equipment;
- ranged combat;
- cover system;
- formations;
- group commands;
- second companion;
- learning;
- navmesh/crowd system;
- full behavior tree / planner framework;
- server backend;
- multiplayer;
- production deployment architecture beyond what is needed for easy Owner access.

Any of these can enter when an experiment earns them.

---

## 15. Consequence for sibling collaboration

This apparatus creates a useful deliberate divergence from `Llm-Live-NPC`:

- sibling resident world remains evidence for semantic authority boundaries;
- Companion Brain Lab becomes the stronger pressure test for actor↔actor movement, spatial cooperation and multi-controller frame hosting;
- if the companion-native frame/physics boundary proves robust, **it may later donor back** to the resident project rather than the companion project being forever downstream.

That reciprocal possibility is exactly why the repositories remain siblings.

---

## 16. Readiness gate before implementation

The first implementation slice is justified when we can answer "yes" to these questions:

1. Is the first research question narrow enough to falsify? **Yes — relational positioning/cooperative locomotion.**
2. Can apparatus failure be distinguished from brain failure? **Designed yes; must be proven in S0.**
3. Is the physical substrate current-best rather than inherited by habit? **Yes — Rapier is selected provisionally after custom/Arcade/Matter comparison.**
4. Is the renderer prevented from becoming World authority? **Yes by design.**
5. Are we avoiding a final brain architecture decision? **Yes.**
6. Is there a clear Owner-playable qualitative gate? **Yes.**
7. Can the work later donor to `Llm-Live-NPC` without requiring compatibility now? **Yes.**

**Current judgement: planning is sufficient to begin a tiny S0 apparatus spike next, but not sufficient to implement the general companion brain.**

The next implementation should prove only the apparatus boundary: fixed-step domain World + Rapier collision/query + Phaser presentation + player/companion bodies + reset/debug instrumentation. Then re-audit before autonomous following is added.
