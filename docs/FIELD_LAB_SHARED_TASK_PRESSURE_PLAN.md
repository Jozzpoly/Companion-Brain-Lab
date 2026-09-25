# Field Lab — Shared Task Under Pressure Situation Contract

Status: **NEXT SITUATION HYPOTHESIS · MANUAL-FIRST · NO AUTONOMY PROMOTION · NOT AN OWNER GATE**

Date: **2026-09-25**

## 1. Why this situation now

The post-recovery Field Lab can already preserve one manually authored multi-beat chain:

`setup → HOLD → material REPEL → FOLLOW/regroup`.

That experiment exposed the current bottleneck: the laboratory can record authored behavior, but the World exposes too few qualitatively meaningful affordances. Most authoring still reduces to spatial micromanagement plus one coarse action verb.

The next experiment should therefore increase **situation richness**, not slider count, trace machinery or autonomous policy.

## 2. Candidate comparison

### Protected transit / escape

Player crosses a visible destination while a hostile pressures the route.

Strengths:
- very small extension of current movement/formation substrate;
- naturally exercises screening, blocking, regroup and doorway geometry.

Weakness:
- risks remaining another movement problem with one REPEL button;
- a successful HOLD/body-block location could collapse the question into geometry.

### Shared task under pressure — selected hypothesis

Player must remain engaged with a visible World task for a sustained interval while a visible hostile creates material pressure.

Strengths:
- gives the player a first-class job rather than turning them into an observer;
- creates a real opportunity cost: continue the task, abort, evade, or take over the threat;
- companion positioning can help or interfere without requiring autonomy;
- HOLD, MOVE, direct control, formation and regroup already matter;
- can reuse the current hostile/action/outcome seam while replacing hidden-timing dependence with continuously legible state;
- does not require HP, inventory, animation or a general combat framework.

### Carry / rescue / escort

Player or squad moves a vulnerable body/object while under pressure.

Strengths:
- high long-term behavioral richness.

Weakness:
- prematurely requires carry/attachment/interact semantics and likely additional movement rules;
- too many new systems would make failures difficult to attribute.

Therefore **Shared Task Under Pressure** is the highest-information bounded next situation hypothesis.

This is a planning choice, not a product promotion. Kill it quickly if the manual apparatus does not expose richer behavior.

## 3. Situation contract

Working fiction is deliberately generic. It may be rendered as a beacon, console, repair point or similar later. The research contract is:

1. a clearly visible **task zone** exists in the World;
2. the player can make task progress by remaining committed to that zone;
3. progress is continuous and visible — no hidden validity window;
4. leaving the zone or being materially displaced has an immediate, intelligible effect on progress;
5. one visible hostile applies continuous embodied pressure;
6. the hostile is a materially collidable body for this specimen so companion screening is physically true rather than a visual promise;
7. player contact with the hostile has a simple World-owned consequence that interrupts or materially harms task progress;
8. the companion can affect the same situation through position, collision and the existing bounded REPEL action;
9. task completion ends the pressure objective but does not teleport/reset the squad — recovery/regroup remains part of the same episode.

Initial companion behavior is entirely manual/order-driven.

## 4. Required natural counterfactuals

The same situation must support, without hidden-state knowledge:

- player attempts the task while companion does nothing;
- companion HOLDs/screens while player stays committed;
- companion intercepts early, then returns/regroups;
- player abandons the task and handles the threat personally;
- player changes plan while the companion is already committed;
- companion is badly positioned and actively makes the situation worse;
- with two companions, different spatial responsibilities can be authored without a new hard-coded behavior mode;
- after success/failure, the squad must recover into an ordinary relation.

If these counterfactuals are not materially different in World outcome or player burden, the situation is too weak.

## 5. Claim budget

The first apparatus may establish only:

> **the World can host a continuously legible shared task where manual companion positioning/action materially changes the player's ability to remain committed and complete it.**

It may not establish:

- teammate feel;
- good combat;
- a final interaction verb;
- autonomous protection/screening;
- formation policy;
- command grammar;
- Owner usefulness/fun;
- generalization beyond this situation.

## 6. Minimal implementation budget

Add only what the situation contract needs:

### World truth

- visible task-zone geometry;
- World-owned task progress and explicit completion/interruption facts;
- one solid hostile body using the existing physical substrate;
- explicit hostile↔player and hostile↔companion contact provenance where interpretation actually needs counterpart identity;
- the smallest consequence necessary for hostile pressure to matter.

### Participant surface

The participant should be able to see, without opening causal debug:

- where the task is;
- whether the player is currently progressing it;
- whether progress stopped/was interrupted and why at a coarse level;
- where the hostile is and that it materially collides;
- completion/failure/recovery state.

No hidden phase table is allowed to be necessary for meaningful play.

### Existing donors to reuse

- Rapier bodies and fixed-step World;
- Field Lab setup placement;
- selection / MOVE / HOLD / FOLLOW / direct control;
- persistent A/B and Trial/Trace;
- action-attempt → World-outcome separation;
- REPEL only as an existing bounded affordance, not as the thesis of the situation.

## 7. Explicit non-goals

Do not add yet:

- HP/damage model;
- inventory;
- weapons;
- animation/combat framework;
- threat-selection system;
- behavior tree / GOAP / utility architecture;
- automatic bodyguard/protect mode;
- bottleneck detection;
- autonomous formation compression;
- task-capable companion;
- new command-menu grammar;
- score/ranking system;
- replay/timeline tooling unless the experiment proves current Trace insufficient.

## 8. Falsifiers

Reject or redesign the situation if any of these becomes true:

1. success is mostly about pressing REPEL at the correct moment;
2. the player can solve it by simply running away while task progress remains irrelevant;
3. one static HOLD spot solves every run;
4. the companion's physical body does not materially affect hostile approach;
5. the hostile's solid-body behavior degenerates into physics jank that dominates the experiment;
6. meaningful play requires reading debug phase/state labels;
7. the player becomes a spectator while the companion handles the objective;
8. multiple manual strategies do not create different burdens/consequences;
9. implementation starts demanding a general combat/interaction framework before the core situation can be evaluated;
10. the new World machinery cannot explain which actor/action caused task interruption or completion.

## 9. Execution plan

### STP-0 — contract-only red team

Before code, challenge the contract against the current physical and World seams. Confirm the smallest task-progress/contact/outcome representation and identify any impossible assumption.

Deliverable: exact minimal World contract and failure semantics.

### STP-1 — manual apparatus

Implement only:

- task zone + visible progress;
- one solid hostile;
- simple player-contact consequence;
- same-runtime manual companion control;
- participant-readable outcome.

No autonomy.

Machine question:

> can manual companion placement/action materially alter task continuity under real World pressure?

### STP-2 — manual strategy campaign

From matched persistent setups, author several genuinely different solutions:

- no help baseline;
- HOLD/screen;
- early intercept → regroup;
- player takeover;
- changed-plan/correction;
- two-member split responsibility if the one-companion apparatus survives.

Use Trial/Trace only to explain observed differences. Add telemetry only when a concrete result is ambiguous.

### STP-3 — situation verdict

Three possible outcomes:

- **REJECT** — still just movement + REPEL, hidden timing, or degenerate physics;
- **REWORK** — useful shared-task pressure exists but one World affordance/legibility seam blocks interpretation;
- **MACHINE-QUALIFIED SITUATION** — several manual strategies materially alter the same visible problem with participant-legible causality.

Even the third outcome is not Owner PASS.

### STP-4 — semantic extraction

Only after STP-3 survives:

- compare repeated successful manual patterns;
- distinguish situation-specific tricks from recurring intent;
- name candidate semantics only where evidence supports them, e.g. screening, covering commitment, early intercept, yield/takeover, or regroup;
- explicitly search for counterexamples.

Do not automate yet unless one responsibility is both repeated and well-bounded.

### STP-5 — first earned autonomy comparison

If a repeated manual pattern earns authority, implement the smallest autonomous responsibility capable of reproducing it under changed conditions.

Compare:

`manual gold standard ↔ simple scripted baseline ↔ bounded autonomy`.

Owner attention becomes useful only when the resulting live experience is materially richer than the rejected readiness apparatus and the Field Lab has accumulated enough expressive capability to support unscripted exploration.

## 10. Strategic success criterion

This campaign succeeds not when the task-zone implementation is green, but when it answers:

> **Can the Field Lab create a shared situation rich enough that different manually authored companion intentions produce meaningfully different cooperative episodes — giving us real evidence about what a future teammate brain should understand and take responsibility for?**
