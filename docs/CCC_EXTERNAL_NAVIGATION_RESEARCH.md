# CCC — External Navigation Research Notes

Status: **RESEARCH INPUT · NOT ARCHITECTURE AUTHORITY**

Date: 2026-09-14

Purpose: challenge the Companion Coordination Core skeleton against relevant work from multi-agent collision avoidance, human-aware navigation and shipped companion-AI practice. The goal is to recover useful principles, not to select middleware or copy another project’s architecture.

---

## 1. Velocity-space reasoning is a strong conceptual match, but ORCA itself is not the default answer

### Sources

- Jur van den Berg et al., **Optimal Reciprocal Collision Avoidance (ORCA)**: https://gamma-web.iacs.umd.edu/ORCA/
- RVO2 documentation: https://gamma-web.iacs.umd.edu/RVO2/
- RVO2 v2 design notes: https://gamma-web.iacs.umd.edu/RVO2/documentation/2.0/whatsnew.html

### Relevant finding

ORCA expresses local dynamic collision avoidance as constraints in velocity space and chooses a feasible velocity near an externally supplied preferred velocity. This separation is highly relevant to CCC:

`coordination preference -> admissible velocity region -> realized velocity`

It supports the idea that WHERE/PACE should not directly mutate position and that local direction+speed selection can remain an inspectable velocity-space problem.

### Important mismatch

Classic ORCA assumes **reciprocal responsibility**: both agents take a share of collision avoidance. The player in Companion Brain Lab is not another autonomous ORCA peer. We generally want the companion to carry much more responsibility for staying out of the player’s flow.

Therefore:

- use velocity-space reasoning as conceptual donor;
- do not adopt symmetric ORCA responsibility as the player-companion policy;
- do not add ORCA/RVO middleware unless later evidence shows our bounded local field cannot express the needed behavior cleanly.

---

## 2. Right-of-way is a semantic layer, not merely stronger collision avoidance

### Source

- Sean Curtis, Stephen J. Guy, Basim Zafar, Dinesh Manocha, **Pedestrian Velocity Obstacles / right-of-way work**: https://gamma-web.iacs.umd.edu/PEDS/

### Relevant finding

The pedestrian work explicitly observes that symmetric collision-response assumptions are inappropriate in meaningful situations. Stationary/waiting pedestrians can shift responsibility toward moving pedestrians; right-of-way defines who should yield rather than only whether two trajectories geometrically collide.

### CCC implication

This independently supports the current CCC split:

- `PLAYER COOPERATION` owns ordinary right-of-way / yielding / corridor policy;
- collision prediction supplies evidence to that policy;
- the rare downstream player physical-agency guard should not become the right-of-way system.

This also suggests that **responsibility itself may be contextual evidence**, not a fixed scalar. In the first non-combat follow experiments the companion can carry nearly all yielding responsibility, while future combat/contact semantics may deliberately change it.

---

## 3. Constrained passage is cooperative trajectory reasoning

### Source

- Harmish Khambhaita, Rachid Alami, **Viewing Robot Navigation in Human Environment as a Cooperative Activity**: https://arxiv.org/abs/1708.01267

### Relevant finding

The work treats navigation in shared constrained spaces as cooperation rather than independent path following. It uses predicted human trajectories together with motion compatibility and proxemic constraints and explicitly targets both open and confined situations.

### CCC implication

Doorways and chokepoints should not be treated as merely “more collision risk”. They are strong falsifiers for the semantic relationship between:

- predicted player corridor;
- route topology;
- right-of-way responsibility;
- temporary yielding;
- release/resume after passage.

This strengthens the decision to make doorway contention a first-class CCC-2 campaign rather than patching it locally in the mover.

---

## 4. Human-aware navigation supports short motion history and uncertainty, not omniscient prediction

### Sources

- Ronja Möller et al., **A Survey on Human-aware Robot Navigation**: https://arxiv.org/abs/2106.11650
- Daeun Song et al., **HumAIN: Human-Aware Implicit Social Robot Navigation** (2026): https://arxiv.org/abs/2607.07357

### Relevant finding

Human-aware navigation research repeatedly combines trajectory prediction with social/spatial constraints. Recent work also uses historical motion and body-orientation cues rather than only instantaneous position.

### CCC implication

A useful player corridor probably should not be based on one velocity sample forever. A **short bounded motion history** can be a legitimate input to corridor direction, confidence and persistence.

However, the laboratory does not need learned trajectory prediction at this stage. The first version should remain deterministic and inspectable so we can understand failure modes before introducing a richer predictor.

Candidate early representation:

- current requested/actual velocity;
- short recent velocity history;
- persistence/confidence estimate;
- horizon that contracts when direction is unstable or the player is nearly stopped.

This is a research hypothesis, not a selected API.

---

## 5. Shipped buddy-AI practice independently converges on regions/candidates and future-clearance tests

### Sources

- Max Dyckhoff, **Ellie: Buddy AI in The Last of Us**, GDC 2014: https://www.gdcvault.com/play/1021010/Ellie-Buddy-AI-in-The-Last-of-us
- Game AI Pro 2, **Ellie: Buddy AI in The Last of Us**, Chapter 35: https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter35_Ellie_Buddy_AI_in_The_Last_of_Us.pdf
- John Abercrombie, **Bringing BioShock Infinite's Elizabeth to Life**, GDC 2014: https://www.gdcvault.com/play/1020831/Bringing-BioShock-Infinite-s-Elizabeth
- GoldFire Studios, **Companion AI Improvements**: https://cms.goldfirestudios.com/companion-ai-improvements/

### Relevant finding

The Last of Us used a follow **region** around the leader, generated multiple candidate follow positions, and evaluated future geometric suitability rather than blindly chasing one offset. Later buddy-follow work retained candidate positions and added hysteresis to avoid behavioral oscillation.

GoldFire’s companion postmortem similarly reports moving from naive desired placement to multiple possible target locations plus explicit local avoidance/dodging when the companion obstructed the player.

### CCC implication

This is not proof that our S5-like field is correct, but it independently supports several current hypotheses:

- relationship should be a region/candidate field rather than a single rigid slot;
- future suitability matters, not only current occupancy;
- obstruction of player flow deserves explicit behavior, not only collision response;
- continuity/hysteresis is necessary, but must be applied to semantic region identity rather than preserving a bad motor command.

The CCC work should still be driven by our own falsifiers rather than reproducing these shipped systems.

---

## 6. What the research changes — and what it does not

### Strengthened hypotheses

1. **WHERE as a coherent region** is better grounded than fixed slot following.
2. **velocity-space local realization** is a strong fit for joint direction+speed selection.
3. **right-of-way responsibility is semantic and potentially asymmetric**.
4. **doorway/chokepoint cooperation needs explicit reasoning**, not a local patch.
5. **short motion history / prediction confidence** is worth testing in the player-corridor model.
6. **continuity belongs at several semantic levels**: region commitment, cooperation episode commitment and motion realization are not the same hysteresis problem.

### Rejected premature conclusions

The research does **not** justify:

- adopting ORCA/RVO2 as middleware now;
- assuming reciprocal avoidance between player and companion;
- adding ML trajectory prediction;
- switching to navmesh/crowd architecture;
- copying The Last of Us / BioShock positioning rules;
- freezing a proxemics model before Owner evidence;
- solving multi-companion coordination before the one-companion contract works.

---

## 7. New falsification questions for CCC-0/CCC-2

The external comparison adds several high-value questions:

- Does a corridor based only on instantaneous player velocity oscillate under rapid direction changes?
- Does a short history/confidence model reduce false yielding without making the companion stale?
- Can right-of-way responsibility be represented independently from geometric collision probability?
- Can the companion commit to one side during a passing episode without becoming trapped when the player reverses?
- Can doorway yielding be released from factual topology/trajectory evidence rather than a timer?
- Does semantic region hysteresis reduce target churn without preserving a now-bad local velocity?
- Does the local velocity field remain responsive when asymmetric player responsibility becomes strong?

These questions should inform shadow instrumentation before movement authority changes.

---

## 8. Current verdict

**No architecture replacement is justified by external research.**

The existing CCC skeleton survives this comparison and becomes more precise:

> Use fields/regions to express useful relationship space, explicit pace to express temporal pressure, asymmetric cooperation/right-of-way to shape normal velocity choice, and separate rare hard authorities to protect physical invariants after temporal realization.

The most important external warning is also consistent with recovered R1-5A evidence: **do not turn the final collision/agency boundary into the behavior policy itself.**