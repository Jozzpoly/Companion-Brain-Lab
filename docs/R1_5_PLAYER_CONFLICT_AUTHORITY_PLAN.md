# R1-5 — Dynamic Player-Conflict Authority + Constrained-Space Cooperation

Status: **R1-5A RED REPRODUCTION PASS · MATERIAL FINAL-DYNAMIC-AUTHORITY GAP DEMONSTRATED · NO PRODUCTION REPAIR YET**

Date: 2026-09-14

Base truth: audited R1-4 branch state after live-truth synchronization. Exact Owner-test application remains pinned separately at `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`.

This document reframes the originally planned “player yielding/right-of-way” stage from current evidence. It does not authorize promotion merely because the stage number is next.

## 1. Why R1-5 still matters

R1 repaired the failure chain that could convert ordinary dynamic play into permanent autonomous shutdown:

- desired clearance no longer acts as unrecoverable hard geometry;
- physically legal egress can be recovered;
- NATURAL final motion is checked against hard static geometry;
- post-World progress/recovery has explicit temporal semantics;
- bounded local retry can recover across independent episodes;
- causal evidence distinguishes decision, command and World outcome.

R1-4 intentionally did **not** prove good player cooperation.

Current dynamic rehearsals prove that cross-front/doorway disturbance can remain live and eventually resume. They do not prove:

- correct right-of-way;
- low player obstruction;
- stable passing-side choice;
- good behavior in a tight choke;
- final NATURAL command consistency with player-avoidance decisions;
- useful distinction between “pass around”, “yield”, “wait”, “back off”, and “resume”.

R1-5 therefore remains justified — and R1-5A has now established that the first missing responsibility is a real final dynamic-command authority boundary, not merely avoidance tuning.

## 2. Critical reframe: dynamic conflict is not another relationship target

Do not solve player cooperation by teaching the relationship layer special doorway slots or temporary “move over here” targets.

The intended responsibility chain is:

`relationship objective / useful region`

`-> static route / route corridor`

`-> short-horizon local spatial options`

`-> dynamic player-conflict responsibility / preference`

`-> temporal realization`

`-> final dynamic/static command authority where evidence requires it`

`-> World physical outcome`

This keeps cooperation downstream of the current S1 eight-slot representation and therefore compatible with the later S5 continuous relationship field.

R1-5 may alter the way a companion realizes or temporarily cedes progress. It must not redefine the long-horizon relationship objective merely to dodge a player.

## 3. R1-5A finding — final dynamic-command authority gap

**Status: MATERIAL FINDING / deterministic RED reproduction + World consequence.**

Evidence document: `docs/R1_5A_DYNAMIC_FINAL_COMMAND_RED_EVIDENCE.md`

Primary red run: `34864314897`

The current local spatial layer predicts player/companion closest approach over a short horizon. A preferred velocity can be rejected as `player-predicted-collision`, and surviving candidates carry dynamic player-risk evidence.

NATURAL then applies temporal continuity after that decision. R1-3 revalidates the resulting command against hard **static** geometry only.

R1-5A demonstrated the exact authority failure:

`player-safe preferred/refined move`

`-> NATURAL continuity changes command`

`-> static final gate accepts command`

`-> final command violates the same dynamic player-conflict contract`

`-> real World contact occurs`.

Isolation evidence:
- DIRECT/coarse move `{x ~= 0, y = 0.7}`;
- refined move `{x ~= 0, y = 0.69447}`;
- upstream dynamic clearance `+0.22 m`;
- continuity/final move `{x = 0.98783, y = 0.00845}`;
- final dynamic clearance `-0.77145 m`;
- static final gate: `constrained=false`, because the command is hard-static safe.

Physical A/B evidence:
- DIRECT: minimum center distance `1.00061 m`, zero contact frames, zero player displacement;
- NATURAL: minimum center distance `0.60047 m`, five player-contact frames, measurable player motion error/displacement.

The historical audited R1-4 suite remained 108/108 green. The new red tests isolate an R1-5 responsibility that the R1-4 claim never covered.

## 4. Research signals — inputs, not selected architecture

### Asymmetric responsibility is legitimate

Classic ORCA deliberately shares pairwise avoidance responsibility equally between two cooperative agents. That is elegant for peer agents but does not directly match a human-controlled player who is not running the companion's reciprocal policy.

Reference: https://gamma-web.iacs.umd.edu/ORCA/

Variable-responsibility ORCA research exists specifically because equal responsibility can be suboptimal in asymmetric interactions. This supports treating **player priority / companion responsibility as an explicit design variable**, not as an accidental consequence of symmetric avoidance.

Reference: https://kguo-cs.github.io/publication/multi-agent-trajectory-planning/

### Shipped navigation systems expose avoidance priority

Unity's NavMeshAgent exposes explicit avoidance priority, and its documentation notes that a manually controlled player can be given high priority so simulated agents avoid that player more eagerly.

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
6. **Final temporal realization may not silently invalidate an accepted dynamic-player safety decision.** R1-5A has now demonstrated this exact violation.
7. **Avoidance must not thrash.** Passing/yield responsibility must have enough commitment/hysteresis to prevent rapid left/right or go/stop switching.
8. **Resume is part of the behavior.** A good yield that never releases is still a failure.
9. **No doorway-specific scripts.** Authored scenarios are falsifiers, not special-case dispatch keys.
10. **No hidden target teleport/rewrite.** Temporary local cooperation may constrain/shape realization without falsifying the relationship objective in debug evidence.
11. **Player agency dominates optimization metrics.** A companion reaching its target faster is not success if it repeatedly forces the player to deviate or gets pushed through.
12. **Debug state must explain responsibility.** When the companion changes motion because of the player, the Owner should be able to see why, what it committed to, and what releases that commitment.

## 6. R1-5A repair comparison — next, still test-only first

Do not jump directly from RED evidence to production implementation.

Compare repair families against the exact two red fixtures.

### Candidate A — post-continuity dynamic revalidation + upstream fallback

Evaluate the realized final command against the same player-conflict contract. If it is unsafe:
- prefer a dynamically safe refined move;
- then safe coarse preferred move;
- otherwise produce an explicit bounded conflict response.

Measure:
- predicted clearance restored or not;
- real World contact removed or not;
- command discontinuity from unconstrained NATURAL;
- whether temporal-state reset is required to avoid repeated invalid carry.

Risk: snapping / over-conservative behavior / treating player as pseudo-static geometry.

### Candidate B — constraint-aware temporal realization

Shape temporal acceleration/steering inside a dynamic admissible command region.

Measure against Candidate A only if A materially damages motion quality or produces repeated fallback oscillation.

Risk: movement-quality controller becomes coupled to dynamic conflict prediction and harder to reason about.

### Candidate C — hybrid emergency dynamic boundary + higher-level cooperation

Use a narrow final emergency boundary for imminent player conflict and keep ordinary pass/yield/right-of-way semantics in the local candidate/conflict layer.

This is currently the most promising **responsibility shape**, but is not selected until Candidate A test-only evidence exists.

## 7. Remaining campaign after the authority seam is repaired

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

Question: after final-command consistency is restored, can the existing candidate field resolve ordinary dynamic conflict without an explicit yield state, or does it oscillate / obstruct / over-yield?

### R1-5C — stationary player blocks current route

Distinguish:
- open space with alternatives: companion should normally find a useful pass-around realization;
- narrow passage with no simultaneous hard-feasible pass: waiting/yield/back-off may be correct.

The same “player in front” observation must not automatically produce one universal behavior.

### R1-5D — doorway responsibility / release

Use the existing doorway as a **choke falsifier**, not as a special-case policy trigger.

Campaign:
- player enters first;
- companion enters first;
- simultaneous approach;
- player reverses while companion is committed;
- player waits in the choke then clears;
- repeated independent episodes.

### R1-5E — push / pin / release regression

After release:
- static hard/comfort recovery must remain intact;
- player-conflict state must clear;
- R1-5 must not create a second sticky state above R1-4 recovery.

### R1-5F — moving relationship objective under conflict

The player is both:
- the dynamic actor the companion should not obstruct;
- and the source of a moving relationship objective.

Conflict handling must not confuse “player moved, therefore objective moved” with “player currently owns right-of-way”.

## 8. Public conflict evidence to design before authority

The workbench needs enough public evidence to answer:

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

## 9. What not to optimize blindly

Do not start by tuning:
- `S3_PLAYER_BUFFER`;
- the 0.55 s prediction horizon;
- player-risk weights;
- preferred speed;
- doorway dimensions;
- candidate direction count.

Those are parameters, not explanations. R1-5A already localized one semantic failure: the accepted dynamic conflict decision is not authoritative at the final command boundary.

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

While that gate is open, current R1-5 work remains isolated from the published runtime. The red fixtures and test-only repair comparisons are allowed as research evidence; they do not silently promote new movement behavior.

Do not claim/promote yet:
- active R1-5 yield behavior as the project foundation;
- R1-5 mechanical PASS;
- an R1-5 Pages runtime;
- S5 movement authority.

Any material R1-4 Owner finding outranks this plan and may change R1-5 assumptions.

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

**Public runtime:** leave audited R1-4 unchanged until Owner browser evidence arrives.

**Research branch:** perform the R1-5A **test-only repair comparison** against the exact red isolation and World fixtures.

The first candidate to falsify is deliberately simple:

> final dynamic revalidation + safe refined/coarse fallback.

If that removes the red violation/contact with acceptable command discontinuity, it earns consideration as the narrow emergency authority boundary. If it introduces snapping, repeated fallback, or new progress failures, compare a constraint-aware actuator rather than tuning around the damage.
