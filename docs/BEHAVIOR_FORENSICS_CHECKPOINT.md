# Behavior Forensics Checkpoint

Status: **FORENSICS CHECKPOINT · EVIDENCE-QUALIFIED · NO MOVEMENT-AUTHORITY PROMOTION**

Date: 2026-09-15

Branch: `audit/companion-behavior-forensics`

PR: #19

Clean CCC-0 Owner-gate base: `experiment/ccc-0-shadow-coordination` at `4318d895f1e83ba921faf1c7f4bd7cefea1c46f2`

Qualified forensics head before this document: `0a1cff1fc573186d21e228f7bc3b4fae24433b43`

Latest validation at that head:

- workflow `validate` run **#669** — PASS;
- **61/61 test files PASS**;
- **233/233 tests PASS**;
- strict TypeScript PASS;
- production build PASS;
- real Chromium audit PASS;
- CCC-0 zero-authority differential torture remains byte-identical for all 8 scenario × DIRECT/NATURAL combinations;
- no movement-authority promotion occurred.

This document closes the broad behavior-forensics campaign as a research checkpoint. It is not a repair plan and not a frozen architecture.

---

## 1. Why this campaign existed

The Owner observed the first spontaneous hint that the companion sometimes felt less like a follower script and more like an embodied entity with its own trajectory and temporal continuity.

That signal was valuable but dangerous. The current stack also contains accidental delay, target discontinuities, solver feedback loops, fixed-speed assumptions, recovery side effects and legacy semantic shortcuts. Tuning toward the visible result without explaining its provenance could preserve bugs merely because they look organic.

The campaign therefore asked a narrower question:

> **Which mechanisms plausibly contribute useful proto-agency / embodied teammate feel, and which mechanisms only imitate agency because accidental system dynamics look lifelike?**

The goal was explanation and falsification, not feature promotion.

---

## 2. Current research verdict

The strongest supported decomposition is now:

1. **semantic intent** — what relationship, objective or useful state the companion is trying to achieve and why;
2. **action selection / embodiment** — how the companion chooses a local trajectory and realizes it through a physical body over time;
3. **causal interpretation** — what actually happened, what caused the result, and whether the result came from the companion, the player, the world, geometry or a downstream constraint.

The current system has useful ingredients in layer 2, some promising substrate for layer 1, and materially weak causal truth in layer 3.

The first aliveness signal therefore should **not** be reduced to one score or one module. Current evidence supports a combination of:

- independent local geometric trajectory;
- physical interaction with the World;
- temporally continuous bodily realization;
- persistent state across motor ticks;
- visible reaction to changing relationships.

However, some apparently deliberate behavior is demonstrably produced by wrong causal semantics. Those accidental causes must not become protected merely because the resulting animation looks natural.

---

## 3. Preserve candidates — behavior worth carrying forward as donors

These are **donor candidates**, not protected architecture.

### 3.1 Independent local spatial trajectory

The spatial layer creates materially different behavior from simple CHASE or legacy RELATIONAL motion.

In the canonical reversal stack ablation:

| Stack | lateral travel | player-contact frames | peak requested-velocity delta |
| --- | ---: | ---: | ---: |
| CHASE | 0 | 56 | 3.000 |
| RELATIONAL | 0 | 56 | 0.000 |
| SPATIAL DIRECT | ~1.488 | 0 | ~1.119 |
| SPATIAL NATURAL | ~1.432 | 0 | ~0.262 |

The important signal is not that the current spatial policy is final. It is that **local spatial reasoning gives the companion its own geometric trajectory rather than merely copying or colliding with the player**.

### 3.2 NATURAL temporal realization

NATURAL is currently the strongest isolated source of bodily temporal continuity.

In the reversal experiment, NATURAL reduced the largest requested-velocity change by more than 4× relative to SPATIAL DIRECT while preserving comparable lateral geometry.

A separate smooth 90° arc-turn removed the discrete reversal/target-teleport confound:

| Stack | peak direction turn | total direction turn | physical path |
| --- | ---: | ---: | ---: |
| SPATIAL DIRECT | ~0.2618 rad | ~0.7854 rad | ~6.300 |
| SPATIAL NATURAL | ~0.0467 rad | ~0.8462 rad | ~6.144 |

NATURAL reduced the local turn spike by about **5.6×** while keeping similar aggregate turning geometry.

Current evidence therefore supports:

> **spatial reasoning gives trajectory; NATURAL gives that trajectory temporal embodiment.**

This does not imply that the current NATURAL controller or its constants are final. It means the architectural responsibility — continuous physical realization distinct from semantic decision — appears valuable.

### 3.3 World outcome evidence

The World already exposes useful physical truth:

- requested velocity;
- actual velocity;
- motion error;
- contacts;
- resulting position/displacement.

That distinction is a valuable foundation for a future brain that can reason about its own agency. The problem is not absence of evidence; it is that higher layers currently collapse or misinterpret it too early.

### 3.4 Persistent state, but only with provenance

Hysteresis, temporal memory and persistent state can make behavior coherent rather than frame-reactive. They should remain available as design tools.

But persistence must represent a meaningful belief/intention/state, not merely retain an accident such as a stale velocity heading or a target that changed under the same symbolic label.

---

## 4. Replace or redesign — confirmed living-error classes

### 4.1 Legacy eight-slot relationship semantics

A stable symbolic label does not imply a stable world objective.

Across the canonical 180° reversal:

- relationship label remained `back`;
- target jumped exactly **2.9 units**;
- observation delay varied from 0 to 5 relationship ticks solely with clock phase.

`intentToward()` then legitimately pursues the newly teleported world target. The resulting continuation can look like intentional follow-through even though the semantic world point changed discontinuously.

The eight-slot system may remain useful as a historical donor or debug vocabulary, but it should not be treated as the future relationship model.

### 4.2 Player intention is conflated with player physical motion

This is now confirmed at exact World, workbench and real-browser levels.

In the exact A/B experiment, body geometry was held identical and the only meaningful difference was solver-induced player actual velocity:

- owner/requested player velocity: `{0,0}`;
- solver-induced actual velocity: about `{-1.499,0}`;
- stationary control heading: `+X`;
- pushed snapshot heading: `-X`;
- relational slot changed `left → back`;
- semantic target shifted by **~2.051 units**.

The real-browser rehearsal then reproduced the same causal class from the live workbench:

- owner input `{0,0}`;
- player requested velocity `{0,0}`;
- player actual velocity `{-1.4992,0}`;
- contact includes `companion`;
- relationship consumed player direction `{-1,0}`;
- selected label `back`;
- published a corresponding target;
- heading alignment dot = `1`.

Therefore:

> **the companion can physically push a stationary player, interpret the resulting solver motion as player intention, and change its own semantic objective because of an effect it helped create.**

This is real closed-loop self-induced behavior, not merely misleading debug output.

Future coordination needs an explicit distinction between at least:

- player-commanded intent / control signal;
- player observed body trajectory;
- world- or contact-forced motion;
- confidence / provenance of inferred heading.

### 4.3 PACE ownership is currently accidental

The current far-target local spatial policy settles at the 0.70 speed level:

- physical capability = 3 u/s;
- requested companion speed = **2.1 u/s**.

In a 5-second full-speed tracking rehearsal, an initially satisfied relationship develops more than 5 units of error.

Ablation showed the dominant cause is not the 6-tick target cadence and not NATURAL:

| actuator | target cadence | final ideal relationship error | mean requested speed, last 120 ticks |
| --- | ---: | ---: | ---: |
| DIRECT | 1 | ~5.084 | 2.1 |
| DIRECT | 6 | ~5.144 | 2.1 |
| NATURAL | 1 | ~5.098 | 2.1 |
| NATURAL | 6 | ~5.167 | 2.1 |

Future PACE should own desired locomotion intensity explicitly. Local geometric candidate sampling should not accidentally define strategic catch-up capability.

### 4.4 RETRY_LOCAL cannot repair a structural policy deficit

With recovery enabled:

- final ideal relationship error ~`5.16749`;
- retries fired at ticks 42 and 87.

With recovery disabled:

- final ideal relationship error ~`5.16668`.

Requested speed remains essentially 2.1 u/s in both cases.

Therefore `RETRY_LOCAL` is useful for some transient movement-state failures but is not equivalent to “reconsider the problem.” Recovery needs failure-class awareness rather than applying local reset semantics to structural policy mistakes.

### 4.5 Progress lacks causal attribution

An exact experiment gave the companion zero movement command while the player physically pushed it toward its target.

The body moved ~1.97 units and recovery classified the episode as `PROGRESSING`; the first such frame occurred around tick 4 with `progressDelta ≈ 0.074`.

Current progress therefore means roughly:

> **the target metric improved while the body moved**

rather than:

> **my own chosen action successfully improved the target metric**.

That distinction is sufficient for Foundation survival diagnostics but insufficient for a brain expected to learn from, explain or recover from embodied outcomes.

### 4.6 Movement capability is not one end-to-end contract

The current planner/NATURAL/final static guard reason with a 3 u/s maximum while World executes normalized command by each actor's physical `speed`.

An actor-speed-5 counterexample produced:

- brain-reasoned speed `0.04444`;
- World requested speed `0.07407`;
- exact ratio `5/3`.

More importantly, a final safety proof at 3 u/s considered the segment ending at `x=1.05` clear, while the same move executed by a 5 u/s actor reached `x≈1.08333`; the longer swept traversal was statically blocked.

Therefore adding catch-up reserve by simply increasing `ActorSpec.speed` would invalidate assumptions in movement reasoning and safety verification.

Future capability must be propagated coherently through PACE, local planning, temporal realization, final constraints and World execution.

### 4.7 Hard feasibility and comfort remain semantically entangled

The current router can report a hard-feasible narrow passage as unreachable because desired comfort clearance participates in route authority. That false unreachable evidence can propagate into recovery.

Conversely, local R1 repair can intentionally rehabilitate a candidate whose:

- hard swept path is clear;
- comfort swept path is blocked;
- comfort endpoint is clear.

Temporary comfort crossing can be desirable — otherwise the companion can become trapped in a clearance prison — but current evidence naming does not clearly distinguish:

- hard physical illegality;
- transient comfort intrusion;
- comfort-violating endpoint;
- deliberate comfort egress.

Future cooperation should keep these concepts explicit.

### 4.8 Player-flow prediction is not yet topology-aware enough

Shadow corridor extrapolation can reserve phantom player flow through static geometry. Straight velocity extrapolation is useful evidence but cannot be treated as authoritative future occupied space without topology/route context.

### 4.9 Shadow PACE semantics remain provisional

Current shadow PACE still contains provisional behavior such as:

- a nonzero desired-speed floor;
- flattening `NO_REACHABLE_REGION` into strong recovery urgency;
- opening/closing reasoning tied to a representative region anchor;
- reliance on currently conflated player velocity evidence.

It remains research substrate, not a ready authority policy.

### 4.10 Continuous inputs can still produce discrete WHERE representation changes

Memory fade and low-speed continuity were improved substantially, but continuous evidence does not guarantee continuous region output.

Observed examples:

- speed perturbation `0.207 → 0.208 m/s`: anchor displacement ~`0.211`;
- heading-memory fade: maximum one-observation anchor change ~`0.815` when remaining heading strength was already ~`0.023`.

This is not the original hard-threshold bug; it is sensitivity introduced by discrete shortlist/best-sample/coherent-component representation.

Do not assume that smooth scalar weights imply smooth spatial behavior.

---

## 5. Incident v5 — qualified causal research instrument

The causal trace still uses the same conceptual phases:

`observation → decision → command → outcome → post-classification`

Incident v5 adds provenance needed to distinguish apparent intention from physical side effects.

It records, where available:

### Observation

- companion requested / actual velocity and motion error;
- player requested / actual velocity and motion error;
- contacts for both bodies;
- same-step owner player input submitted to World.

### Decision

- relationship revision, label, target and **exact player direction consumed by relationship**;
- route evidence;
- coarse local velocity;
- local safety state;
- refinement source and contributors;
- NATURAL regime, preferred velocity and pre-final-constraint velocity;
- CCC-0 shadow coordination evidence.

### Command

- commanded move / requested velocity;
- pre-final-constraint velocity;
- final approved velocity;
- final constraint source/reason.

### Outcome

- post-World requested / actual velocity and motion error for companion;
- post-World requested / actual velocity and motion error for player;
- contacts and displacement for both;
- post-route evidence.

### Post-classification

- progress/recovery state and reason;
- retry action and counters;
- hard/comfort probe evidence.

#### Qualification

Incident v5 is not only type-checked instrumentation.

Real Chromium:

1. captured a real download from the workbench UI;
2. parsed the JSON;
3. verified same-step owner input, movement-stack provenance and post-World player outcome;
4. reproduced the solver-motion semantic leak through a bounded live browser rehearsal.

Latest #669 browser evidence included:

```text
ownerInputMove             = {0,0}
playerRequestedVelocity    = {0,0}
playerActualVelocity       = {-1.4992,0}
playerContacts             = ["companion"]
relationshipPlayerDirection= {-1,0}
relationshipLabel          = "back"
headingDot                 = 1
```

Incident v5 is therefore qualified as a **research instrument** for future Owner captures. It is not a gameplay feature and should not itself become architecture authority.

---

## 6. What the Owner's first aliveness signal currently means

The evidence does **not** justify saying “the companion is alive because NATURAL smooths motion,” nor “the target delay is good because it looks thoughtful.”

A stronger interpretation is:

> The current stack accidentally combines several ingredients that humans read as independent embodied agency: an NPC can form a local path that differs from the player's path, carry physical momentum/acceleration history through time, interact with real geometry and bodies, and preserve state across frames. At the same time, incorrect semantics can inject delay, target jumps and self-induced reactions that mimic deliberation.

The design task is therefore not to remove all irregularity or make the companion maximally responsive.

It is to preserve **meaningful temporal autonomy** while replacing accidental sources of apparent agency with explicit teammate semantics.

---

## 7. Do not cargo-cult aliveness

Potentially valuable qualities:

- the companion has its own path rather than mirroring the player;
- it has a body with acceleration/braking/turning continuity;
- it can commit briefly rather than frame-snap to every stimulus;
- it reacts to actual World constraints;
- behavior has temporal history that is inspectable and causally grounded.

Do **not** preserve these merely because they can look organic:

- target teleportation hidden behind a stable label;
- solver-induced player velocity treated as owner intent;
- clock-phase-dependent observation delay with no semantic meaning;
- a fixed 70% locomotion policy that manufactures catch-up failure;
- local recovery retries that cannot change the underlying policy;
- false unreachable authority caused by comfort clearance;
- phantom predicted player flow through walls;
- externally caused displacement interpreted as self-caused progress.

A future system may still contain delay, commitment, memory, acceleration limits, comfort intrusion and recovery. Those mechanisms should survive because their semantics are defensible, not because their accidental predecessors happened to look lifelike.

---

## 8. High-value architectural hypotheses for the next fresh re-plan

These are questions/hypotheses, **not decided architecture**.

### 8.1 Player state should expose provenance explicitly

Likely useful channels include:

- player commanded intent/control;
- observed body velocity/trajectory;
- contact/world-forced displacement;
- confidence/history for trajectory inference.

The coordination layer should choose deliberately which signal it needs instead of using one `actual → requested → fallback` chain for all meanings.

### 8.2 Causal provenance may be a first-class brain input

A useful embodied agent likely needs to distinguish approximately:

- self-caused outcome;
- player-caused outcome;
- environment/physics-caused outcome;
- downstream safety/constraint modification;
- uncertain/mixed causation.

This matters for recovery, learning, prediction, blame assignment and believable adaptation.

### 8.3 Movement capability should be one explicit contract

PACE, local planner, temporal actuator, final guard and World execution should reason from compatible capability semantics.

Catch-up reserve can then become a deliberate relationship mechanic rather than an unsafe actor-speed override.

### 8.4 Region-first WHERE remains promising

The CCC-0 coherent-region work still appears better aligned with useful companion space than a single legacy eight-slot point.

But current sampling, shortlist and representative-anchor mechanics remain replaceable. The concept of a useful reachable region is more important than the current implementation.

### 8.5 PACE should become explicit strategic authority

A future PACE layer should answer questions such as:

- maintain formation vs catch up;
- yield vs pass;
- sprint reserve vs comfort pace;
- slow before entering useful region;
- recover from separation without overshoot;
- distinguish temporary obstruction from structural inability to catch up.

It should not be an accidental consequence of local candidate speed fractions.

### 8.6 Player cooperation should be asymmetric and intentional

The player is not an equal reciprocal navigation agent. The companion usually bears more responsibility to yield, avoid blocking, preserve chokepoints and recover formation.

The existing upstream-cooperation vs downstream-physical-guard distinction remains a strong hypothesis, not an invariant.

### 8.7 Local spatial and NATURAL should be evaluated as donors

Current evidence gives them real value, but neither should be preserved wholesale.

The next architecture should ask:

- which geometric behaviors of local spatial are genuinely useful;
- which scoring/sample artifacts should disappear;
- whether NATURAL's acceleration/jerk realization is the right actuator or merely proof that temporal realization deserves its own layer;
- what state should persist across semantic objective changes;
- what the actuator is allowed to change versus what must remain owned by WHERE/PACE/cooperation.

---

## 9. Non-claims

This checkpoint does **not** claim:

- CCC-1 architecture is designed;
- CCC-0 shadow WHERE/PACE/player-flow scoring is ready for authority;
- current local spatial or NATURAL will survive unchanged;
- the Owner's subjective aliveness signal has been reduced to a complete metric;
- every existing movement/recovery bug has been found;
- all temporal delay is bad;
- all transient comfort intrusion is bad;
- incident v5 should become production telemetry;
- PR #19 should be merged wholesale;
- the clean CCC-0 Owner gate should be replaced by the forensics branch.

---

## 10. Next decision boundary

The broad forensic campaign has produced enough evidence that adding more isolated micro-probes now has diminishing value.

The next stage should begin with a **fresh architecture/authority re-plan from this evidence**, not with immediate repair of the loudest bug.

That re-plan should decide the first bounded authority experiment while preserving three freedoms:

1. current Foundation/CCC-0 implementation may be replaced aggressively;
2. useful local-spatial/NATURAL mechanisms may survive as donors even if their containing architecture does not;
3. new evidence may overturn the current decomposition.

Until that re-plan exists:

- keep PR #17 clean;
- keep PR #19 draft/provenance-only;
- do not merge PR #19 wholesale;
- do not promote CCC-0 shadow into movement authority;
- do not repin public Pages to the forensics branch.

**Checkpoint verdict:**

> We now have enough evidence to separate a meaningful kernel of embodied proto-agency from several accidental living errors. The next useful move is no longer broader bug collection; it is to redesign the first authority experiment around explicit semantic intent, embodied realization and causal provenance while preserving the parts of the existing motion stack that have actually earned donor status.
