# Field Lab — Shared Task Under Pressure Situation Contract

Status: **STP-1 MANUAL APPARATUS MACHINE PASS · STP-2 MANUAL STRATEGY FALSIFICATION ACTIVE · SITUATION NOT QUALIFIED · NO AUTONOMY PROMOTION · NOT AN OWNER GATE**

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

## 11. STP-0 contract red-team result

STP-0 was checked against current live World/Rapier rather than treated as a paper design.

### Existing substrate already sufficient

Current runtime already provides several seams the situation needs:

- `ActorSpec.collisionMode = solid | sensor`;
- every actor is already a real dynamic Rapier body;
- `ActorSnapshot.contacts[]` preserves **counterpart identity**, not only an aggregate contact count;
- experimental squad bodies already accept bounded external motion authority in Field Lab scenarios;
- World already separates external attempts from factual post-physics outcomes;
- the Field Lab already preserves setup positions, manual orders and action provenance.

Therefore this situation does **not** require a new collision framework, generic combat model or new telemetry architecture before the apparatus can be attempted.

### Important design correction

The hostile should **not** simply chase the player.

If it does, the player can turn the specimen into a kiting problem and the companion's role becomes difficult to distinguish from generic pursuit management.

The stronger contract is:

> **the player must remain committed to a visible task zone while the hostile continuously pressures the task zone itself.**

This creates a shared spatial responsibility:

- player presence advances the task;
- hostile presence in/near the task suspends progress;
- companion positioning can materially delay or redirect hostile arrival because the hostile is a real solid body;
- player can abandon the task and personally intercept, sacrificing progress time;
- after completion the squad still exists in the same World and must recover/regroup.

### Minimal World representation

Do not introduce a generic zones framework yet.

A bounded `TaskPressure` contract may own:

- task center + radius;
- required progress ticks;
- current progress ticks;
- whether player is currently committed;
- whether hostile pressure currently contests the task;
- completion tick;
- hostile home / recovery target;
- minimal action/outcome facts if REPEL is admitted.

Working state can remain small:

`IDLE → ACTIVE → COMPLETED → SETTLED`

Semantics:

- **IDLE:** task visible; pressure has not started;
- **ACTIVE:** begins immediately when the player first commits to the task; hostile advances toward the visible task zone;
- **COMPLETED:** required visible progress was accumulated; task no longer needs defense and hostile retreats toward home;
- **SETTLED:** hostile reached home; ordinary squad relationship can be observed again.

No state transition should require the participant to know an invisible timing window.

### Progress rule for the first apparatus

Prefer a reversible rule:

- player inside task zone + task uncontested → progress increments;
- player outside → progress pauses;
- hostile contesting the task zone → progress pauses;
- progress does **not** reset or decay in STP-1.

Reason: reset/decay would introduce a new tuning question before we know whether the situation itself is useful. A pure pause still creates real opportunity cost and makes companion screening measurable without arbitrary punishment.

### Hostile pressure

The first hostile should:

- be `solid`, not a sensor;
- move toward the task-zone center while ACTIVE;
- physically interact with player/companion bodies through normal Rapier contact;
- contest task progress when it reaches the task pressure region;
- retreat toward home after task completion.

This deliberately tests whether the existing physical substrate can make **screening materially true**.

If dynamic-body pushing/sliding produces dominant jank, that is a situation falsifier or bounded physics issue; do not disguise it with AI logic.

### REPEL role

REPEL is allowed only as a donor affordance, not a required solution.

The apparatus should first remain meaningful through position/contact alone.

If REPEL is included:

- it must be valid throughout the obvious ACTIVE pressure state when in range;
- it must not depend on a hidden windup/timing oracle;
- action attempt and outcome remain World-owned;
- manual campaigns must include strategies that do not depend on REPEL.

If the situation becomes interesting only when REPEL is timed correctly, reject the situation design.

### Exact STP-1 evidence question

> **With the same initial task/threat setup, can different manual companion positioning strategies materially change how continuously the player can remain committed to the task, while every important cause is participant-visible and World-owned?**

Primary evidence should be:

- task completion time / accumulated progress;
- ticks player is committed;
- ticks task is contested;
- hostile contact counterpart + duration where material;
- manual order/action provenance;
- recovery/regroup after completion.

Do not add these as permanent metrics until the first browser specimen demonstrates which ones are actually needed to interpret the result.

### STP-1 implementation boundary

Authorized next implementation is limited to:

1. one new bounded Field Lab situation;
2. one TaskPressure World contract;
3. one visible task-zone rendering/progress representation;
4. one solid hostile moving toward that zone;
5. task contest/completion/recovery semantics;
6. enough incident/trace evidence to distinguish the manual strategies actually exercised.

Still prohibited:

- autonomy;
- protect/bodyguard mode;
- generic combat;
- health/damage;
- carry/object interaction;
- second hostile;
- task-capable companion;
- broad command grammar;
- convenience instrumentation not demanded by observed ambiguity.

If this bounded apparatus cannot already produce several distinct manual cooperative strategies, stop at STP-1 and reject/rework before expanding it.

## 12. STP-1 result — manual physical screening

Qualified source:

`7186c888001d5efcd885eb7915b33e8c9a69980c`

Qualification:

`squad-field-lab-browser #112 · run 36171126061 · SUCCESS`

Regression gate:

- 189/189 test files PASS;
- 747/747 tests PASS;
- production build PASS;
- broad Field Lab rehearsal PASS;
- persistent A/B + Trial rehearsal PASS;
- doorway discovery regression PASS;
- prior manual multi-beat authoring research PASS.

### Controlled task-pressure result

The browser falsifier held task/threat rules constant and changed the manually authored C1 physical responsibility.

**A — C1 parked away / no screen**

- maximum task progress: `122/180`;
- task never completed;
- `178` ticks contested;
- `162` ticks of material player↔hostile contact;
- final state: `ACTIVE · 122/180 · CONTESTED`.

**B — C1 physically screening the threat lane with HOLD**

- task reached `180/180` at `t180`;
- zero contested ticks inside the task run;
- zero player↔hostile contact ticks;
- no REPEL action was required for the causal difference;
- after task completion, hostile retreat/recovery reached `SETTLED` at `t274`;
- no reset/teleport was used to manufacture regroup state.

This establishes the narrow apparatus claim:

> **manual companion physical positioning can materially change how continuously the player can remain committed to one World-owned shared task.**

It does **not** establish a behavior semantic, teammate feel, useful autonomy or situation generality.

### Participant artifact boundary

The final captured artifact visibly exposes task-zone geometry, progress, player commitment/clear state, solid hostile and the same-world settled result.

However the current artifact set does not yet contain a deliberately reviewed participant screenshot at the moment of active contest. Therefore do not promote full participant-legibility of the pressure transition from the final-state artifact alone.

### STP-1 falsifier that remains open

A single central HOLD position may trivially solve this exact straight-line specimen.

Therefore the situation itself is **not machine-qualified yet**.

STP-2 must use the existing apparatus without new behavior features to test at least:

- parked-away/no-help;
- correct pre-screen;
- plausible but wrong/off-axis screen;
- late manual intercept from the same poor starting position;
- at least one live correction/change-of-plan sequence if the first four remain informative.

The question is not which strategy wins. It is:

> **does this situation expose several distinct, causally legible manual responsibilities, or does it collapse to one magic body placement?**

If it collapses, REWORK or REJECT before adding autonomy.

