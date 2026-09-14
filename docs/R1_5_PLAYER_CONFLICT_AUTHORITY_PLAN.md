# R1-5 — Dynamic Player-Conflict Authority + Constrained-Space Cooperation

Status: **PLANNING ONLY · NO NEW MOVEMENT AUTHORITY WHILE R1-4 OWNER GATE IS OPEN**

Date: 2026-09-14

Base truth: audited R1-4 branch state after live-truth synchronization. Exact Owner-test application remains pinned separately at `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`.

This document reframes the originally planned “player yielding/right-of-way” stage from current evidence. It does not authorize implementation merely because the stage number is next.

## 1. Why R1-5 still matters

R1 has repaired the failure chain that could convert ordinary dynamic play into permanent autonomous shutdown:

- desired clearance no longer acts as unrecoverable hard geometry;
- physically legal egress can be recovered;
- NATURAL final motion is checked against hard static geometry;
- post-World progress/recovery has explicit temporal semantics;
- bounded local retry can recover across independent episodes;
- causal evidence can distinguish decision, command and World outcome.

But R1-4 intentionally does **not** prove good player cooperation.

Current dynamic rehearsals prove that cross-front/doorway disturbance can remain live and eventually resume. They do not prove:

- correct right-of-way;
- low player obstruction;
- stable passing-side choice;
- good behavior in a tight choke;
- final NATURAL command consistency with player-avoidance decisions;
- useful distinction between “pass around”, “yield”, “wait”, “back off”, and “resume”.

Therefore R1-5 remains justified — but its first task is to define and falsify the dynamic authority contract, not to add generic avoidance weights.

## 2. Critical reframe: dynamic conflict is not another relationship target

Do not solve player cooperation by teaching the relationship layer special doorway slots or temporary “move over here” targets.

The intended responsibility chain is:

`relationship objective / useful region`

`-> static route / route corridor`

`-> short-horizon local spatial options`

`-> dynamic player-conflict responsibility / preference`

`-> temporal realization`

`-> final command authority where evidence proves necessary`

`-> World physical outcome`

This keeps cooperation downstream of the current S1 eight-slot representation and therefore compatible with the later S5 continuous relationship field.

R1-5 may alter the way a companion realizes or temporarily cedes progress. It must not redefine the long-horizon relationship objective merely to dodge a player.

## 3. Current code-grounded finding to falsify first

### H1 — possible final dynamic-command authority gap

**Status: LEADING HYPOTHESIS, not demonstrated.**

The current local spatial layer already predicts player/companion closest approach over a short horizon. A preferred velocity candidate can be hard-rejected as `player-predicted-collision`, and surviving candidates receive a dynamic player-risk cost.

NATURAL then applies temporal continuity after that preferred decision. R1-3 revalidates the resulting command against hard **static** geometry only.

Therefore the current responsibility chain is structurally:

`player-safe preferred candidate`

`-> continuity modifies command`

`-> static-only final gate`

`-> World`

The earlier R1-3 static bug had the same broad authority shape. That symmetry is evidence for a falsifier, **not evidence that a new gate is automatically required**.

First R1-5 experiment must answer:

> Can NATURAL turn a preferred move that satisfies the current dynamic player-conflict contract into a final command that materially violates it on the next step / short horizon?

If no bounded reproduction exists, do not add redundant final dynamic-command machinery.

## 4. Research signals — inputs, not selected architecture

### Asymmetric responsibility is legitimate

Classic ORCA deliberately shares pairwise avoidance responsibility equally between two cooperative agents. That is elegant for peer agents but does not directly match a human-controlled player who is not running the companion's reciprocal policy.

Reference: https://gamma-web.iacs.umd.edu/ORCA/

Variable-responsibility ORCA research exists specifically because equal responsibility can be suboptimal in asymmetric interactions. This supports treating **player priority / companion responsibility as an explicit design variable**, not as an accidental consequence of symmetric avoidance.

Reference: https://kguo-cs.github.io/publication/multi-agent-trajectory-planning/

### Shipped navigation systems expose avoidance priority

Unity's NavMeshAgent exposes explicit avoidance priority, and its own source documentation notes that a manually controlled player can be given high priority so simulated agents avoid that player more eagerly.

This is useful precedent for asymmetric player authority, not evidence that Unity navigation should be adopted.

Reference: https://docs.unity3d.com/6000.0/Documentation/ScriptReference/AI.NavMeshAgent-avoidancePriority.html

### Tight passages are cooperation problems, not only collision problems

Navigation literature around narrow doorways, hallways and intersections repeatedly treats these as coordination/deadlock problems. Merely having local collision constraints does not guarantee smooth passage through a social choke.

Reference: https://link.springer.com/article/10.1007/s10514-025-10194-8

This supports an explicit right-of-way / commitment question in R1-5, while not importing robotics algorithms wholesale.

### Current candidate lattice is already compatible with context-style reasoning

The current mover chooses among many directional/speed candidates with separate route, clearance, player-risk and continuity evidence. This is structurally closer to context-map/candidate steering than to a monolithic force sum.

Context steering literature is relevant because it keeps movement constraints/interest legible across heading candidates and was developed partly to avoid fragile coupled steering behavior.

Reference: https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter18_Context_Steering_Behavior-Driven_Steering_at_the_Macro_Scale.pdf

Current-best implication: deepen the existing inspectable candidate approach first. ORCA/RVO or a dedicated crowd stack remains an escalation option only if evidence shows the current representation cannot express the required cooperation cleanly.

## 5. Non-negotiable R1-5 invariants

1. **World remains physical authority.** Player/companion policy may predict conflict; it does not rewrite actual contacts or positions.
2. **Player priority is asymmetric but not equivalent to permanent paralysis.** The companion should usually route/pass around in open space when a useful alternative exists.
3. **A real choke may legitimately require waiting/yield/back-off.** Zero motion is acceptable only with an explicit reason and release condition.
4. **Player cooperation remains independent of S1 slot identity.** It consumes generic objective/route/local evidence so S5 can later replace the upstream relationship representation.
5. **Static hard feasibility and dynamic player conflict stay distinguishable.** A player is not silently converted into permanent static map geometry.
6. **Do not install a final dynamic gate before H1 is reproduced.** Symmetry with the static bug is not enough.
7. **Avoidance must not thrash.** Passing/yield responsibility must have enough commitment/hysteresis to prevent rapid left/right or go/stop switching.
8. **Resume is part of the behavior.** A good yield that never releases is still a failure.
9. **No doorway-specific scripts.** Authored scenarios are falsifiers, not special-case dispatch keys.
10. **No hidden target teleport/rewrite.** Temporary local cooperation may constrain/shape realization without falsifying the relationship objective in debug evidence.
11. **Player agency dominates optimization metrics.** A companion reaching its target faster is not success if it repeatedly forces the player to deviate or gets pushed through.
12. **Debug state must explain responsibility.** When the companion changes motion because of the player, the Owner should be able to see why, what it committed to, and what releases that commitment.

## 6. First execution campaign — RED before policy

### R1-5A — final dynamic-command boundary

Construct an isolated moving-player fixture in which:
- the preferred spatial candidate is demonstrably safe under the current player prediction;
- NATURAL continuity has non-zero prior velocity/acceleration history;
- player motion or a sharp preferred-direction change creates an opportunity for the realized command to differ materially from preferred motion.

Record:
- preferred/refined move;
- continuity command;
- final static-constrained command;
- predicted player closest approach for each of those command stages;
- next-step / short-horizon World outcome.

**Red condition:** preferred/refined is dynamically admissible but final realized command crosses the same player-conflict boundary by a material margin.

**Falsification:** if adversarial bounded fixtures cannot produce this, document H1 as weakened/falsified and do not add a final dynamic gate.

### R1-5B — open-space head-on / crossing

No doorway. No static excuse.

Run controlled encounters:
- head-on;
- orthogonal cross-front;
- player sudden stop;
- player reversal during an avoidance maneuver.

Measure:
- physical contact count/duration;
- minimum center / boundary separation;
- player requested-vs-actual disruption;
- companion progress loss;
- number of left/right avoidance-choice reversals;
- stop duration;
- resume latency.

Question: can the existing candidate field already resolve ordinary dynamic conflict without an explicit yield state, or does it oscillate / obstruct / over-yield?

### R1-5C — stationary player blocks current route

Place the player where the companion's useful route currently wants to go.

Required distinction:
- open space with alternatives: companion should normally find a useful pass-around realization;
- narrow passage with no simultaneous hard-feasible pass: waiting/yield/back-off may be the correct result.

The same “player in front” observation must not automatically produce one universal behavior.

### R1-5D — doorway responsibility / release

Use the existing doorway specifically as a **choke falsifier**, not as a special-case policy trigger.

Campaign:
- player enters first;
- companion enters first;
- simultaneous approach;
- player reverses while companion is committed;
- player waits in the choke then clears;
- repeated independent episodes.

Observe whether responsibility remains coherent and whether the companion resumes after the conflict disappears.

### R1-5E — push / pin / release regression

Preserve the physical-contact failure class R1 already learned from.

A player may physically move the companion into a bad local configuration. After release:
- static hard/comfort recovery must remain intact;
- player-conflict state must clear;
- the new R1-5 policy must not create a second sticky state above R1-4 recovery.

### R1-5F — moving relationship objective under conflict

The player is both:
- the dynamic actor the companion should not obstruct;
- and the source of a moving relationship objective.

This is central to companion semantics. Ensure conflict handling does not confuse “player moved, therefore objective moved” with “player currently owns right-of-way”.

## 7. Public conflict evidence to design before authority

Exact names remain provisional. The workbench needs enough public evidence to answer:

- Is there a predicted player conflict?
- Which motion stage first creates or removes it?
- What is the predicted closest approach / time window?
- Is the player being treated as high-priority in this interaction?
- Is the companion currently passing, yielding, waiting, backing off or simply pursuing normally?
- If a side/pass commitment exists, what is it and when may it be reconsidered?
- What condition releases a yield/wait state?
- Did the final command preserve the chosen responsibility?
- What actually happened in World contacts / requested-vs-actual motion?

Candidate public vocabulary to test, not canonize:

- `PLAYER_CLEAR`
- `PLAYER_CONFLICT_PREDICTED`
- `PASSING_PLAYER`
- `YIELDING_PLAYER`
- `WAITING_PLAYER`
- `RESUMING_AFTER_PLAYER`

Do not make the labels into a giant FSM. They may remain classifications over compact commitment/release state.

## 8. Current-best policy shape if the red evidence justifies it

The likely first implementation family is a **small dynamic-conflict layer integrated with the existing candidate velocity evaluation**, not a new general navigation system.

Potential responsibilities:
- asymmetric player-risk / right-of-way weight or hard reject where collision is imminent;
- pass-side commitment/hysteresis when multiple near-equivalent candidates exist;
- explicit yield/wait/back-off when geometry leaves no useful simultaneous passage;
- release when predicted conflict clears for a bounded confirmation window;
- dynamic final-command revalidation only if R1-5A demonstrates the actuator boundary gap.

Keep the route responsible for static topology and the relationship layer responsible for long-horizon useful position.

## 9. What not to optimize blindly

Do not start by tuning:
- `S3_PLAYER_BUFFER`;
- the 0.55 s prediction horizon;
- player-risk weights;
- preferred speed;
- doorway dimensions;
- candidate direction count.

Those are parameters, not explanations. First create fixtures that tell us **which semantic failure exists**: insufficient prediction, wrong responsibility, unstable commitment, final-command mismatch, or lack of choke-state semantics.

## 10. Promotion evidence

R1-5 mechanical promotion should require a mixed campaign, not a single “reaches target” assertion.

At minimum report:
- success/resume rate;
- companion and player contact duration/count;
- minimum predicted/actual separation where meaningful;
- player requested-vs-actual motion disruption;
- companion objective progress / recovery debt;
- avoidance/pass-side switch count;
- intentional wait duration;
- resume latency after conflict clear;
- route/progress state transitions;
- whether any reset was required.

No one metric defines success. The purpose is to make tradeoffs visible for Owner judgement.

## 11. Owner gate relationship

The current R1-4 Owner browser gate remains authoritative for whether the audited movement/recovery foundation is actually acceptable under real interaction.

While that gate is open, allowed R1-5 work:
- planning;
- code audit;
- external research;
- isolated red/falsification harnesses that do not change the public Owner-test runtime.

Not allowed to claim/promote yet:
- new yield behavior as the active movement foundation;
- altered public Pages runtime for R1-5;
- R1-5 mechanical PASS;
- S5 movement authority.

Any material R1-4 Owner failure outranks this plan and may change R1-5 assumptions.

## 12. S5 compatibility and later resume

S5-A remains a promising donor because it changed only its relationship-field module/tests/docs relative to the S4 base. Its strongest finding — coherent connected good regions instead of global centroid averaging — remains useful.

After R1-6 Owner robustness qualification:

1. transplant/rebase the S5 field onto the post-R1 line;
2. requalify it against current hard/comfort routing semantics;
3. expose it in shadow beside the old S1 target;
4. test long adversarial player motion and interaction with R1-5 conflict state;
5. only then consider allowing the field to provide the active relationship objective.

Do not merge the historical S5 branch wholesale and accidentally restore old S4 movement assumptions.

## 13. Escalation conditions

Do not import ORCA/RVO, a crowd system, navmesh local avoidance or a new character controller merely because those are standard solutions.

Broaden the substrate comparison if evidence shows one or more of:
- stable passing/yield behavior requires a growing set of scenario-specific branches;
- the current directional candidate lattice cannot represent a feasible conflict-free velocity cleanly;
- commitment logic merely hides persistent oscillation rather than resolving it;
- final dynamic command safety requires destructive clipping that ruins NATURAL motion quality;
- dynamic-player and static-route responsibilities cannot remain causally separable;
- a few-companion extension would require rewriting the one-companion solution rather than generalizing it.

At that point compare alternatives with the current R1 workbench and identical scenarios, not by feature list.

## 14. Current next move

**Before behavior implementation:** run the audited R1-4 Owner browser gate.

In parallel, the next safe technical action is R1-5A: build a deterministic **red/falsification-only** final dynamic-command fixture. The output should be one of two clean results:

- **RED:** continuity can invalidate the player-conflict decision -> repair that authority seam before higher-level yield policy;
- **FALSIFIED / not reproduced:** current final command is sufficiently consistent in the exercised boundary -> do not add a redundant gate; continue to open-space/choke right-of-way experiments.

That fork is the first decision R1-5 should earn from evidence.
