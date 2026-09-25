# Companion / Squad Field Lab Campaign

Status: **OWNER-CONFIRMED DIRECTION · ACTIVE DESIGN CAMPAIGN · NOT AN OWNER TEST**

Date: 2026-09-21

## 1. Why this exists

Companion-Brain-Lab is not trying to prove that one follower can execute a larger list of behaviors.

The project exists to discover **embodied cooperative intelligence**:

- one to several companions sharing the player's situation;
- useful local autonomy without babysitting;
- fast, low-attention player direction;
- readable initiative and correction;
- movement, preparation, contribution, recovery and regroup as one continuous relationship;
- later compatibility with richer local brains / SPC / LLM cognition without making those systems responsible for mundane competence.

Repeated Owner feedback has rejected narrow mechanism demos, hidden-oracle tests, marker/circle prototypes, command plumbing presented as gameplay, and machine-green systems whose intelligence is only visible in debug.

The lab therefore needs a broader instrument.

## 2. The new object: Companion / Squad Field Lab

The next substantial product of the research should be a **persistent playable squad sandbox**, not another one-purpose Owner-gate specimen.

The sandbox should let the Owner:

- play the player normally;
- have 1–several real embodied companion bodies present;
- select one, several or all companions;
- directly puppeteer one companion when desired;
- issue world-space movement / hold / regroup intent;
- author and edit formation slots;
- change spacing/orientation;
- move from group intent down to one-companion correction;
- change meaningful behavior/dynamics parameters;
- add/remove experimental companions;
- run the same squad through different spatial and cooperative situations;
- see what each companion is trying to do and why;
- inspect a selected companion deeply without drowning in all-agent debug;
- capture/replay useful incidents later.

The key requirement is breadth of **meaningful manipulation**, not number of buttons.

## 3. It is both a playground and a research instrument

Manual control is evidence.

When the Owner repeatedly authors the same kind of behavior manually, that pattern becomes a candidate for automation.

The research loop becomes:

`play → select → manually shape squad behavior → observe → identify repeated intent → encode the intent/constraint → let local brain take over part of it → compare → correct`

This is preferable to:

`invent AI state → build narrow demo → ask Owner whether it feels intelligent`

The sandbox should make the transition between manual authorship and autonomy gradual and inspectable.

## 4. Three distinct control planes

Do not collapse these into one command system.

### A. Setup / authoring

Changes the experimental initial condition.

Examples:

- add/remove companion body;
- drag actor starting positions while paused/setup mode;
- edit freeform formation slots;
- choose player-relative vs world-relative formation frame;
- change spacing/orientation;
- configure per-member parameters.

This is not an in-world order.

### B. Live player direction

Changes what the player asks of the squad during play.

Examples:

- move selected units to a point/region;
- hold an anchor;
- follow/regroup;
- adopt the current authored formation;
- tighten/spread formation;
- constrain operating distance;
- allow/disallow local deviation.

The semantic primitive is **intent / constraint**, not puppet velocity.

### C. Direct puppeteering

Temporarily controls one selected embodied companion directly.

Purpose:

- create a human gold-standard;
- test whether the World situation can support a desired maneuver;
- distinguish brain failure from movement/world failure;
- reproduce and compare incidents.

Direct control must be clearly visible as a different authority source from live orders or autonomy.

## 5. Squad model

### Real bodies, not UI tokens

The first multi-companion surface must use real Rapier bodies.

No roster entry may imply a live companion that does not physically exist in World.

### Bounded initial squad size

A practical first wide target is **1–4 companions**.

This is enough to expose:

- selection;
- assignment;
- formation geometry;
- companion↔companion conflicts;
- narrow-space behavior;
- regroup;
- group vs individual direction;
- readability pressure.

It is not a product cap.

### Identity isolation

Preserve historical single-companion evidence.

Keep canonical:

`ActorId = "player" | "companion"`

for the already-qualified single-companion stack where possible.

Introduce an explicitly experimental squad-body identity layer for additional manual members rather than silently broadening S1–S4 semantics.

Physics may support those bodies before cognition does.

## 6. Selection and manipulation grammar

The exact keys are not final, but the interaction grammar should support:

- click = select one companion;
- Shift+click = add/remove from selection;
- box/lasso selection if group size later justifies it;
- Select All;
- cycle focused companion;
- clear selection;
- a focused companion inside a multi-selection for deep debug/direct control.

World overlays must make selection unambiguous.

### World-space target manipulation

The sandbox should support direct spatial editing rather than command-menu dependence.

Candidate grammar:

- click/drag target handle to move an order anchor;
- drag individual formation slot handles;
- drag/rotate formation frame;
- optional numeric inspection/editing in the side panel;
- snap-free by default; optional snap/grid later if useful.

## 7. Formation model: editable geometry first, presets second

Do not define formation as an enum.

Canonical experimental representation:

- formation frame / anchor;
- frame orientation;
- ordered set of local slot offsets;
- member↔slot assignment;
- spacing/scale;
- slot tolerance;
- formation preservation policy.

A preset such as line, column, wedge or loose cluster should merely **generate editable offsets**.

The Owner must be able to drag any slot afterward.

This lets the project discover unusual useful formations instead of forcing every experiment through conventional labels.

## 8. Behavior / autonomy controls

Do not expose implementation booleans such as `WITHHOLD_CURRENT_CONTRIBUTION`.

Candidate research dimensions should map to intelligible player intent.

Potential dimensions:

- follow / hold / regroup / operate at will;
- operating radius from player/anchor;
- initiative allowance;
- preserve formation vs freely break it;
- return-to-formation/regroup priority;
- local responsibility envelope;
- permission to respond outside assigned sector/slot.

These remain hypotheses until gameplay pressure earns them.

## 9. Dynamics controls

Owner explicitly wants to vary how companions move, not merely where.

Useful experimental controls may include:

- formation spacing;
- slot acquisition urgency;
- regroup urgency;
- cohesion / allowed lag;
- movement responsiveness;
- speed cap relative to player;
- re-assignment hysteresis;
- slot tolerance.

A control is admitted only if changing it creates an immediately observable runtime difference.

Avoid decorative sliders.

## 10. Readability is a hard requirement

At a glance, World/HUD should communicate:

- who is selected;
- focused companion;
- manual / ordered / formation / autonomous authority source;
- target/anchor/slot for selected companions;
- formation frame and editable slot geometry;
- blocked/deviating/arrived state;
- whether a unit is deliberately leaving formation;
- why an order cannot currently be satisfied at a coarse human-readable level.

The sandbox should remain readable with four companions.

If four companions turn it into overlay soup, the design has failed.

## 11. Debug architecture

Do not render four full causal panels.

Use hierarchical observability.

### Group level

Always-available compact summary:

- roster;
- selection;
- global/group order;
- formation state;
- unresolved conflicts;
- episode state.

### Focused companion level

One detailed causal chain:

`player/group intent → assignment → local interpretation → movement/action proposal → constraint/arbitration → World outcome`

### On-world overlays

Scoped to selection by default:

- slot;
- target;
- anchor;
- path;
- authority/provenance;
- conflict/deviation marker.

Optional "show all" exists for forensic use.

### Incident capture

Capture must eventually include:

- roster;
- selection/focus;
- setup state;
- formation geometry;
- group/member orders;
- per-member authority/provenance;
- dynamics parameters;
- World situation;
- causal frames.

## 12. Scenario breadth

The sandbox should not be tied to one threat state machine.

A coherent first playground should allow the same squad/control model to be exercised across several already-relevant pressures:

1. **Open / free movement** — basic relationship and formation feel.
2. **Pillar / obstacle** — slot preservation vs local route adaptation.
3. **Doorway / narrow space** — compression, order preservation, crossing/conflict.
4. **Head-on / body conflict** — physical interaction and yielding.
5. **Continuous cooperative episode** — preparation, contribution, takeover, recovery, regroup.

The same squad state should ideally survive scenario changes where meaningful, or setup presets should make A/B recreation cheap.

## 13. Relationship to existing brains

Do not generalize every brain to N companions immediately.

The sandbox should allow an authority ladder:

- MANUAL;
- ORDERED POSITION / FORMATION;
- legacy/canonical single-companion brain where valid;
- experimental local autonomy later.

Additional companions may initially remain manual/order-driven while the canonical companion can optionally run existing logic.

This asymmetry is useful research evidence, not a defect.

It enables direct A/B:

- human-puppeted member;
- simple ordered member;
- autonomous canonical member.

## 14. Architecture direction

The current Rapier substrate already stores bodies as `Map<WorldBodyId, PhysicalActor>`.

The single-companion limitation is concentrated above it:

- `ActorId`;
- `MotionIntent`;
- canonical player/companion evidence;
- relationship brains;
- S1–S4 assumptions.

Prefer a bounded extension:

- preserve canonical `ActorId` semantics for historical evidence;
- introduce explicit experimental squad member IDs;
- allow generic body motion at the physical boundary;
- build a separate squad control/model layer;
- do not silently reinterpret extra members as the canonical `companion`.

## 15. The first meaningful wide slice

Do **not** stop after a one-companion command HUD.

The first slice that deserves broad Owner exploration should contain, in one coherent surface:

- player control;
- 1–4 real companion bodies;
- add/remove/reset squad;
- single + multi-selection;
- focused companion;
- direct manual control of focus;
- world-space move/hold target;
- editable formation frame + editable slots;
- spacing/orientation manipulation;
- at least a small set of genuinely meaningful dynamics controls;
- open + obstacle/doorway + continuous-episode situations;
- group summary;
- focus-aware causal debug;
- visible authority/target provenance;
- incident capture or at minimum deterministic setup/export sufficient to reproduce a useful configuration.

This is intentionally wider than the previous gate demos.

It is a **research playground**, not a polished game UI.

## 16. Internal implementation may still be staged

Wide Owner value does not mean one giant unsafe commit.

Internally use reversible tranches:

1. identity + generic physical motion substrate;
2. squad state / selection / focus model;
3. real 1–4 body sandbox;
4. setup placement;
5. world-space orders;
6. editable formation geometry;
7. meaningful dynamics;
8. selection-aware debug;
9. scenario integration;
10. continuous-play falsification.

But do not route a narrow tranche to the Owner as though it were the desired object.

## 17. Promotion criteria

The sandbox is ready for broad Owner exploration when:

- the Owner can spend time experimenting without following a scripted test;
- changing squad setup produces meaningfully different play;
- manual control and orders are visibly distinct;
- formation edits visibly persist and matter;
- several companions remain readable;
- narrow-space conflict produces informative behavior rather than chaos;
- the continuous cooperative episode can be authored and replayed through the same interface;
- debug explains surprising behavior after the fact;
- the interface exposes enough freedom to discover behaviors we did not explicitly script.

The benchmark is not "all controls work".

The benchmark is:

> **Does this feel like a laboratory in which the Owner can genuinely explore how a small companion squad should move, organize, respond and cooperate?**

---

## 18. Integrated machine checkpoint — 2026-09-22

The campaign has crossed its first broad substrate boundary.

Source `199c3d07d587660c5902b0fc3c7562d1850c545b` passed the full repository gate and the integrated `squad-field-lab-browser` rehearsal in run `35719945581`.

The qualified surface now combines real 1–4-body roster control, direct/manual authority, selection-scoped orders, editable formations/dynamics, multiple physical layouts, preserved live spatial setup and continuous cooperative pressure in one runtime.

This is deliberately **not** an Owner-test promotion.

The next campaign objective is breadth of unscripted experimentation and reproducibility: make it cheap to author, perturb, capture, restore and compare meaningful squad configurations, then use repeated Owner-authored patterns as evidence for future autonomy.



---

## 19. Owner-reaffirmed advanced authoring doctrine — 2026-09-24

The Owner reaffirmed that the Field Lab should grow into an **advanced, highly manipulable behavior laboratory**, not merely a command demo with a fixed handful of sliders.

This sharpens the campaign in four ways.

### 19.1 Parameters are an experimental surface, not UI decoration

The lab should expose a broad set of **causally meaningful** variables when they exist, including per-member and group-level movement, formation, responsiveness, authority and behavior parameters.

The goal is not maximal slider count. The goal is that the Owner can deliberately perturb the mechanisms that actually shape behavior and immediately observe the consequence.

Prefer:
- coherent parameter groups;
- exact numeric editing where useful;
- direct manipulation where spatial meaning is clearer;
- live inspection of the currently effective value;
- explicit scope: member / selection / group / formation / scenario;
- permissive ranges unless a value would make the runtime unstable rather than merely strange.

Avoid:
- decorative controls with weak/no observable effect;
- hidden clamping that makes experiments look valid while silently changing the authored value;
- exposing low-level implementation constants with no intelligible behavioral meaning.

### 19.2 Authoring must become reproducible evidence

A useful experiment should not disappear when the Owner changes scenario or reloads.

The Field Lab should progressively support a reproducible experiment description containing, where applicable:

`roster + body/setup state + selection/focus + formation geometry + orders + behavior/dynamics parameters + scenario + authority mode`.

The representation should be cheap to:
- capture;
- restore;
- duplicate;
- perturb;
- compare A/B;
- label with the observation/question being investigated.

This is more important than polishing a final-facing UX.

### 19.3 Manual behavior is a gold-standard generator

Manual/direct control and authored formations are not temporary fallbacks to be removed once AI exists.

Repeated Owner-authored solutions are research data about:
- useful geometry;
- timing;
- regroup/recovery;
- when formation should be preserved or broken;
- how much local deviation is desirable;
- how fast responsibility should transfer;
- which variables actually matter to perceived cooperation.

A candidate autonomous behavior should be able to reproduce, generalize or improve a useful authored pattern under changing conditions before it earns more responsibility.

The comparison should preserve the distinction between:
- exact replay of an authored solution;
- intent/constraint inferred from that solution;
- autonomous generalization.

### 19.4 The lab should support discovery beyond current vocabulary

Do not let today's FOLLOW/HOLD/MOVE, current formation policy or current dynamics vocabulary become the ceiling of the laboratory.

The Field Lab succeeds when it allows the Owner to discover:
- a useful behavior we did not pre-name;
- an interaction between parameters we did not predict;
- a formation or recovery pattern that suggests a new semantic primitive;
- a repeated manual intervention that reveals what autonomy is missing.

Therefore future authoring infrastructure should be judged partly by **expressive reach**:
can the Owner create materially different squad behavior without needing a new hard-coded mode for every experiment?

This strengthens, rather than replaces, the existing rule that every exposed variable must produce interpretable runtime consequences.

---

## 20. Reproducible experiment substrate + scoped dynamics — 2026-09-24

The campaign now has a stronger experimental backbone.

Qualified source `969a6bf90db67f6fedf48627fba092870b641fb5` passed full repository, broad Field Lab and persistent A/B browser gates in run `36060223003`.

Newly earned capabilities:

- versioned persistent experiment setups;
- exact restore of physical and authoring state;
- structural A/B diff;
- labels that survive reload;
- exact numeric parameter editing;
- group defaults versus selection-scoped member overrides;
- independent slowdown-radius authoring;
- explicit rejection of unsupported values rather than hidden clamping;
- material proof that scoped responsiveness changes Rapier requested velocity.

This changes the campaign sequencing.

Do not maximize parameter count next.

The next leverage point is temporal trial capture/comparison so new variables can be judged by their actual behavioral consequences, not merely by their existence in the control surface.

Target research loop:

`setup A/B → run traces → outcome/trajectory/error comparison → perturb → recurring Owner solution → candidate autonomy semantic`.

---

## 21. Temporal Trial / Trace v1 — 2026-09-25

The setup-to-behavior evidence gap is now materially narrower.

Qualified runtime:

`01bc4d1f2239c0c7608662e8881147e878a3862a`

Qualification:

`squad-field-lab-browser · run 36068333146 · SUCCESS`

Machine evidence:

- 188/188 test files and 744/744 tests PASS;
- production build PASS;
- broad Squad Field Lab browser rehearsal PASS;
- persistent experiment-authoring + temporal-trial browser rehearsal PASS;
- generated browser evidence contains no page, console or request errors.

The Field Lab can now run a bounded temporal trace directly from either captured persistent setup A or B. Trial start restores the exact authored setup before recording. Each real World tick can retain:

- per-member position and current target;
- target error;
- formation/direct authority and order mode;
- requested and actual velocity;
- physical motion error;
- contact count;
- temporal status such as MOVING / ARRIVED / BLOCKED / DIRECT / INVALID_TARGET;
- player position;
- cooperative outcome.

A completed trial exposes per-member temporal summaries including path distance, mean/max target error, mean motion error, blocked ticks + longest blocked run, contact ticks, direct ticks and authority/order transitions. A/B comparison reports descriptive B-minus-A deltas; it does **not** choose a winner or promote a behavior.

The browser qualification deliberately went beyond a static smoke test. It constructed a controlled A/B in OPEN space with the same embodied start, MOVE target and group dynamics. The only authored difference was C2 responsiveness:

`A: inherited group response 0.82`
`B: C2 response override 0.27`

Across matched 24-tick trials the slower C2 produced:

- `Δpath = -0.63 m`;
- `Δtarget error = +0.34 m`.

So the new layer is proven to expose a real causal behavioral consequence over time rather than merely serialize a trace.

### Current boundary

This is still **research instrumentation**, not an Owner-ready experiment UX and not autonomy.

In v1:

- persistent A/B **setups** survive reload, but raw trial traces are deliberately session-local;
- there is no timeline scrubber or replay;
- there is no automatic temporal event alignment between unequal trials;
- there is no scalar quality score, behavior ranking or autonomous policy extraction;
- the 7,200-frame bound prevents an accidental unbounded recorder.

Do not expand trace telemetry indiscriminately next.

The highest-value follow-up is to use this layer on genuinely dynamic Field Lab questions — formation recovery, doorway pressure, moving-player follow behavior, contact/blocking and cooperative situations — and see which temporal evidence repeatedly changes our understanding. New metrics or visualization should be earned by those experiments.

Status remains:

> **MACHINE-QUALIFIED ADVANCED FIELD LAB + TEMPORAL TRIAL EVIDENCE · NOT OWNER-READY · AUTONOMY NOT PROMOTED**

---

## 22. Doorway discovery campaign — formation geometry and recovery timing — 2026-09-25

Trial / Trace has now been used as a **discovery instrument**, not merely extended in advance.

Qualified source:

`d1664f1e996fd287d1d032d6b6fcff1faaa484e2`

Qualification:

`squad-field-lab-browser · run 36133404762 · SUCCESS`

Machine gate:

- 188/188 test files and 744/744 tests PASS;
- production build PASS;
- broad Squad Field Lab rehearsal PASS;
- persistent A/B + temporal trial rehearsal PASS;
- controlled doorway discovery campaign PASS;
- no browser page / console / request errors in the discovery result.

### Question

For one fixed four-member `DIAMOND` MOVE through the Field Lab doorway, is the material failure primarily changed by formation geometry/spacing or by movement responsiveness?

Controlled baseline:

- TRAINING / DOORWAY;
- four real squad bodies, all selected;
- DIAMOND;
- spacing `1.00`;
- responsiveness `0.82`;
- tolerance `0.18 m`;
- slowdown `0.72 m`;
- one fixed MOVE anchor;
- matched 150-tick trials.

Baseline C2 and C3 first contact and become BLOCKED at `t74`, remain blocked through `t150`, and finish with `5.24 m` target error.

### Discovery 1 — responsiveness changes exposure, not the geometric failure

`responsiveness 1.00` makes C2/C3 reach the obstruction earlier (`t61`) and remain blocked through the horizon. Their terminal target error remains `5.24 m`.

`responsiveness 0.27` produces zero blocked/contact ticks inside the 150-tick horizon, but this is **not improvement evidence**: C2/C3 simply have not reached the doorway and finish about `6.20 m` from target.

Therefore cumulative blocked/contact counts alone were a misleading metric for this question.

This evidence justified the new temporal provenance already added during the campaign:

- first + last blocked tick;
- first contact tick;
- blocked episode count;
- terminal status;
- terminal target error.

### Discovery 2 — formation width materially changes recovery

Holding the rest of the baseline fixed and changing only DIAMOND spacing produced:

| spacing | C2/C3 first blocked | C2/C3 last blocked | terminal state | terminal target error |
| ---: | ---: | ---: | --- | ---: |
| 1.00 baseline | 74 | 150 | BLOCKED | 5.24 m |
| 0.90 | 74 | 142 | MOVING | 4.38 m |
| 0.85 | 74 | 102 | MOVING | 2.68 m |
| 0.80 | 74 | 95 | MOVING | 2.25 m |
| 0.75 | 74 | 90 | MOVING | 1.98 m |
| 0.65 | 75 | 86 | MOVING | 1.57 m |
| 0.50 | 76 | 81 | MOVING | 1.11 m |

The important result is not a magic scalar threshold. The transition is steep and physical.

A geometry sanity check explains part of it: the doorway opening is `2.20 m`; with `0.30 m` body radius, the direct center-line half-clearance is `0.80 m`. DIAMOND side slots are `±1.05 × spacing`, so an ideal straight center-line fit would require approximately `spacing <= 0.762`.

Runtime recovery is not binary at that comparator because real bodies slide, contact and approach the opening dynamically. Do **not** promote `0.762` or any tested spacing into a general policy.

### Discovery 3 — timing/path history matters, not only final geometry

A and B were then captured as **identical spacing-1.00 setups**. Only B received an authored live intervention to compress to `0.80`.

Trial events now preserve that intervention with tick/category/scope/path/before/after provenance.

Results for C2/C3:

| authored compression | last blocked | terminal state | terminal target error |
| --- | ---: | --- | ---: |
| static 0.80 from start | 95 | MOVING | 2.25 m |
| 1.00 → 0.80 at t75 | 130 | MOVING | 3.72 / 3.71 m |
| 1.00 → 0.80 at t90 | 141 | MOVING | 4.17 m |
| 1.00 → 0.80 at t110 | 150 | BLOCKED | 4.72 m |

So the same final geometry has strongly different consequences depending on **when the squad begins adapting**.

Even intervention at `t75`, essentially at first obstruction exposure, recovers much later than starting compressed. That makes a purely reactive rule such as “wait until blocked, then shrink formation” a weak explanation of the successful authored pattern.

The stronger current hypothesis is:

> bottleneck traversal may require **approach shaping / anticipatory formation deformation**, not merely motor tuning or post-stall recovery.

This remains a hypothesis from one controlled doorway family, not a general formation law.

### Discovery 4 — topology matters, but COLUMN is not a winner

Changing DIAMOND to COLUMN materially redistributes contact/blocking:

- C3 avoids a BLOCKED episode in the horizon;
- C2's first block is delayed to `t134`;
- contact is redistributed onto other members;
- terminal target errors and progress trade off differently.

This is evidence that formation topology matters. It is **not** evidence that COLUMN should replace DIAMOND or that one preset is generally superior.

### Evidence-driven Trace evolution

The campaign forced only the instrumentation that was needed to interpret real results:

1. cumulative blocked/contact counts looked falsely favorable for a slow motor → add obstruction timing + terminal state;
2. recovery intervention changed the run after trial start → preserve authored intervention provenance;
3. recovery timing became the question → surface last-blocked timing already derivable from the trace.

No timeline scrubber, replay engine, scalar behavior score or autonomous selector was added.

### Candidate semantic pressure — not promoted behavior

A useful candidate for future experiments is:

**formation as a deformable relational envelope** — preserve formation intent, but allow temporary compression/re-shaping before constrained transit, with later recovery/re-expansion.

What is *not* established:

- how to detect a bottleneck;
- what should trigger deformation;
- what geometry is appropriate outside this doorway specimen;
- when/how to re-expand;
- whether the same pattern survives moving-player FOLLOW, pressure, different body counts or asymmetric obstacles;
- whether the Owner likes the resulting feel;
- any autonomous authority to perform it.

The next discovery should therefore test the **manual authored pattern itself** under changed conditions before turning it into autonomy.

Status:

> **DOORWAY DISCOVERY MACHINE PASS · GEOMETRY + TIMING ARE MATERIAL · GENERALIZATION UNPROVEN · NOT OWNER-READY · AUTONOMY NOT PROMOTED**

---

## 23. Post-recovery scope audit — 2026-09-25

Later Owner correction makes the evidence hierarchy explicit: product/experiential truth comes from Owner-observed behavior and later explicit Owner feedback, not from the quantity of green machine evidence. Existing machine-qualified Field Lab claims below therefore remain bounded diagnostic claims only.

The Owner-confirmed direction is still the broad Advanced Companion / Squad Field Lab described in sections 2–17. Current implementation has not yet reached that full expressive target.

### Current live scope

Machine-qualified runtime `6e8a8d4eea8e3122d83a739892536ceffe5ee4e7` currently provides:

- real 1–4 squad bodies;
- selection/focus/direct puppeteering;
- FOLLOW / HOLD / world-space MOVE;
- editable formation slots, spacing and orientation;
- three scoped movement-dynamics variables;
- several spatial layouts plus coarse cooperative pressure;
- persistent A/B setup capture/restore;
- Trial / Trace and authored intervention provenance;
- causal debug;
- an explicit paused **Setup placement** plane for authoring real player/squad starting positions.

The setup plane was added because it was already part of the campaign's intended authoring model but missing from the actual surface. Browser evidence verifies that dragging C2 in setup mode reconstructs the real World body at the authored start and that the position composes with the existing experiment workflow. Full run `36143274530` is green with 188/188 test files and 744/744 tests.

This is machine evidence for the authoring seam only.

### Scope gap

Despite the breadth above, the current surface remains predominantly a **movement / formation laboratory**. It does not yet justify the broader product-sounding interpretation “advanced behavior lab”.

In particular, the live vocabulary is still thin outside spatial motion:

- behavior/intent authoring beyond FOLLOW/HOLD/MOVE is largely absent;
- the existing dynamics controls are motor/slot controls, not a rich behavioral vocabulary;
- PRESSURE/REPEL remains apparatus-like compared with the desired continuous cooperative episode;
- several candidate behavior dimensions in section 8 are still only hypotheses;
- the Owner has not yet judged the current instrument as useful/fun/expressive enough for broad exploration.

Therefore current implementation status is:

> **MACHINE-QUALIFIED SQUAD MOVEMENT / FORMATION AUTHORING + EXPERIMENT SUBSTRATE · BROAD BEHAVIOR LAB INCOMPLETE · NOT OWNER-QUALIFIED · AUTONOMY NOT PROMOTED**

### Strategy after recovery

Do not deepen Trial/Trace, doorway compression or any candidate autonomous formation semantic by inertia.

Use the Field Lab as intended: let manual authorship expose the missing vocabulary.

The next high-information pressure is to try constructing a **manual multi-beat cooperative behavior** with the existing setup, squad, orders, direct control and experiment tooling. Observe where the Owner-authored sequence cannot be expressed cleanly. Those failures should determine whether the next addition is a new intent primitive, scenario affordance, behavior parameter, temporal authoring mechanism or something else.

Only repeated useful authored patterns become candidates for later autonomy. No new Owner gate is justified by this machine qualification.

---

## 24. Manual multi-beat authoring pressure — 2026-09-25

The first post-recovery use of the wider authoring substrate was deliberately manual. No autonomous behavior was added.

Qualified source:

`d5649b547ccd1fd5b1f3c87e0b95ea18d9d28fc1`

Qualification:

`squad-field-lab-browser #101 · run 36144788908 · SUCCESS`

The controlled B trial authored this sequence from an initial condition identical to A:

`setup C1 within material action range → HOLD during CALM → wait for APPROACHING → manual C1 REPEL → FOLLOW/regroup`.

Machine evidence established only the following narrow facts:

- setup placement can define the embodied initial condition;
- live HOLD/FOLLOW order transitions can be preserved in Trial provenance;
- a manual cooperative action attempt and its World outcome can be preserved in Trial provenance;
- the C1 REPEL materially produced the same episode's `REPELLED` outcome;
- the sequence can be reconstructed as an authored causal chain.

To make that evidence possible, Trial provenance was extended minimally where the use case exposed a real blind spot:

- `ORDERS` now records live assignment transitions including world-space MOVE;
- `ACTION` records manual REPEL attempt and resolved outcome.

This is instrumentation earned by the experiment, not a behavior-system promotion.

### More important negative result

The sequence itself is still behaviorally thin.

It requires the author to construct behavior mostly through spatial micromanagement plus the single coarse `REPEL` verb. Passing this specimen therefore does **not** mean the Field Lab has become the broad behavior laboratory described by Owner intent.

The current limiting question has shifted from:

> can the lab preserve an authored multi-beat sequence?

to:

> **does the World/situation expose enough qualitatively meaningful affordances that the Owner can discover rich companion behavior rather than merely choreograph movement around one action button?**

### Donor constraint

The repo contains the older shared-danger `INTERVENE` action seam. Do not promote it as the obvious next behavior verb.

That mechanism underpinned the public Owner FAIL where E could be internally valid only in a hidden WINDUP window and narrow range. Its attempt→World-outcome separation remains a useful donor. Its interaction semantics and participant affordance do not.

### Next strategic boundary

Do not implement another behavior verb merely to increase count.

Before the next material implementation, choose a **situation contract** that can naturally create several meaningful player/companion choices across preparation, contribution/takeover, changing conditions and recovery/regroup, without hidden timing-oracle play.

The next tranche should compare candidate situations by:

- player-visible teammate information gain;
- ability to author several distinct manual solutions;
- material World consequences;
- preservation of player agency;
- compatibility with current movement/formation/setup substrate;
- low scope relative to a broad combat framework.

That situation choice is now the highest-value unresolved strategic question. It is intentionally left open rather than filled by roadmap inertia.


