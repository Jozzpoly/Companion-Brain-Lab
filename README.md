# Companion Brain Lab

Experimental sibling laboratory to [`Jozzpoly/Llm-Live-NPC`](https://github.com/Jozzpoly/Llm-Live-NPC), focused on **player-companion intelligence, local live cognition, tactical cooperation, command interpretation, and embodied teamwork**.

## Core research question

> Can one or a few companion NPCs become genuinely useful, readable, autonomous partners who react continuously to the world and the player, cooperate without constant micromanagement, and interpret player commands as intent rather than as rigid puppeteering?

Fast local intelligence is the primary experimental substrate. LLM or other higher cognition may later complement it, but is not assumed to be the per-frame controller or architectural center.

## Relationship to LLM Live NPC

This is a **sibling research repository**, not a fork, feature branch, downstream product, or replacement for LLM Live NPC.

The laboratories may exchange proven donors and research findings, but neither repository is automatically authoritative over the other. Shared infrastructure should emerge only when repeated evidence shows that the same abstraction is genuinely useful in both projects.

Useful shared principles include:

- the world owns physical truth and factual outcomes;
- intention, execution and outcome are distinct;
- routine embodied behavior must not depend on per-frame LLM calls;
- debugging should expose observable inputs, decisions, authority and causal outcomes without requiring hidden chain-of-thought;
- donor reuse is selective and provenance-aware rather than wholesale architecture inheritance.

These are research constraints, not a final AI architecture.

## Live project state

**Foundation hardening / pre-rework cleanup is active. The project is not yet declared redesign-ready.**

The previous R1-4 line achieved strong automated mechanical evidence, then failed the Owner browser gate by reproducing a whole-workbench freeze during an ordinary constrained-world interaction. That failure is preserved as evidence rather than hidden behind the prior green suite.

The current `foundation/runtime-survival-cleanup` campaign is removing failure semantics that would make a large redesign unsafe or difficult to diagnose. Current foundation work includes:

- ordinary local candidate exhaustion represented as `NO_SAFE_VELOCITY` rather than an exception;
- hard static penetration represented as an explicit `HARD_EGRESS` safety regime when escape exists;
- legacy relationship-slot exhaustion represented as `NO_VALID_RELATIONAL_SLOT` / hold-and-reconsider;
- shared static circle/body point-validity semantics across relationship and routing;
- egress semantics propagated coherently through route → local spatial selection → NATURAL final command → World;
- post-World progress/recovery kept distinct from pre-step decision authority;
- an independent runtime fault sentinel intended to fail-stop catastrophic faults while preserving visible evidence;
- explicit active-authority mapping so historical experiments do not silently become current architecture;
- dedicated multi-tick survival regressions for the freeze-class interaction.

The current goal is deliberately **not** another feature milestone. The gate is to reach a clean substrate where the next aggressive redesign can change relationship reasoning, pace/catch-up, player cooperation and movement contracts without inheriting known hidden crash semantics or contradictory authority.

### Public preview

Public Pages: https://jozzpoly.github.io/Companion-Brain-Lab/

**Important:** the public preview is still pinned by `main` to the previous audited R1-4 runtime. It is historical Owner evidence and is **not yet the current foundation-hardening branch**. Foundation work will be published only after an exact source SHA passes the mechanical/readiness gate.

## Current authority / readiness documents

- [`docs/FOUNDATION_RUNTIME_SURVIVAL_AUDIT.md`](docs/FOUNDATION_RUNTIME_SURVIVAL_AUDIT.md) — live foundation blockers, survival contract, throw classification and readiness exit criteria;
- [`docs/FOUNDATION_ACTIVE_AUTHORITY_MAP.md`](docs/FOUNDATION_ACTIVE_AUTHORITY_MAP.md) — current runtime authority at module/symbol level versus preserved historical baselines;
- [`docs/R1_AUDIT_LEDGER.md`](docs/R1_AUDIT_LEDGER.md) — R1 evidence history and qualification boundaries;
- [`docs/R1_4_PROGRESS_RECOVERY_QUALIFICATION.md`](docs/R1_4_PROGRESS_RECOVERY_QUALIFICATION.md) — preserved mechanical R1-4 evidence; it does not override the later Owner failure;
- [`docs/R1_CAUSAL_WORKBENCH_V2_SPEC.md`](docs/R1_CAUSAL_WORKBENCH_V2_SPEC.md) — causal workbench/evidence model;
- [`docs/INITIAL_RESEARCH_SKELETON.md`](docs/INITIAL_RESEARCH_SKELETON.md) — original Owner intent and broad research framing;
- [`docs/SIBLING_DONOR_AUDIT.md`](docs/SIBLING_DONOR_AUDIT.md) and [`docs/CROSS_REPO_COLLABORATION.md`](docs/CROSS_REPO_COLLABORATION.md) — sibling donor boundaries and provenance rules.

Older S0–S5 plans, qualification files, scenes and tests remain deliberately preserved as research history/donor evidence. Their presence does not make their old top-level architecture current runtime authority.

## What is intentionally deferred until the foundation gate closes

Important product limitations are **not** being disguised as cleanup work. The next aggressive redesign is expected to reconsider or replace, among other things:

- the legacy eight-slot relationship objective model;
- player movement corridor / right-of-way / chokepoint cooperation;
- pace, urgency and catch-up speed authority;
- the current `MotionIntent` contract;
- later command hierarchy, combat and multi-companion coordination;
- any promotion of older S5 relationship-field research.

The foundation campaign is complete only when ordinary constrained-world states cannot terminate the active runtime, fault evidence survives catastrophic failure, current authority is explicit, the broad automated campaign is green, and a new Owner torture gate produces no unexplained whole-runtime shutdown.
