# Retrospective T6 — Research Apparatus Cost and Roadmap Inertia Audit

Status: **ACTIVE COST AUDIT · PRESERVE EVIDENCE, DO NOT CLEAN UP YET**
Date: **2026-09-20**

Parent review:

- [PRE_OWNER_SANDBOX_RETROSPECTIVE_CAMPAIGN.md](PRE_OWNER_SANDBOX_RETROSPECTIVE_CAMPAIGN.md)
- [RETROSPECTIVE_T1_T2_TRUE_RUNTIME_ANATOMY.md](RETROSPECTIVE_T1_T2_TRUE_RUNTIME_ANATOMY.md)
- [RETROSPECTIVE_T3_EVIDENCE_CLAIM_LEDGER.md](RETROSPECTIVE_T3_EVIDENCE_CLAIM_LEDGER.md)
- [RETROSPECTIVE_T4_T5_MECHANISM_AND_MISSING_BRAIN_AUDIT.md](RETROSPECTIVE_T4_T5_MECHANISM_AND_MISSING_BRAIN_AUDIT.md)

Purpose:

> measure whether the accumulated research substrate is beginning to impose enough iteration, navigation and conceptual cost that it can distort future product decisions.

This is not authorization to delete branches, tests, docs or A1 research.

---

## 1. Repository-scale snapshot

At the current review boundary:

- total branches: **105**;
- `experiment/*` branches: **72**;
- `planning/*` branches: **14**;
- open pull requests returned by repository search: **43**;
- docs: **68 files / ~847 KB**;
- scripts: **30 files / ~402 KB**;
- `src/coordination`: **184 files / ~1.67 MB**;
- A1 subset: **152 files / ~1.46 MB / 102 test files**.

Many open PRs are a serial A1.2 research lineage rather than pending product integration.

Examples span:

- A1.2a moving-frame rollout;
- candidate families;
- future hypotheses;
- G0–G4;
- same-physics rehearsal;
- player-agency evidence;
- concrete commands;
- robustness profiles;
- q/PACE/G4;
- structured frontiers;
- Z/Z1/Z3/Z4 research.

These PRs are valuable provenance.

They are **not current roadmap items**.

---

## 2. Default validation cost

Current `.github/workflows/validate.yml`:

- ~248 lines;
- ~41 run/use/name step entries;
- **19 artifact uploads**;
- at least **11 explicit browser-audit invocations** outside unit/build work.

Qualified run #1349:

- start: 21:55:16Z;
- finish: 22:23:20Z;
- elapsed: ~**28 min 4 s**.

Inside that run:

- dependency install: ~23 s;
- `npm run check`: ~27 s;
- aggregate `browser:audit`: ~81 s.

Therefore the majority of qualification wall time is not the core compile/unit/build gate.

It is the accumulated historical browser-evidence tail.

---

## 3. Expensive inherited specimens

Examples from #1349:

- PH-07 pillar mirror: ~**4 min**;
- PH-05 doorway settle: ~**3 min 16 s**;
- PH-05 doorway reversal: ~**2 min 27 s**;
- PH-04 head-on: ~**1 min 14 s**;
- PH-04 cross-front: ~**1 min 14 s**;
- PH-01 base: ~**1 min 32 s**;
- PH-01 mirror: ~**1 min 30 s**;
- PH-03 slow walk: ~**2 min 4 s**;
- PH-03 sustained: ~**3 min**;
- post-expiry disturbance: ~**2 min 26 s**;
- post-expiry Twin: ~**1 min 53 s**.

These are individually legitimate evidence specimens.

The problem is composition.

A change to a presentation-only Owner panel can inherit essentially the entire movement-research campaign because the branch qualifies under `experiment/**`.

---

## 4. Why this matters scientifically

Long qualification time is not merely CI inconvenience.

It changes research behavior.

### It raises the cost of small falsifiers

A 20-line experiment or UI change can require a ~30-minute campaign before its own result is considered qualified.

That encourages:

- batching unrelated changes;
- avoiding cheap exploration;
- waiting on irrelevant evidence;
- creating more branches to preserve checkpoints.

### It biases toward protecting old mechanisms

When many historical specimens are attached to every change, touching old code acquires a large regression tax.

That can quietly convert:

> “historical mechanism worth preserving as evidence”

into:

> “mechanism too expensive to replace.”

### It makes evidence volume look like architecture authority

The more tests surround A1/S3/R1, the psychologically harder it becomes to remove or radically replace them, even if the next product problem wants a different design.

This is a form of **test-induced architecture inertia**.

### It increases Owner/agent navigation burden

When continuation requires reconstructing:

- which branch is live;
- which SHA is runtime vs evidence-only;
- which of 43 PRs matters;
- which of 68 docs is authority;
- which historical PASS was superseded;

a substantial amount of cognition is spent on provenance before product work begins.

Provenance is valuable.

The current shape may be overpaying for it.

---

## 5. Main/default branch split

Current `main` remains materially older than the active research lineage.

This was partly intentional:

- public Pages operational authority lived on main;
- experimental runtime SHAs were pinned explicitly;
- research branches stayed isolated.

That is defensible.

But it creates two costs:

1. repository default view does not represent current project truth;
2. generic code/document search can surface stale authority first.

The current retrospective itself had to repair `CURRENT.md` only on a review branch because default main is historical.

This should later be resolved deliberately.

Do not merge everything to main reflexively.

---

## 6. Documentation authority debt

The documentation corpus has strong qualities:

- precise provenance;
- preserved failures;
- claim boundaries;
- historical replans.

But many files were canonical **at different times**.

The project therefore contains multiple documents that each sound authoritative in isolation.

Without a reliable current entrypoint, this produces:

> documentation that preserves truth locally but obscures truth globally.

The new review `CURRENT.md` override is a temporary repair.

Future repository structure should make these categories explicit:

- current execution authority;
- stable durable contracts;
- active experiment;
- historical evidence;
- superseded plans;
- archived campaign detail.

No cleanup yet.

---

## 7. Branch and PR debt

105 branches and 43 open PRs are not inherently harmful to Git.

The harm is semantic.

A future agent can easily misread:

- an old open A1.2 PR as pending integration;
- a planning branch as active roadmap;
- a historical experiment as current authority;
- a draft PR chain as unfinished mandatory work.

The project has already required repeated explicit warnings:

> old A1 branches/PRs are provenance, not roadmap.

When the same warning must be carried manually through every handoff, repository structure is no longer doing enough work.

---

## 8. Apparatus assets worth protecting

Do not respond by flattening the lab.

High-value durable research infrastructure includes:

- deterministic World/Rapier tests;
- causal frame/incident capture;
- build/source provenance;
- browser runtime smoke;
- participant/research split;
- Twin non-interference;
- same-physics query/rehearsal ability;
- exact failure specimens that represent real historical Owner failures;
- a small number of discriminating metamorphic tests such as PH-07.

These capabilities are part of the project’s comparative advantage.

---

## 9. Evidence likely suitable for slower / explicit campaigns later

Candidate classes that do not obviously need to run on every ordinary code push:

- long PH participant/research campaigns;
- historical A1 stage-attribution browser artifacts;
- expensive multi-minute Twin recordings;
- evidence that protects a superseded research hypothesis rather than current runtime authority;
- full artifact publication for every historical specimen.

Possible future qualification layers — **not yet implementation instructions**:

### Fast gate

For most development:

- TypeScript;
- unit/contract tests;
- build;
- short browser runtime smoke;
- tests directly covering changed live authority.

### Live-runtime gate

For a candidate that changes behavior:

- core Foundation survival;
- selected movement regressions;
- exact scenarios relevant to the changed layer;
- provenance/incident.

### Research campaign gate

Explicit/manual/periodic:

- full PH suite;
- expensive Twin/metamorphic campaigns;
- historical A1 evidence reproduction.

The correct split must be designed after the retrospective decides future architecture.

---

## 10. A1 preservation question

The right question is not:

> “should we delete A1 because it is big?”

No.

The useful question is:

> “which A1 capabilities have become general research instruments, and which exist only because a now-paused decision hypothesis once needed them?”

Potential durable A1 donors:

- aligned situation/provenance;
- clone/query World;
- concrete command identity;
- player-agency trajectory;
- hard-safety rehearsal;
- first-divergence tooling;
- observer non-interference;
- bounded intervention.

Potential historical/specialized material requiring justification before future maintenance:

- layers whose only purpose is one old frontier composition;
- horizon-specific contradiction atlases;
- old selector geometry that never earned authority;
- repeated evidence structures answering superseded A1.2 subquestions.

Do not classify/delete them from file names alone.

A future bounded technical-debt campaign should trace actual dependency and current research value first.

---

## 11. CI result #1358 under the retrospective freeze

The provisional OS-PREP-5 candidate’s long inherited validation may finish successfully.

Its result remains useful evidence:

> packaging changes did not regress the old exercised movement/research surface.

It does **not** answer:

- whether the current organism is the right next product stimulus;
- whether movement research should continue;
- whether A1 should be promoted;
- whether `/owner/` should be deployed.

The freeze remains independent of CI outcome.

---

## 12. T6 conclusion

The research apparatus has crossed a threshold where it is itself a project-design variable.

Current evidence suggests:

> **the lab is now expensive enough to preserve that preservation cost can bias what we choose to change next.**

That is dangerous because the Companion project was explicitly founded to keep experimental freedom.

The future architecture should inherit **earned invariants and research capabilities**, not the obligation to replay every historical experiment on every change.

This does not yet authorize cleanup.

T7 must first decide the next product question. Only then can we know which history is essential to that path and which can be moved out of the hot loop.
