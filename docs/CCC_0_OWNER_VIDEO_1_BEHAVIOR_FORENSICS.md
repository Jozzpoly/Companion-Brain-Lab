# CCC-0 Owner Video #1 — Behavior Forensics

Status: **OWNER ALIVENESS SIGNAL CAPTURED · CAUSAL AUDIT IN PROGRESS · NO AUTHORITY PROMOTION · NO TUNING YET**

Date: 2026-09-14

Owner observation:

> first minimal feeling that the companion is starting to behave alive; cause not consciously identifiable; something appears to be emerging.

This is treated as research evidence, not as proof that current behavior is good or that CCC-0 shadow cognition caused the effect.

---

## 1. Why this observation matters

The signal is interesting precisely because it was weak, spontaneous and not attributed by the Owner to one visible rule. The useful question is therefore not:

> how do we increase the effect immediately?

It is:

> which parts of the current temporal movement system read as genuine embodied agency, and which defects happen to produce a similar perceptual signature?

The present runtime must be preserved long enough to answer that question before tuning or authority changes erase the evidence.

---

## 2. Critical lineage falsification

The Owner-qualified Foundation preview is pinned to:

`b217943e027e66993f0010643b2933b01d4b1e6d`

The post-foundation CCC planning/runtime base is:

`5e809fc61433b3eceefde088243ad736da0e5b1b`

A live commit comparison between those checkpoints found no movement-runtime source modification. The intervening changes are documentation/workflow work plus an additional Foundation DIRECT survival test.

The qualified CCC-0 runtime is:

`a2a0e793f01a6fe3b435e473cb9912347f2fcb0d`

CCC-0 additionally has automated parallel-World evidence that its shadow evaluation does not change authoritative movement output within the tested workbench contract.

Therefore the first Owner aliveness signal should **not** currently be attributed to WHERE/PACE/PLAYER FLOW shadow authority. No such authority exists.

Best current interpretation:

> the movement stack already contained a latent perceptual aliveness signal; the present test setup and observability made it noticeable.

This makes the signal more valuable, not less: we may have discovered useful dynamical properties already hiding inside the system.

---

## 3. Video evidence — bounded interpretation

Source: first CCC-0 Owner browser recording, ~108 seconds.

The recording covers doorway, pillar, head-on and open-space play, then returns to doorway. The final ~18 seconds are especially useful because most dense overlays are disabled and Trails remain visible, making the body trajectories easier to read.

Approximate screen-space tracking of the colored player/companion bodies was used only as a supporting observation. It is **not World-authoritative telemetry** and must not be used as a numerical movement contract.

Observed qualitative classes:

- the companion frequently follows a curved path while the player's path is much more direct/polygonal;
- it changes side relative to the player rather than simply reproducing the player's trajectory;
- it sometimes moves substantially laterally relative to the player-companion bearing;
- it sometimes temporarily increases separation rather than monotonically chasing;
- speed visibly modulates instead of remaining a constant chase speed;
- close passes, reversals and doorway motion produce correction arcs rather than instantaneous direction flips;
- after local displacement the companion often appears to recover a relationship rather than merely snap back to a point.

Approximate tracking in the final doorway/Trails segment supports the qualitative impression: lateral-dominant motion and temporary motion away from the player occupy a material fraction of the companion's moving samples. Separation also varies far beyond the legacy preferred relationship radius.

The latter is deliberately a warning: **motion that reads as alive is not automatically good relationship control.**

---

## 4. Current candidate sources of genuine proto-agency

### A. Multiple temporal scales

The current runtime is not a stateless `moveToward(player)` controller.

Relevant cadences are approximately:

- legacy relational objective reconsideration: 6 World ticks (~10 Hz);
- local spatial velocity decision: 3 World ticks (~20 Hz);
- temporal realization / physics: every World tick (~60 Hz).

This gives the system a hierarchy of persistence:

`slower relationship intention -> faster local movement choice -> continuous physical realization`

A response can therefore persist long enough to look like an intention while local movement and the body continue adapting underneath it.

This is a strong candidate for a real aliveness primitive.

### B. State/history changes the next action

The current system carries several kinds of history:

- previous relationship slot / player heading;
- previous local movement choice;
- actual body velocity;
- previous acceleration through motion continuity;
- progress/recovery episode state;
- physical World outcome.

Therefore action at time `t` is not determined only by the current player coordinate. This can produce persistence, correction, hesitation, braking, side changes and recovery trajectories.

Hypothesis:

> a meaningful part of the first aliveness signal is the transition from a stateless servo to a history-dependent dynamical system.

This should be preserved as a research principle even if almost every current implementation detail is later replaced.

### C. Joint direction + speed choice

The local spatial layer samples multiple direction and speed combinations and scores route progress, relationship error, static clearance, predicted player interaction, continuity and unnecessary movement.

The companion is therefore not forced to answer every problem with "full speed toward target." Sideways, slower, stopped and retreating local responses are all representable.

This is another plausible real contributor to perceived agency.

### D. Weighted local refinement

NATURAL can blend several near-best local velocity candidates rather than executing only a discrete 24-direction winner.

This can transform coarse tactical choices into smooth curved motion without requiring spline choreography or animation tricks.

### E. Physical temporal continuity

NATURAL realization uses actual velocity, bounded acceleration/braking and bounded jerk. It has physical memory.

This can make a changed intention look like a body reconsidering/reorienting rather than a vector instantly rotating.

That visual/temporal property is likely valuable, but it is also capable of making bad upstream decisions look convincingly intentional.

### F. Soft comfort / hard feasibility distinction

The R1 local layer can tolerate temporary comfort violations while preserving hard feasibility and seeking egress. This can produce squeeze/yield/recover motion that looks less robotic than a single binary exclusion radius.

This remains physical/spatial policy, not true player right-of-way semantics.

---

## 5. First major "living error" found — semantic slot stability can hide world-target teleportation

This is currently the most important behavior-forensics finding.

Legacy relationship hysteresis preserves the **slot label**, for example `back`, `left` or `back-right`.

The slot position itself is rebuilt in the player's current heading-relative frame at radius `1.45`.

Therefore preserving the same symbolic slot is not the same as preserving the same spatial intention.

Examples for a stationary player position:

- 180° player-heading reversal while retaining the same slot can displace the target by approximately `2 × 1.45 = 2.9` World units;
- a 90° heading turn can displace it by approximately `sqrt(2) × 1.45 ≈ 2.05` World units.

The relationship layer can simultaneously report semantic continuity ("retain same slot") while handing the movement stack a radically displaced target.

NATURAL then does something mechanically reasonable with that bad upstream event:

1. local locomotion begins selecting toward the relocated objective;
2. weighted refinement may soften the coarse change;
3. motion continuity preserves velocity/acceleration history;
4. the body follows a broad correction arc instead of snapping direction;
5. the result can look like deliberate repositioning around the player.

This is a prime **living-error hypothesis**:

> a semantically discontinuous target jump is being transformed by a good temporal actuator into motion that perceptually resembles intentional regrouping.

Do **not** immediately remove the arc, and do **not** preserve the bug because the arc looks good. Separate the valuable temporal shape from the defective objective semantics.

---

## 6. Related semantic debt — objective identity can remain unchanged while the target moves radically

The current workbench objective key is based on the selected slot label:

`spatial-slot:<slot>`

If the player reverses and hysteresis retains the same slot label, the objective key remains unchanged even when the physical target jumps several World units.

The progress/recovery system is deliberately capable of tracking moving objectives, which is normally useful. In this case, however, a large frame-induced target relocation may be interpreted as continuous movement of the same semantic episode.

Open question:

> when does a moving relationship objective remain the same intention, and when has its spatial meaning changed enough that continuity/recovery must treat it as a new or transformed intention?

This distinction should be evidence-driven rather than encoded as another arbitrary distance threshold now.

---

## 7. Other plausible living errors / false agency to falsify

### Deterministic side bias

Legacy slot ties are resolved deterministically by slot-string ordering. Symmetric geometry may therefore acquire a repeatable side preference that looks like personality but is only an implementation tie-break.

Shadow WHERE also uses deterministic sample-id tie-breaking after score equality. Its world-space continuity/travel terms reduce the risk, but exact-symmetry bias still needs explicit observation.

Question:

> does the companion appear to "prefer a side" because it has useful continuity, or because lexicographic/sample ordering silently chose one?

### Unsafe near-miss as apparent cooperation

Current qualified runtime still lacks the historical R1-5A final player physical-agency guard. NATURAL temporal carry can therefore create close passes that look skillful without being guaranteed player-safe.

Question:

> is an impressive near-miss upstream cooperation, or merely momentum that happened not to collide this time?

### Catch-up loop as apparent initiative

Video separation sometimes grows far beyond the preferred relationship radius. A later curved recovery can look like independent exploration followed by regrouping.

Question:

> did the companion choose meaningful space, or did it simply lose the relationship and recover gracefully?

### Local avoidance as apparent social behavior

The spatial scorer predicts player clearance and penalizes player risk. This can look like yielding/crossing etiquette even though no explicit right-of-way model exists.

Question:

> is the observed side-step semantically cooperative, or only a geometrically cheap non-collision candidate?

These distinctions matter because the future system should retain the *felt benefit* while replacing accidental causes with deliberate teammate semantics.

---

## 8. Current behavior-forensics matrix

The next research campaign should inspect these stimulus classes against the full causal chain rather than tune weights globally.

| Stimulus / episode | Primary question | Suspected useful mechanism | Main falsifier |
| --- | --- | --- | --- |
| steady translation | does companion settle into a relationship without servo-chasing? | relationship persistence + speed choice | repeated needless side switching |
| stop | does body settle naturally? | speed candidates + continuity/braking | orbiting/overshoot around a stationary player |
| small heading change | does intention remain spatially coherent? | hysteresis / world continuity | large target jump despite trivial turn |
| 90° turn | does companion reform relationship or chase a rotating slot? | temporal realization | ~2.05-unit same-slot target displacement artifact |
| 180° reversal | does companion regroup intelligently? | continuity + local side choice | ~2.9-unit same-slot target teleport rendered as a nice arc |
| left/right jitter | does it resist thrash? | hysteresis + continuity | deterministic oscillation / fake confidence |
| cross-front | does it yield/pass meaningfully? | player-risk score | lucky avoidance with no right-of-way semantics |
| pass-behind | does it preserve player flow? | local velocity choice | unnecessary overreaction |
| close pass | is near-miss controlled? | local prediction | unsafe NATURAL carry |
| large separation | is catch-up purposeful? | emergent speed selection | graceful recovery from earlier relationship failure |
| doorway enter/stop/reverse | does it understand shared constrained space? | route + local motion + hard/comfort | slot/frame target churn across choke topology |
| pillar side change | does it preserve coherent side/topology? | routing / shadow coherent region | side changes driven by tie-break or target teleport |
| head-on | does it negotiate space? | local player-risk avoidance | symmetric dithering / unsafe carry |
| conflict clears | does it resume rather than restart personality? | bounded recovery | retry-induced arbitrary discontinuity |

---

## 9. Causal chain to inspect for every interesting motion

Use the existing workbench rather than inventing a second telemetry runtime.

For an interesting arc, pause/single-step or capture an incident and reconstruct:

1. **relationship objective** — label, revision, target, and especially target displacement in World space;
2. **route** — path/status/cost/topology change;
3. **local spatial decision** — HOLD / ADVANCE / SIDESTEP / BACKOFF, selected candidate, accepted/rejected set;
4. **hard-vs-comfort repair** — whether egress/comfort pressure changed the local ranking;
5. **preferred refinement** — coarse vs weighted refinement and angular change;
6. **motion continuity** — ACCELERATE / STEER / BRAKE / HOLD, speed, velocity error, acceleration, jerk;
7. **final hard constraint** — whether the temporal command survived or was replaced/stopped;
8. **World outcome** — actual motion/contact vs requested command;
9. **progress/recovery** — progressing/tracking/blocked/recovering and whether local state was reset;
10. **CCC shadow disagreement** — WHERE/PACE/PLAYER FLOW evidence for the same episode.

The existing panel already exposes most of this live. Incident export should only be extended where post-video causal reconstruction proves that live-only evidence is materially missing.

---

## 10. Specific instrumentation gaps exposed by this recording

Do not build these automatically; verify each against the forensic campaign first.

Most valuable likely additions to the existing causal trace are:

- relationship target displacement since previous tactical revision;
- player-heading angular change at relationship reconsideration;
- explicit "same slot / moved target" evidence;
- spatial decision reason, not only state/candidate id;
- refinement source + angular delta in incident frames;
- continuity regime + preferred/final speed + acceleration/jerk in incident frames;
- hard/comfort local safety state;
- whether progress/recovery executed a local-state reset on the episode.

These fields would answer the current scientific question. A new parallel debug architecture would not.

---

## 11. Current interpretation of the first aliveness signal

### Supported

The movement system has crossed an important qualitative threshold relative to a simple follower servo:

- it has memory;
- it operates at multiple timescales;
- it can move laterally and temporarily away rather than only chase;
- it modulates speed;
- its physical realization preserves temporal continuity;
- it adapts after World outcomes and bounded recovery events.

Those properties plausibly contribute to the Owner's first weak perception of an independently behaving entity.

### Not supported

It is **not** yet justified to claim:

- CCC-0 shadow intelligence caused the aliveness;
- current relationship positioning is good;
- current broad loops are desirable;
- current player avoidance is true cooperation;
- current side preference is intentional;
- current pace is semantically coherent;
- the companion has crossed from follower into teammate.

### Strong current hypothesis

> Perceived aliveness is emerging from temporal continuity + persistent state + multi-rate decisions + nontrivial local motion, but some of the strongest visual signatures may currently be generated by upstream semantic discontinuities that the temporal motor renders gracefully.

That is a productive state for research: we now have both a real signal to preserve and concrete false-agency mechanisms to falsify.

---

## 12. Immediate mandate

Before CCC-1 authority design:

1. preserve the current qualified CCC-0 runtime as a reproducible reference;
2. run the behavior-forensics matrix above;
3. treat the 90°/180° same-slot target-jump class as the first explicit falsifier;
4. use incidents/single-step evidence to assign each interesting motion to the causal layer that produced it;
5. extend existing causal telemetry only for evidence that cannot be reconstructed today;
6. do **not** tune weights merely to make trajectories prettier;
7. do **not** eliminate broad arcs before determining whether the valuable temporal behavior can be retained with correct semantics;
8. do **not** promote CCC-0 shadow output to authority yet;
9. do **not** install R1-5A player hard guard merely to make this recording look safer; player-cooperation design still needs its own stage;
10. after the forensic campaign, re-plan the next experiment from the observed causes rather than from the previous CCC roadmap.

The next research question is now sharper:

> **Which temporal behaviors make the companion feel like it has an embodied continuing intention, and which are mistakes that only look like intention because our motor makes them graceful?**
