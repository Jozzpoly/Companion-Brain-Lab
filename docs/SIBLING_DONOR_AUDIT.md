# Companion Brain Lab — Initial Sibling Donor Audit

Status: working audit, **not a transplant plan**  
Source sibling: `Jozzpoly/Llm-Live-NPC`  
Source line inspected: `integration/first-hearth-resident-loop-2026-09-12`

This audit asks a narrower question than `INITIAL_RESEARCH_SKELETON.md`:

> Which existing `Llm-Live-NPC` boundaries are genuinely useful to Companion Brain Lab, which are only superficially similar, and where would reuse import the wrong assumptions?

The answer is intentionally asymmetric: a concept may be valuable while its current implementation is not suitable for direct reuse.

---

## 1. Executive judgement

**Do not seed Companion Brain Lab by copying the current `Llm-Live-NPC` source tree.**

The sibling contains several excellent *semantic* donors, but the current executable world is still a resident-oriented specimen with assumptions that are too narrow for companion combat:

- exactly one canonical player is baked into important world/execution paths;
- actors share one global movement speed;
- movement resolves against static blockers but does not currently model actor↔actor body collision;
- world actions are presently item interaction/drop oriented;
- the deterministic executor supports one narrow `approach-and-interact` task;
- the current `ExecutionDriver` owns one `DeterministicExecutor` and at most one executor atomic action per frame;
- important event/location state remains player-specific;
- the runtime and cognition infrastructure carry substantial resident/First-Hearth history that Companion Brain Lab does not need on day one.

At the same time, the source line already proves several boundaries that are likely worth preserving conceptually:

- one authoritative World step;
- multi-actor controls can enter a single world step;
- world snapshots are domain data independent of Phaser rendering;
- cognition/executor does not directly mutate world truth;
- action attempts receive explicit succeeded/rejected results;
- causal action provenance is retained outside gameplay authority;
- occurrence listeners are observational and fault-isolated;
- debug histories are bounded and non-authoritative.

**Current-best donor strategy:** build a small new companion-native physical apparatus using these proven ideas, and copy/adapt code only after a responsibility passes a source-assumption audit.

---

## 2. Source stack observed

The inspected sibling line uses:

- TypeScript;
- Vite;
- Vitest;
- Phaser `4.2.1`;
- Cloudflare Worker / Wrangler for deployment and server/provider paths.

The client/world logic is already separated enough that adopting TypeScript/Vite/Phaser would not require adopting the resident LLM stack. However, technology choice remains open until the first companion apparatus is defined.

---

## 3. Donor matrix

| Area | Conceptual donor | Direct code donor now? | Initial judgement |
| --- | --- | --- | --- |
| World owns physical truth | **strong** | partial | preserve principle; adapt implementation |
| Fixed authoritative World step | **strong** | likely partial | promising shared seam |
| Multi-actor control submission | **strong** | likely adapt | particularly relevant to 1→few companions |
| World snapshot as plain domain data | **strong** | likely partial | good test/debug substrate |
| Static blocker collision | moderate | possible | useful apparatus code, not enough for combat |
| Actor facing / look direction | strong | possible | likely useful with combat extensions |
| Line-of-sight primitive | strong | possible | useful but too simple to assume final |
| Occurrence/event observation | **strong** | likely adapt | good perception/debug boundary |
| World action request/result | **strong** | shape must change | semantic seam excellent; current verbs too narrow |
| Deterministic executor | moderate concept | **no direct base** | current task is item-centric and too narrow |
| Execution driver | strong concept | **no direct base** | one-executor assumption conflicts with few companions |
| Bounded action provenance | **strong** | likely adapt | valuable debugging/evidence donor |
| Navigation | moderate | audit later | combat positioning may require different substrate |
| Phaser presentation shell | uncertain | audit later | convenience donor only; prior Owner feel/visual issues matter |
| Resident semantic kernel | weak for first stage | no | avoid initial coupling |
| First Hearth activity lifecycle | weak for first stage | no | resident-specific |
| LLM/provider transport | low for first stage | no | defer until local brain has concrete deficits |
| Memory/continuity machinery | low for first stage | no | defer; companion continuity may later need different semantics |

---

## 4. World layer — valuable boundary, insufficient combat substrate

### 4.1 What is already good

The source `World` is independent of the renderer and owns its entities, blockers, locations, actions, occurrences and time progression.

`stepWithActorControls()` accepts the player control plus an array of actor controls, validates duplicate/invalid actor channels, sorts controlled actors deterministically by actor id, increments the World tick once, then moves all controlled actors in that same authoritative step.

That is directly aligned with an important companion invariant:

> More companions must not mean more World time.

This makes the *shape* of the world-control boundary a strong donor.

### 4.2 Player-specific assumptions to remove rather than inherit

The current World still has a singular `player()` lookup and tracks `playerLocationId`. Location entered/exited events are updated specifically for that player. Companion research will likely need actor-generic spatial state and events.

This is not a criticism of the sibling implementation: it is appropriate evidence of the source project's stage. It is a warning against calling the current implementation a generic shared world core.

### 4.3 Movement is intentionally too simple for companion combat

Current movement:

- one `actorSpeed` applies to the whole specimen;
- input is a normalized 2D move vector plus optional look direction;
- actors sweep against static AABB blockers;
- the inspected movement code does not resolve collisions or spacing between actors themselves.

For the sibling resident lab this can be enough to study presence and grounded interaction. For Companion Brain Lab, **player↔companion body relationship is itself a core research problem**. Blocking doors, shoulder-to-shoulder movement, yielding, crowding and collision/avoidance cannot be hidden below the apparatus.

Therefore do not inherit this movement model as a shared-core commitment.

### 4.4 Line of sight is a useful primitive, not final tactical awareness

The current World provides blocker-based segment/AABB line-of-sight. That is a useful starting primitive for controlled experiments.

Combat research may later need richer questions — partial exposure, facing/FOV, cover, projectile paths, audibility, last-known positions, terrain cost, etc. Those should be introduced only when a scenario requires them.

---

## 5. Action boundary — excellent semantic donor, wrong current vocabulary

`WorldActionRequest` currently supports item-oriented `interact` and `drop`; `WorldActionResult` records actor, action, target, tick/sequence, succeeded/rejected status and a grounded result code.

This is one of the best donor ideas in the repository:

> An AI system requests an embodied attempt; World decides whether it actually happened and returns factual evidence.

For companion combat, the verbs will necessarily change. Candidate future actions may include attack/block/dodge/use ability/interact/etc., but the vocabulary should be earned from the first combat apparatus rather than designed exhaustively now.

**Recommendation:** preserve the request/result authority pattern while redesigning the domain vocabulary locally.

---

## 6. Execution boundary — conceptually strong, implementation should fork immediately

### 6.1 Deterministic executor is intentionally narrow

The inspected executor owns one task kind:

`approach-and-interact(actorId, targetId)`

It pursues a target, emits movement control until within approach distance, then emits an interaction action. It tracks explicit running/succeeded/failed state, step budget and run provenance.

The lifecycle/provenance discipline is valuable. The task vocabulary is not.

A combat companion's continuous local brain may need to produce or arbitrate many short-lived controls and tactical intents, where "task" itself may not be the right primitive.

Do not stretch `approach-and-interact` architecture into combat just to maximize reuse.

### 6.2 Current ExecutionDriver exposes a key scaling mismatch

The driver currently:

1. validates one canonical player's external input;
2. snapshots World;
3. queries one `DeterministicExecutor`;
4. advances World once with player + optional one-executor actor control;
5. applies queued player actions;
6. applies at most one executor atomic action;
7. records bounded action-attempt provenance.

This is a very good resident causal frame, but **not yet a few-companion execution host**.

A companion-native host will probably need to gather controls/action proposals from multiple independent actor brains before one World step and resolve deterministic ordering/conflicts without making a global AI monolith.

The source driver should therefore be used as a specification donor for causal ordering and provenance, not copied as the first runtime host.

### 6.3 Potential common seam hiding underneath

A genuinely reusable future boundary may be smaller than either project's current driver:

```text
pre-step World snapshot
        ↓
actor-local controllers / executors propose bounded controls/actions
        ↓
frame host validates/arbitrates channels
        ↓
one authoritative World step + atomic attempts
        ↓
factual results / occurrences
```

This is intentionally only a semantic sketch. Companion experiments should be allowed to falsify it.

---

## 7. Occurrence / perception boundary — strong donor candidate

The current World exposes physical occurrences such as item pickup/drop, speech and calls through read-only occurrence listeners. The comments explicitly constrain subscribers to sensory admission and prohibit them from performing World actions through that callback.

This is a good pattern for companion research because it prevents "perception" from becoming an accidental second authority path.

However, combat will likely require more continuous sensing than sparse occurrences alone. A local live brain may legitimately query a bounded current sensory projection every simulation tick while still receiving discrete events for salient transitions.

Do not force all perception through an event log merely because the resident system has useful event semantics.

A likely experiment direction is therefore:

- **continuous local sensory projection** for fast geometry/actors/threats;
- **discrete occurrences** for salient changes and causal history;
- explicit separation from omniscient World internals.

Again, this is a hypothesis to test, not a selected final perception architecture.

---

## 8. Debugging/provenance — strongest cross-project donor family

The sibling already contains several dedicated debug panels/workspaces and bounded action-attempt histories. The execution code explicitly prevents diagnostics from becoming gameplay/cognition authority.

Companion Brain Lab should preserve that discipline from the beginning.

The exact debug surface should be different because the questions are different. Early companion debugging is likely to care more about:

- current perceived threats and allies;
- player-relative spacing;
- desired position / movement vector;
- current command constraints;
- attention / target choice;
- current local tactical mode or scored candidates;
- why a public decision changed;
- path/avoidance failure;
- action attempt and grounded result;
- conflict between local autonomy and player command.

**This is a place where shared vocabulary may emerge before shared runtime code.**

---

## 9. Phaser/browser stack — convenient candidate, not yet a shared foundation

The sibling currently uses Phaser `4.2.1` with Vite/TypeScript/Vitest and Cloudflare deployment.

Reasons to seriously consider the same broad browser stack for Companion Brain Lab:

- fast Owner access through a URL;
- current project/tooling familiarity;
- easy visual debug overlays;
- deterministic headless/domain tests can stay separate from rendering;
- future cross-repo donors are easier to compare when language/toolchain mismatch is low.

Reasons **not** to select it merely for familiarity:

- companion combat may demand different movement/collision/navigation capabilities;
- prior `Llm-Live-NPC` Owner testing exposed movement/presentation roughness, so the existing client is not a product-feel donor by default;
- choosing the same renderer does not create a shared AI architecture;
- a local experiment should be free to choose a better apparatus if browser/Phaser becomes friction.

Current judgement: **TypeScript/browser is a strong convenience hypothesis; Phaser remains open until the first apparatus requirements are explicit.**

---

## 10. What a future common system might actually contain

If repeated evidence eventually justifies extraction, the common layer should probably remain **boring and low-level** compared with either project's brain.

Potential earned common responsibilities:

- basic actor/entity identifiers and 2D vector primitives;
- authoritative frame stepping contract;
- actor control/action request envelopes;
- action/occurrence provenance;
- generic sensory/observation interfaces;
- deterministic debug trace interfaces;
- test harness helpers for World scenarios.

Responsibilities that should probably remain domain-specific much longer:

- resident semantic matters/memory;
- companion tactical scoring;
- combat tactics;
- command interpretation;
- squad coordination;
- personality/social cognition;
- LLM prompts/providers/routing;
- long-term life/activity planning.

The objective is not maximum code sharing. It is **maximum compatibility without sacrificing the ability of each research problem to teach us something new**.

---

## 11. New risk discovered in this audit: semantic over-unification

The largest integration risk is not ordinary duplicated code. It is choosing shared nouns too early and then forcing two genuinely different systems through them.

Examples:

- `task` in a resident system may mean a long-running grounded activity, while a combat local brain may need continuously changing tactical control rather than task replacement;
- `memory` may mean persistent episodic resident history in one project and a sub-second threat/position cache in another;
- `command` may mean player instruction to a companion, provider output, or low-level motor control depending on layer;
- `intent` may span strategic objective, tactical posture and immediate action request.

Therefore shared-system work should standardize **responsibility and authority boundaries before vocabulary/data schemas**.

---

## 12. Current donor verdict

### Reuse as principles immediately

- one World truth;
- one authoritative time progression;
- situated evidence;
- intent/proposal does not mutate World;
- factual action results;
- bounded causal provenance;
- diagnostics are observational;
- tests + scenarios + runtime + Owner judgement remain distinct evidence classes.

### Inspect for adaptation when first apparatus is selected

- plain world snapshots/types;
- multi-actor control stepping;
- facing and simple LOS helpers;
- occurrence delivery;
- static collision helpers;
- browser/Vite/Phaser shell;
- test harness patterns;
- debug workspace/panel patterns.

### Do not seed the new project with these

- deterministic `approach-and-interact` executor as the brain substrate;
- one-executor `ExecutionDriver` unchanged;
- item-specific World action vocabulary;
- singular-player location semantics;
- Resident semantic kernel;
- First Hearth activity/communication architecture;
- LLM transport/model/provider setup;
- long-term memory or cognition lifecycle.

---

## 13. Next audit question

The donor audit has reduced one major uncertainty: **we have enough useful sibling knowledge to avoid reinventing evidence and authority boundaries, but not enough generic code to justify cloning the runtime.**

The next planning pass should therefore choose the **minimum physical cooperation apparatus** first. Only then can we sensibly decide:

- whether Phaser remains the best renderer/runtime convenience;
- whether to adapt `World` or write a companion-native small world;
- whether simple kinematic collision is enough or a physics/navigation substrate is warranted;
- what minimum combat interactions are necessary to expose companion intelligence failures;
- what the first local-brain experiment must be able to observe and control.
