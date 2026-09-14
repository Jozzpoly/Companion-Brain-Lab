# R1-5 — Player Physical Authority + Cooperation / Right-of-Way

Status: **R1-5A MECHANICAL PASS · OWNER EVIDENCE NOT YET RUN · R1-5B COOPERATION POLICY NEXT AFTER GATE**

Date: 2026-09-14

Historical public base: audited R1-4 application runtime `8f08761cdfde3f0b5d3e595f4bb844d106104ed4`.

Qualified R1-5A application checkpoint: `c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`.

Detailed qualification: `docs/R1_5A_PLAYER_AUTHORITY_QUALIFICATION.md`.

Historical RED evidence: `docs/R1_5A_DYNAMIC_FINAL_COMMAND_RED_EVIDENCE.md`.

This document now treats R1-5 as two related but distinct responsibilities:

- **R1-5A — final physical player authority:** mechanically qualified;
- **R1-5B+ — cooperation/right-of-way/commitment/release:** still open.

Do not collapse these responsibilities back together.

## 1. What R1-5A established

The original R1-5 question was whether NATURAL temporal realization could invalidate a player-aware preferred-motion decision after upstream avoidance had already accepted it.

That failure was reproduced deterministically and in the real Rapier World.

Before repair, one abrupt-turn fixture produced:
- DIRECT: zero player displacement and zero player motion error;
- NATURAL: five player-contact frames, about `0.00698 m` player displacement and about `0.22756 m/s` player motion error.

The authority gap was:

`player-aware preferred motion`

`-> NATURAL continuity`

`-> static-only final gate`

`-> player-disturbing command`

`-> World`.

R1-5A now inserts a separate final player physical-authority boundary after static final authority.

Qualified chain:

`relationship objective / useful region`

`-> static route / corridor`

`-> short-horizon local candidates + player comfort/risk policy`

`-> temporal realization`

`-> final static hard authority`

`-> final player physical authority`

`-> World physical outcome`.

## 2. Critical contract learned during falsification

### Comfort/right-of-way is not hard physical authority

The S3 player model uses:
- prediction horizon `0.55 s`;
- player buffer `0.18 m`.

Making that entire envelope a final hard constraint was explicitly tested and rejected:
- head-on moving-player case required `17` emergency corrections;
- cross-front case could sacrifice net objective progress.

Therefore the `0.55 s + 0.18 m` model remains **upstream cooperation / comfort policy evidence**.

It is not the final physical safety boundary.

### Collider contact is not automatically loss of player agency

Rapier may expose contact-manifold frames near a physical boundary while requested-vs-actual player motion remains undisturbed.

R1-5A therefore does not optimize for “zero contact frames at any cost.”

Hard final responsibility is:
- do not materially penetrate/push through the player because of the companion command;
- do not materially force requested-vs-actual player motion away from player input;
- do not repair player authority by violating static hard geometry.

## 3. Qualified R1-5A architecture

Component:

`src/brain/final-player-command-constraint.ts`

Execution position:

`NATURAL continuity -> static final gate -> player final gate -> World`.

Current hard physical margin:

`0.002 m`.

The player final gate:
- predicts only the next physics step;
- uses body radii, not the S3 comfort buffer;
- permits egress from boundary/overlap states;
- prefers already player-aware upstream motion as its repair direction;
- keeps dynamic repair statically hard-safe;
- uses explicit best-effort maximum-separation behavior if the player’s own motion makes the desired hard clearance impossible that frame;
- resets only temporal actuator history when it changes the command.

This gate is deliberately narrow. It is not a social navigation policy.

## 4. Mechanical qualification state

Exact runtime checkpoint:

`c84c1342a87b267dc5a94b1008d25bd1e0ed1e5c`

Final CI run:

`34872858900`

Result:
- 31/31 test files PASS;
- 122/122 tests PASS;
- TypeScript PASS;
- production build PASS.

Integrated matrix:
- abrupt-turn RED class: `2/36` hard player interventions, player motion error `0`;
- head-on moving player: `0/72` interventions;
- cross-front moving player: `0/72`;
- reversal: `0/72`.

Interpretation: the gate is currently a rare emergency boundary rather than hidden steering.

Static/player composition also passes:
- a real static final fallback remains authoritative when already player-safe;
- dynamic repair does not reintroduce hard static blockers;
- doorway reversal/recovery still reaches its target and does not accumulate persistent failure.

## 5. Observability contract

Owner/debug evidence now separates:

### Upstream comfort/policy
- predicted player conflict in candidate scoring;
- route/comfort evidence;
- spatial choice and refinement.

### Final static hard authority
- source;
- constrained flag;
- blocker;
- reason.

### Final player physical authority
- source;
- constrained flag;
- current physical clearance;
- required hard clearance;
- original predicted clearance;
- final predicted clearance;
- reason.

Browser motion arrow convention:
- green — final hard layers did not change the command;
- yellow — static hard authority changed it;
- red — player physical authority changed it.

Incident schema:

`companion-brain-lab-r1-causal-incident-v3`.

The Owner should be able to distinguish “upstream avoids/yields” from “emergency final authority clipped/repaired this actual command.”

## 6. R1-5A Owner/browser gate boundary

Mechanical qualification is not Owner qualification.

R1-5A Owner play should deliberately stress:
- abrupt crossings while companion already carries velocity;
- sudden player stop/reversal;
- repeated near passes;
- player push/body interaction;
- static geometry plus player proximity;
- multiple independent conflict episodes;
- NATURAL vs DIRECT comparison.

Pass criterion is not “never touches the player.”

The Owner question is:

> Does the companion preserve player agency without visibly turning the final hard gate into constant emergency steering?

Use the motion panel and red command-arrow state to distinguish a rare final authority correction from ordinary upstream avoidance.

If something feels wrong, capture incident `I`; v3 evidence preserves the player-authority numbers explicitly.

## 7. R1-5B — cooperation / right-of-way

R1-5B starts only after the appropriate Owner/browser evidence permits it.

Its question is different:

> Before the emergency physical boundary is reached, does the companion make sensible, stable, legible cooperation choices around a human-controlled player?

Do not solve R1-5B by expanding the final hard gate.

### Required properties

1. **Asymmetric player priority without paralysis.** The companion should normally adapt more than the human player, but not freeze forever whenever the player is nearby.
2. **Open-space pass preference.** If a useful, hard-feasible path around exists, ordinary conflict should usually remain moving.
3. **Real choke acknowledgement.** A tight passage may legitimately require waiting, yielding or backing off.
4. **Commitment / hysteresis.** Avoid rapid left/right, go/stop, pass/yield switching.
5. **Public release condition.** A wait/yield behavior that never releases is a failure.
6. **Relationship objective remains truthful.** Cooperation may constrain local realization but does not secretly teleport/rewrite the long-horizon objective.
7. **Final player authority stays last resort.** High emergency-gate intervention frequency is evidence that upstream cooperation is failing.

## 8. R1-5B first falsifiers — open space before doorway

Start with static-free encounters so a wall cannot explain bad behavior.

### B1 — head-on

Variables:
- player enters straight through companion route;
- different lateral offsets;
- player speed changes;
- player stops after companion begins an avoidance maneuver.

Measure:
- pass-side switch count;
- stop duration;
- player requested-vs-actual disturbance;
- companion progress loss;
- final player hard-gate intervention count;
- minimum actual separation;
- resume latency.

### B2 — orthogonal cross-front

Question: can the companion choose between going behind, going ahead, slowing, or yielding without oscillation?

### B3 — player reversal

After the companion commits to a pass, reverse the player through that commitment.

This is the first strong test of whether explicit commitment/hysteresis is needed.

### B4 — stationary player in open space

A stationary player should not automatically become a permanent wall if useful hard-feasible alternatives exist.

## 9. R1-5C — choke responsibility

Only after open-space behavior is understood, use doorway/hallway falsifiers:
- player enters first;
- companion enters first;
- simultaneous approach;
- player waits in choke;
- player reverses in choke;
- repeated independent episodes.

Potential local responses to distinguish:
- pass around;
- yield;
- wait;
- back off;
- resume.

These labels may be classifications over compact commitment/release state. Do not automatically build a giant behavior FSM.

No doorway-specific dispatch key qualifies as a general solution.

## 10. R1-5D — push / pin / release regression

Any new cooperation policy must preserve earlier recovery work:
- static hard/comfort egress remains intact;
- player-conflict policy clears after release;
- retry episode re-arms only after healthy progress;
- no second sticky state appears above R1-4 recovery;
- final player hard-gate use remains bounded.

## 11. R1-5E — moving relationship objective under conflict

The player can be both:
- the high-priority dynamic actor;
- the source of a moving relationship objective.

The companion must not confuse:
- “the target moved”;
- “the player owns right-of-way now”;
- “the final physical authority intervened.”

These remain separate evidence channels.

## 12. Research signals — inputs, not selected architecture

### Asymmetric responsibility is legitimate

Classic ORCA shares pairwise avoidance responsibility equally. That is useful for peer agents but not an exact match for a human-controlled player who is not running reciprocal companion policy.

Reference: https://gamma-web.iacs.umd.edu/ORCA/

Variable-responsibility ORCA research supports treating relative responsibility as an explicit design variable rather than accidental symmetry.

Reference: https://kguo-cs.github.io/publication/multi-agent-trajectory-planning/

### Shipped navigation exposes priority

Unity NavMeshAgent exposes avoidance priority; manually controlled actors can be given high priority so agents adapt more strongly.

Reference: https://docs.unity3d.com/6000.0/Documentation/ScriptReference/AI.NavMeshAgent-avoidancePriority.html

This is precedent for asymmetric responsibility, not a decision to adopt Unity navigation.

### Tight passages remain coordination problems

Narrow hallways/doorways are not solved merely by collision-free velocity constraints; coordination and deadlock semantics matter.

Reference: https://link.springer.com/article/10.1007/s10514-025-10194-8

### Current candidate field remains worth deepening first

The existing inspectable candidate lattice already carries separate route, clearance, player-risk and continuity evidence. Context-style steering remains relevant because it can keep these dimensions legible without collapsing them into a monolithic force sum.

Reference: https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter18_Context_Steering_Behavior-Driven_Steering_at_the_Macro_Scale.pdf

Do not import ORCA/RVO or a crowd stack merely because it is standard. Escalate only if bounded evidence shows the current representation cannot express stable cooperation cleanly.

## 13. Escalation conditions

Broaden the movement/navigation substrate comparison if one or more become true:
- stable cooperation requires accumulating scenario-specific branches;
- the directional candidate field cannot represent a feasible conflict-free choice;
- commitment logic merely hides persistent oscillation;
- final hard player-authority intervention becomes frequent during ordinary interaction;
- dynamic and static responsibilities cannot remain causally separable;
- a few-companion extension would require replacing rather than generalizing the one-companion solution.

Compare alternatives with identical R1 scenarios/evidence, not by feature list.

## 14. S5 compatibility

S5-A remains a useful later donor:
- route-aware continuous relationship field;
- bounded shortlist;
- coherent connected good-region logic;
- centroid-collapse falsifier already corrected one topological failure.

It never received movement authority.

After the relevant R1 Owner robustness gates:
1. transplant/rebase S5 field logic onto the post-R1 substrate;
2. requalify against current routing, recovery and player-cooperation semantics;
3. expose it in shadow beside preserved S1 behavior;
4. only later consider movement authority.

Do not merge the historical S5 branch wholesale and restore old movement assumptions.

## 15. Current next move

**Public runtime:** keep the audited R1-4 Pages runtime unchanged until its Owner/public gate sequencing is deliberately resolved.

**R1-5A:** mechanical qualification is complete at `c84c1342...`; do not call Owner PASS without browser/play evidence.

**R1-5B:** prepare only bounded falsifiers/research apparatus until the gate permits active cooperation policy work.

If Owner evidence exposes a material R1-4 or R1-5A problem, reopen that responsibility before adding right-of-way behavior.
