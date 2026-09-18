# Companion Brain Lab — Owner Sandbox Preparation Campaign

Status: **ACTIVE CAMPAIGN · OS-PREP**
Date: **2026-09-18**
Primary execution entrypoint: [CURRENT.md](CURRENT.md)

## 0. Why this campaign exists

Companion Brain Lab has accumulated unusually deep evidence about movement, relationship geometry, player-relative futures, physical safety, player-flow interference, semantic provenance, causal execution and limited direct actuation.

That accumulation creates a new risk:

> the project can become increasingly good at explaining candidate motion without proving that the resulting companion is actually good to play with.

The next major evidence source must therefore move closer to the product dream.

The target is not an A1 selector. The target is a companion that increasingly feels like a **competent partner present in the same causal situation as the player**: readable enough to coordinate with, autonomous enough to be useful, corrigible without micromanagement, physically grounded and able to maintain coherent behavior over time.

The Owner Sandbox is the first serious campaign designed to confront the research substrate with that standard.

However, the Owner's attention is scarce and uniquely valuable. A long Owner run should not be used to discover defects that Browser GPT, deterministic tests, real-browser automation or causal instrumentation could have found first.

**OS-PREP exists to make the Owner Sandbox worth doing.**

---

## 1. Current transition boundary

At the campaign start, the live branch is:

`experiment/a1-opportunity-persistence`

Planning checkpoint:

`dbe6a0e836531b6cc34812c5abd8f1b3bdbf267a`

That checkpoint is mechanically qualified by `validate` #1287 and the full browser audit.

The material change from earlier A1 work is P2:

`preview -> explicit exact proposal -> explicit arm -> one World step -> factual A0 outcome -> auto-disarm`

P2 is the first deliberately authoritative A1 seam, but it is intentionally **not an automatic policy**.

That makes it suitable as an experimental intervention:

> “What physically happens if this exact research candidate is given the body for one step?”

It does **not** answer:

> “When should the companion choose this behavior by itself?”

OS-PREP must preserve that distinction.

---

## 2. Campaign thesis

The campaign is organized around three evidence planes.

### A. Participant / product truth

What can be noticed without reading the debugger?

Examples:

- the companion gets out of the player's way;
- keeps a useful relation rather than orbiting a point;
- reacts coherently to stop/reversal;
- catches up without bulldozing the player;
- survives a chokepoint interaction without looking scripted;
- continues or revises an action in a way a human can read;
- does not oscillate between individually “correct” micro-decisions.

This plane ultimately requires Owner judgement for feel, trust, readability and value.

### B. Causal / research truth

Why did the behavior happen?

A useful trace should let us join, at the appropriate resolution:

`Owner evidence -> semantic/relationship evidence -> situation -> futures/frontier -> authorization/policy -> command -> World outcome -> next state`

Research instrumentation must remain observational unless an intervention is explicitly labeled as such.

### C. Mechanical / contract truth

Did the apparatus behave according to its contract?

Examples:

- stale P2 authorization rejected;
- proposal identity preserved;
- exactly one step received authority;
- A0 command matches the authorized command;
- capture/export does not mutate World;
- exact build/session identity is retained;
- browser/runtime remains stable.

A green plane C does not imply a good plane A.

---

## 3. Donor lessons from SPC and Feniks

### 3.1 SPC: participant-first, then microscope

SPC's recent work demonstrates a useful discipline:

- normal participant evidence and God/research evidence are different lenses;
- private/semantic knowledge must not be confused with World truth;
- observation must not change the observed world;
- exact causal lineage is more useful than a large undifferentiated event dump;
- controlled Twin-World / intervention comparisons can isolate whether a mechanism really mattered;
- long green test suites can coexist with poor experiential life if the tests do not exercise the product-level property.

For Companion this becomes:

> first decide what the movement looked/felt like; only then open the causal microscope.

Do not let labels such as `TANGENT`, `SINGLETON_H1_FRONTIER` or `LOW_IMPACT` pre-bias the interpretation of whether behavior looked intelligent.

### 3.2 Feniks: materiality before theatre

Feniks strengthens a complementary requirement:

- physical possibility and higher-level/social meaning are different layers;
- world-grounded constraints are preferable to arbitrary invisible bans;
- spatial relationships should be materially true rather than staged;
- actor interaction and movement should produce actual consequences.

For Companion this means a “yield”, “hold”, “pass” or “recovery” behavior only counts when the world/physics and causal history actually support it.

Do not script visually plausible cooperation over a substrate that would permit contradictory physical behavior.

### 3.3 Donor limit

Neither SPC nor Feniks is architectural authority for Companion.

Borrow methods and falsifiers first. Borrow implementation only after a Companion-local failure earns it.

---

## 4. Evidence ladder

Use the cheapest evidence that can answer the current question, but do not substitute lower layers for higher ones.

1. **Contract evidence** — deterministic/domain invariants.
2. **Real-runtime browser evidence** — actual built client, browser timing, presentation and input path where relevant.
3. **Controlled scenario evidence** — a bounded multi-beat situation designed to discriminate hypotheses.
4. **Metamorphic / Twin evidence** — mirrored, perturbed or intervention-vs-control runs.
5. **Participant-first interpretation** — behavior assessed before consulting debug explanation.
6. **Owner judgement** — feel, trust, readability, desirability, surprise and value.

Promotion toward automatic gameplay authority requires evidence from more than one lower-level contract.

---

## 5. Roadmap

The phases are ordered, but not mechanically linear. A later phase may expose a failure that sends work back to an earlier one.

### OS-PREP-0 — Live regrounding and authority freeze

**Status: PASS / CLOSED ENOUGH**

Purpose:

- recover the actual live branch and head;
- classify P2 correctly;
- verify full CI/browser qualification;
- prevent stale handoffs from defining current truth;
- establish that automatic A1 selection remains absent.

Exit evidence at campaign creation:

- exact head `dbe6a0e8...`;
- `validate` #1287 PASS;
- full `browser:audit` PASS;
- `a1-commitment-live` #12 PASS;
- P2 remains explicit, single-step and auto-disarming.

Re-open only if live state contradicts this boundary.

---

### OS-PREP-1 — Evidence integrity and Owner-session identity

**Status: PASS / CLOSED ENOUGH**

Qualified checkpoint: `944a6eb3d6e7ecd56171023e08894d0ea6fff2f8`, Validate #1304 / run `35349533204`, including artifact-level inspection of the downloaded incident.

Purpose:

Make every future interesting Owner moment recoverable and attributable to the exact runtime that produced it.

Required properties:

- incident/session capture includes exact build identity;
- capture records enough active-mode identity to reconstruct the intervention surface;
- P2 preview / arm / application / outcome identity is retained when relevant;
- P2 absence is distinguishable from “capture forgot to record P2”;
- capture remains observational and does not change canonical World behavior;
- stale or mismatched evidence fails closed;
- a captured session cannot silently be confused with the old Foundation Pages runtime.

Candidate implementation pressure:

- evolve the current incident export rather than inventing a parallel telemetry system;
- prefer a compact schema extension over a giant always-on log;
- capture the causal window needed to explain a bookmarked moment;
- include exact source/build identity through a build-time constant or equally trustworthy seam;
- preserve backwards/historical incident data only where cheap; R&D save/schema compatibility is not a priority.

Exit gate:

> Given one captured Owner moment involving P2 or baseline behavior, Browser GPT can identify the exact build and reconstruct the relevant input → decision/intervention → command → factual outcome path without guessing.

---

### OS-PREP-2 — Claim → observable phenomenon map

**Status: ACTIVE**

Canonical working map:

- [OS_PREP_2_PHENOMENON_MAP.md](OS_PREP_2_PHENOMENON_MAP.md)

Purpose:

Convert weeks of internal mechanism work into a finite set of player-observable questions.

Each phenomenon dossier must contain:

- **product question** — what teammate property is being tested?
- **blind observable** — what could a participant notice without debug?
- **rival explanations** — what simpler mechanism or accident could create the same appearance?
- **falsifier** — what behavior would show the mechanism/policy is wrong or unnecessary?
- **minimum scenario** — the smallest real-world setup that exposes it;
- **required evidence** — only the causal data needed to explain the result;
- **claim limit** — what the experiment explicitly does not prove.

Initial phenomenon families:

#### Relationship coherence

- useful relative position without treating external body motion as Owner meaning;
- persistence through short ambiguity;
- revision under fresh contradictory Owner input;
- expiry/staleness without confident obsolete behavior.

#### Player-flow cooperation

- head-on conflict;
- crossing paths;
- stopping into a previously predicted conflict;
- sudden reversal;
- yielding space without paternalistically locking the player.

#### Pace and separation

- falling behind;
- catching up;
- preserving useful spacing;
- avoiding oscillatory speed corrections;
- not treating maximum capability as desired pace.

#### Chokepoints / constrained space

- doorway/passage negotiation;
- egress from contact/overlap;
- obstruction vs intentional close cooperation;
- recovery after a blocked relation becomes possible again.

#### Temporal coherence

- several beats that read as one continuing action;
- interruption;
- revision;
- release;
- resumption only when the underlying relationship objective still makes sense.

#### Failure/pathology

- jitter/thrashing;
- stale semantic frame;
- repeated one-step “good decisions” that form bad behavior;
- side-bias or mirror asymmetry;
- companion stealing agency;
- behavior that is only intelligible with debug visible.

Exit gate:

> Every major mechanism we intend to expose to the Owner is tied to a human-observable question and a falsifier, not merely an internal metric.

---

### OS-PREP-3 — Automated multi-beat pre-Owner campaign

**Status: PLANNED**

Purpose:

Make Browser GPT and automation hit the obvious and non-obvious failures before using Owner attention.

The campaign should use the existing real World/browser path and current scenarios first. New fixtures are justified only when an important phenomenon cannot be expressed honestly in the current set.

Core story shapes:

- **open movement:** establish baseline relation and pace without obstacle pressure;
- **head-on:** approach → conflict pressure → stop → reverse → release;
- **doorway:** constrained crossing → obstruction/clearance → reversal or second attempt;
- **pillar:** route/relationship interaction around static geometry;
- **semantic disturbance:** fresh Owner command vs body/solver motion;
- **P2 intervention A/B:** same bounded situation with no P2 authority vs one explicit P2 step;
- **longer free run:** look for oscillation, drift, stale meaning, sticky recovery or hidden repeated authority.

Required experiment styles:

- exact replay where possible;
- mirrored scenarios where symmetry should hold;
- bounded perturbations around decision boundaries;
- Twin/control-vs-intervention comparisons;
- first-divergence localization when outcomes separate;
- long-window observation when a multi-beat claim is being made.

Do not produce a Cartesian product of every switch. Select experiments for information gain against the current hypothesis.

Exit gate:

> No known high-value teammate phenomenon is being handed to the Owner before a credible agent-side attempt to falsify it.

---

### OS-PREP-4 — Participant-first dry run

**Status: PLANNED**

Purpose:

Attack confirmation bias caused by the research debugger.

Protocol:

1. run/record the behavior without consulting explanatory labels during interpretation;
2. write a short behavioral read: what appeared to happen and what intent/continuity a participant might infer;
3. only then inspect causal/P2 evidence;
4. compare visible interpretation with actual cause;
5. flag cases where behavior only appears intelligent because the debugger explains it.

This is not a substitute for Owner judgement. Browser GPT is not the Owner and should not claim human feel from this gate.

Exit gate:

> The candidate can be interpreted at the behavioral surface without requiring the observer to read internal research vocabulary.

---

### OS-PREP-5 — Owner Sandbox candidate package

**Status: PLANNED**

Purpose:

Produce one exact, low-friction Owner entrypoint.

Required package:

- exact immutable candidate identity;
- exact deployment/artifact identity tied to that candidate;
- simple launch path;
- no terminal work required from the Owner;
- compact in-game controls;
- ordinary play surface separated from research explanation;
- one-action incident/bookmark capture;
- P2 intervention controls exposed only when intentionally entering the research phase;
- recovery/fault surface that does not silently destroy the session evidence.

The old public Foundation preview is **not** the candidate merely because it is convenient.

Exit gate:

> The Owner can enter the exact intended build, move/play immediately, bookmark a moment and leave the technical evidence collection to the agent.

---

### OS-PREP-6 — Owner Sandbox campaign

**Status: HUMAN EDGE / FUTURE**

The Owner run should have layers rather than one giant scripted checklist.

#### A. Free encounter

Minimal instruction. Let the Owner move naturally and form first impressions.

Goal:

- discover behavior we failed to think to test;
- measure whether the companion demands attention or earns trust;
- capture surprise before explanation.

#### B. Directed provocations

Short situations chosen from OS-PREP-2:

- head-on/crossing;
- stop/reversal;
- chokepoint;
- separation/catch-up;
- repeated ambiguity/release.

Goal:

- obtain Owner judgement on specific teammate properties.

#### C. P2 controlled interventions

Only after baseline impressions.

Use P2 to test exact hypotheses:

- same/similar situation;
- preview while paused;
- explicit one-step intervention;
- observe whether the change is actually desirable;
- never present a successful P2 move as proof of an automatic policy.

#### D. Debrief before deep forensics

Capture the Owner's interpretation first.

Only afterwards expose the causal explanation.

This protects the most valuable evidence: what the companion actually communicated through behavior.

---

### OS-PREP-7 — Forensic reconciliation and next architecture

**Status: FUTURE**

For each material Owner moment:

1. preserve the Owner's original interpretation;
2. locate exact build/session/tick;
3. recover the relevant causal slice;
4. classify the failure/gain by layer;
5. test rival explanations;
6. decide whether to keep, tune, redesign, demote or delete the implicated mechanism.

Useful layer classification:

- World/physics truth;
- player-control/semantic evidence;
- relationship objective;
- future/decision evidence;
- cooperation policy;
- temporal commitment;
- movement realization;
- route/recovery;
- presentation/readability;
- research apparatus.

Do not “fix the behavior” before identifying which layer actually caused it.

Exit result may legitimately be:

- promotion candidate;
- more research needed;
- mechanism unnecessary;
- architecture wrong;
- behavior technically correct but undesirable;
- Owner likes an emergent behavior we did not design.

All are valid evidence.

---

## 6. Automatic-authority promotion rule

An internal frontier becoming clean, singleton or numerically dominant is **not** sufficient.

Before automatic authority is reconsidered, evidence should show repeatedly that:

- the behavior is wanted at the participant surface;
- its causal reason is understandable;
- it remains coherent across several beats;
- it preserves Owner agency;
- interruption/revision works;
- similar behavior survives relevant scenario/mirror variation;
- a simpler rival mechanism does not explain the gain;
- failures are bounded and diagnosable;
- the Owner has actually judged the relevant experiential property when human judgement is required.

P2 may help produce this evidence. P2 must not bootstrap itself into automatic authority.

---

## 7. Continuation routing

When a local result lands, do not ask “what can we build next?”

Ask:

> What uncertainty most threatens a valuable Owner Sandbox result?

Default routing:

`live truth -> active OS-PREP phase -> highest-risk open claim -> smallest discriminating experiment -> evidence -> continuation check`

Within a phase, choose by roughly:

`Owner-sandbox relevance × risk × expected information gain × reversibility / cost`

This is a heuristic, not a score to optimize mechanically.

### If a local test passes

Re-ground on the campaign. Do not stop merely because the unit of work passed.

### If a local test fails

Classify whether the failure is:

- product/mechanism evidence;
- test/oracle defect;
- instrumentation interference;
- stale state;
- browser/presentation timing;
- provider/tool/accessor artifact.

Do not patch until that classification is credible.

### If new interesting research appears

Keep it as a seed unless it materially affects the active Owner Sandbox question.

The project has no obligation to exploit every available apparatus.

---

## 8. Documentation authority

For the active campaign, use this precedence:

1. current Owner intent;
2. live repository/runtime evidence;
3. [CURRENT.md](CURRENT.md);
4. this campaign document;
5. current narrow evidence/qualification artifacts;
6. historical A1/CCC/Foundation plans;
7. sibling-project ideas and generic AI/game-AI literature.

A historical document is evidence about why a mechanism exists. It is not current authority merely because it is detailed.

Update `CURRENT.md` when:

- active phase changes;
- authority boundary changes;
- canonical branch changes;
- a new human judgement gate becomes the real next step;
- a major falsification changes the campaign thesis.

Update this campaign document only when the roadmap/model itself changes.

Do not append a diary entry after every commit.

---

## 9. Near-term technical design pressure

OS-PREP-1 should prefer extending the existing causal incident path.

Current incident export already carries recent causal frames and semantic transitions, but it predates P2.

The next bounded design should make one exported evidence object sufficient to answer:

- which exact build produced this?
- which scenario/modes were active?
- what was the Owner doing?
- was P2 available?
- was there a P2 preview?
- was a proposal armed?
- was a P2 command applied?
- which proposal?
- which source/outcome tick?
- did A0 confirm the command?
- what happened immediately before and after?

This is intentionally **not** a request for an omniscient giant session recorder.

Prefer:

- bounded recent causal window;
- explicit build/session header;
- exact intervention records;
- a bookmark/incident action;
- structured schema tests;
- browser non-interference evidence.

Only add continuous recording later if an actual Owner-forensics failure proves that bounded incidents are insufficient.

---

## 10. Longer dream direction — orientation, not current scope

If this campaign shows that the local movement/cooperation substrate is worth keeping, the next game-facing research can progressively widen toward the original dream:

- richer commands as intent/constraints rather than remote motor control;
- pre-combat readiness and positioning;
- combat cooperation;
- autonomy vs obedience;
- short-lived action/commitment continuity;
- one companion → a few companions;
- local live brain + slower higher cognition;
- character/history/social meaning layered over competent embodiment;
- selective donor flow toward/from SPC and Feniks.

These are **directional pressure**, not acceptance criteria for OS-PREP.

The current campaign succeeds by creating trustworthy evidence about the first embodied teammate layer.

---

## 11. Campaign success criterion

OS-PREP is ready to hand off to the Owner when:

> the Owner can open one exact candidate build, play immediately, experience the companion without needing research vocabulary, bookmark meaningful moments, and trust that Browser GPT can later reconstruct what actually happened — while every automatic authority claim remains no broader than the evidence supports.

The desired outcome is not “Owner approves the system”.

The desired outcome is **high-bandwidth, trustworthy evidence from real interaction with the companion we have actually built**.
