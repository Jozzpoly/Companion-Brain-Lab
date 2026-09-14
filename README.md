# Companion Brain Lab

Experimental sibling laboratory to [`Jozzpoly/Llm-Live-NPC`](https://github.com/Jozzpoly/Llm-Live-NPC), focused on **player-companion intelligence, local live cognition, tactical cooperation, command interpretation, and embodied teamwork**.

## Core research question

> Can one or a few companion NPCs become genuinely useful, readable, autonomous partners who react continuously to the world and the player, cooperate without constant micromanagement, and interpret player commands as intent rather than as rigid puppeteering?

The laboratory treats fast local intelligence as a first-class research subject. LLM or other higher cognition may later complement that local brain, but is **not** assumed to be the per-frame controller or the architectural center of the project.

## Relationship to LLM Live NPC

This is a **sibling research repository**, not a fork, feature branch, downstream product, or replacement for LLM Live NPC.

The two laboratories may exchange proven donors and research findings, but neither repository is automatically authoritative over the other. Shared infrastructure or a common runtime should emerge only when repeated evidence shows that the same abstraction is genuinely useful in both projects.

Useful shared principles currently include:

- the World owns physical truth and factual outcomes;
- perception and knowledge remain situated rather than accidentally omniscient;
- intention, execution and outcome are distinct;
- routine embodied behavior does not depend on per-frame LLM calls;
- debugging exposes public causal state and factual outcomes rather than hidden chain-of-thought;
- donor reuse is selective, evidence-led and provenance-aware.

These are research constraints, not a frozen final architecture.

## Current live research state

**R1-4 movement robustness / progress-recovery — AUDITED MECHANICAL PASS · OWNER BROWSER GATE OPEN.**

Public pinned Owner preview:

https://jozzpoly.github.io/Companion-Brain-Lab/

Exact audited application runtime:

`8f08761cdfde3f0b5d3e595f4bb844d106104ed4`

Final audited runtime evidence:

- 21/21 test files PASS;
- 108/108 tests PASS;
- strict TypeScript PASS;
- production Vite build PASS;
- npm install audit: 0 vulnerabilities;
- pinned Pages build and deploy PASS.

The current stack now includes:

- the S0 World/physics research apparatus;
- relationship-position intent separated from World authority;
- whole-body static traversal and deterministic static routing;
- omnidirectional local spatial locomotion;
- NATURAL temporal motion realization;
- explicit separation of hard physical feasibility from desired/comfort clearance;
- final hard-static command validation after temporal actuation;
- post-World temporal progress/recovery classification and bounded local retry authority;
- a phase-coherent R1 causal workbench with textual inspection outside the playfield.

R1-4 was reopened after its first 104-test qualification. A post-qualification claim-vs-code audit produced new red regressions for recovery re-arming, repeated moving-target reversals and route-authoritative arrival semantics before the audited 108-test runtime was promoted. The old green result remains valid for its original coverage; it was not broad enough to justify the earlier claim by itself.

## Important current boundaries

The project does **not** yet claim:

- final companion movement feel;
- explicit player right-of-way / yielding competence;
- final relationship-position representation;
- combat behavior;
- command semantics;
- multiple-companion cooperation;
- LLM cognition;
- production navigation/character-controller architecture.

The S5 continuous relationship field remains useful **shadow research only**. Its route-aware coherent-region field is preserved, but it must not receive movement authority until R1 robustness is completed and Owner-qualified.

The immediate evidence boundary is the R1-4 Owner browser gate. R1-5 player-conflict/right-of-way work may be planned and falsified in isolation, but should not receive behavior authority before that gate is understood.

## Current research material

- [`docs/INITIAL_RESEARCH_SKELETON.md`](docs/INITIAL_RESEARCH_SKELETON.md) — project intent, research axes, evidence model and provisional long-horizon investigation order;
- [`docs/R1_MOVEMENT_ROBUSTNESS_CAUSAL_WORKBENCH_PLAN.md`](docs/R1_MOVEMENT_ROBUSTNESS_CAUSAL_WORKBENCH_PLAN.md) — canonical robustness campaign and invariants;
- [`docs/R1_AUDIT_LEDGER.md`](docs/R1_AUDIT_LEDGER.md) — live evidence / hypothesis / debt ledger;
- [`docs/R1_4_PROGRESS_RECOVERY_QUALIFICATION.md`](docs/R1_4_PROGRESS_RECOVERY_QUALIFICATION.md) — audited R1-4 qualification and falsification history;
- [`docs/R1_4_BROWSER_GATE_CHECKLIST.md`](docs/R1_4_BROWSER_GATE_CHECKLIST.md) — current Owner browser gate;
- [`docs/SIBLING_DONOR_AUDIT.md`](docs/SIBLING_DONOR_AUDIT.md) and [`docs/CROSS_REPO_COLLABORATION.md`](docs/CROSS_REPO_COLLABORATION.md) — sibling donor boundaries and reuse discipline.

Historical qualification documents remain research evidence. They should not be mistaken for the current live state merely because an earlier stage passed its bounded gate.
