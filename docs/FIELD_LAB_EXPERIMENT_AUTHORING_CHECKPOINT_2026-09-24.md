# Advanced Field Lab Experiment Authoring Checkpoint — 2026-09-24

Status: **MACHINE-QUALIFIED EXPERIMENT-AUTHORING SUBSTRATE · FIELD LAB REMAINS THE ACTIVE RESEARCH OBJECT · NOT OWNER-READY**

Qualified code source:

`969a6bf90db67f6fedf48627fba092870b641fb5`

Qualification run:

`squad-field-lab-browser · run 36060223003 · SUCCESS`

Evidence:

- full repository gate: **187/187 test files · 741/741 tests · production build PASS**;
- broad Squad Field Lab rehearsal: PASS;
- persistent A/B experiment rehearsal: PASS;
- page errors: none;
- console errors: none;
- request failures: none.

## 1. Live-state correction before this tranche

The 2026-09-24 live repo contained an important provenance event that must remain explicit.

A short implementation sequence had added Field Lab A/B snapshot code from the wrong project context and was subsequently reverted by:

`3a17f13b9d4a8ab83f75d74ba21f8f4100696a61 · revert: remove Feniks out-of-scope Field Lab implementation`

Therefore the correct pre-tranche live truth was:

- the broad Field Lab runtime remained materially at the earlier machine-qualified substrate;
- the durable 2026-09-24 changes were documentation/Owner-intent reinforcement;
- no reverted Feniks implementation was silently recovered as canonical Companion work.

The implementation recorded here was rebuilt deliberately from the Companion Field Lab objective.

## 2. Why this tranche came before more parameters

Latest Owner intent strongly values Advanced Companion / Squad Field Lab as an instrument in its own right:

- broad manual manipulation;
- many meaningful behavioral/dynamic variables;
- free formation authoring;
- repeated experiments;
- later promotion of manually discovered patterns into real companion behavior.

The tempting next step was to add many more sliders.

That was rejected.

Without a durable experiment language, more variables would create high-dimensional but non-reproducible state. The first requirement was therefore:

> **make authored setups durable, restorable, comparable and attributable before expanding the parameter space aggressively.**

## 3. Persistent versioned experiment state

New domain:

`src/squad/field-lab-experiment.ts`

Schema:

`companion-field-lab-experiment-v1`

A captured setup contains:

- situation;
- physical layout;
- active squad roster;
- selection + focused member;
- direct-control authority state;
- formation orientation and all editable slots;
- per-member orders and world anchors;
- group dynamics;
- per-member dynamics overrides;
- real player + squad body positions;
- label;
- capture tick.

A/B slots persist in browser storage across reload.

Restore is validation-first and fails closed on structurally invalid state.

Invalid/stale persisted data is discarded rather than partially promoted.

## 4. Structural A/B comparison

A/B is not a visual memory aid.

The diff engine separates differences into:

- SITUATION;
- ROSTER;
- SELECTION;
- AUTHORITY;
- FORMATION;
- ORDERS;
- DYNAMICS;
- POSITIONS.

Detailed differences carry a stable path and A/B values.

Examples now include:

- `spacingScale`;
- `slots.squad-2`;
- `orders.squad-2.mode`;
- `memberDynamics.squad-2.responsiveness`;
- `memberDynamics.squad-2.slotTolerance`;
- `memberDynamics.squad-2.slowdownRadius`;
- `positions.squad-2`.

The left authoring dock gives a compact summary; focused debug exposes detailed structural diff.

## 5. Exact and scoped dynamics authoring

The previous dynamics surface was group-only and silently clamped authored values.

That was not strong enough for the latest Owner direction.

The qualified model now has:

### Formation-global

`spacingScale`

Supported range:

`0.25 .. 5.0`

### Group defaults + selected-member overrides

- `responsiveness` — supported `0.05 .. 1.0`;
- `slotTolerance` — supported `0.02 .. 1.5m`;
- `slowdownRadius` — supported `0.1 .. 5.0m`.

Every active companion can therefore inherit group defaults or hold explicit overrides.

The selected set can be authored as a scope, not only one focused member.

The UI exposes both:

- continuous slider manipulation;
- exact numeric entry.

Out-of-range values are **rejected explicitly**. The control layer no longer silently clamps an authored experiment to a different value.

This is intentional: supported limits may exist where the current runtime has a real semantic/physical boundary, but the experiment must not lie about the value that was actually admitted.

## 6. Hidden coupling removed from the formation motor

Previously:

`slowdownRadius = max(slotTolerance * 4, 0.6)`

This hid one behaviorally important variable inside another.

Slowdown radius is now independently authored.

For each companion the formation motor consumes:

- effective slot tolerance;
- effective responsiveness;
- effective slowdown radius;

where each effective value is:

`member override ?? group default`.

Direct puppeteering remains a distinct authority source and does not pretend to be governed by formation-drive dynamics.

## 7. Material browser evidence

The integrated experiment rehearsal establishes:

- Capture A persists across reload;
- labels persist;
- Capture B produces structural multi-axis diff;
- Restore A returns authored layout/control/body positions;
- Restore B returns a different authored layout/control/body position;
- clearing a slot persists across reload;
- exact numeric dynamics values are admitted;
- per-member overrides appear in experiment diff;
- the scoped responsiveness value changes real physical requested velocity.

The physical falsifier is important.

For focused C2 under a far MOVE responsibility:

- selected override `responsiveness = 0.27` materially constrains requested speed;
- clearing the override returns C2 to group default `0.82`;
- the inherited/default run produces a requested-speed magnitude more than 2.4× the scoped-override run.

Therefore the parameter is not decorative UI state.

## 8. Visual red-team

The experiment surface remains readable in the existing three-column structure:

`authoring controls | world | focused causal debug`

The new controls add density, but they do not cover the world.

The current useful hierarchy is visible:

- situation/layout;
- real squad roster + selection;
- orders;
- formation geometry;
- global spacing;
- movement-dynamics scope;
- exact group/member dynamics;
- persistent A/B setups;
- structural diff;
- focused causal truth.

This is still a technical research tool rather than polished game UI.

## 9. Claim budget

May claim:

- Field Lab now has a durable versioned experiment setup format;
- A/B setups survive browser reload;
- exact setups can be restored including physical positions;
- structural diffs expose multiple causal authoring axes;
- dynamics can be authored at group-default or selected-member scope;
- exact numeric authoring exists;
- slowdown distance is an independent real variable;
- scoped responsiveness has demonstrated physical effect;
- new dynamics state is captured/restored/diffed.

Must not claim:

- complete Advanced Field Lab;
- rich final behavior vocabulary;
- final parameter ranges;
- final formation adaptation;
- temporal experiment/outcome comparison;
- autonomous learning from Owner demonstrations;
- multi-companion intelligence;
- teammate feel;
- Owner PASS.

## 10. Next research frontier

Do **not** immediately answer this checkpoint with a wall of new sliders.

The largest missing research-instrument capability is now temporal evidence.

Setup A/B answers:

> what conditions did we author differently?

It does not yet answer rigorously:

> what happened differently over the run, when, to whom, and by how much?

Next high-value direction:

**Field Lab Trial / Trace layer**

A useful candidate should record and compare, with bounded cost:

- player + companion trajectories;
- formation/slot error over time;
- requested vs actual velocity;
- contact / blocked intervals;
- authority/order changes;
- experiment parameter changes during the trial;
- cooperative-pressure outcomes where present;
- per-member and group summary metrics;
- provenance back to the starting experiment setup.

This temporal layer should then determine which *additional* behavioral/dynamic variables are worth exposing.

The longer-term loop remains:

`author → capture setup → run → observe/trace → compare → perturb → repeat → identify recurring human solution → only then automate the earned pattern`.
