# Companion Brain Lab

Experimental sibling laboratory to [`Jozzpoly/Llm-Live-NPC`](https://github.com/Jozzpoly/Llm-Live-NPC), focused on **player-companion intelligence, local live cognition, tactical cooperation, command interpretation, and embodied teamwork**.

## Core research question

> Can one or a few companion NPCs become genuinely useful, readable, autonomous partners who react continuously to the world and the player, cooperate without constant micromanagement, and interpret player commands as intent rather than as rigid puppeteering?

The laboratory begins from the premise that fast local intelligence matters. LLM or other higher cognition may later complement that local brain, but is **not** assumed to be the per-frame controller or the architectural center of the project.

## Relationship to LLM Live NPC

This is a **sibling research repository**, not a fork, feature branch, downstream product, or replacement for LLM Live NPC.

The two laboratories may exchange proven donors and research findings, but neither repository is automatically authoritative over the other. Shared infrastructure or a common runtime should emerge only when repeated evidence shows that the same abstraction is genuinely useful in both projects.

Useful current shared principles include:

- the world owns physical truth and factual outcomes;
- perception and knowledge remain situated rather than omniscient;
- intention, execution, and outcome are distinct;
- routine embodied behavior must not depend on per-frame LLM calls;
- debugging should expose the agent's observable state, inputs, decisions, and causal outcomes without requiring hidden chain-of-thought;
- donor reuse is selective and provenance-aware rather than wholesale architecture inheritance.

These are starting constraints for research, not a final AI architecture.

## Current state

**S0 physical cooperation apparatus — mechanical PASS, Owner/browser qualification open.**

Live pinned S0 preview: https://jozzpoly.github.io/Companion-Brain-Lab/

The currently published application is pinned to experiment source SHA `0ee6450aea121a1c3d2c59fc2fceda37539ab9f6`; later documentation/deployment commits do not silently change the Owner-test runtime.

The project still has **no autonomous companion brain**. S0 exists to qualify the physical and debugging apparatus before the first relational-positioning experiment.

Current research material:

- [`docs/INITIAL_RESEARCH_SKELETON.md`](docs/INITIAL_RESEARCH_SKELETON.md) — Owner intent, research axes, tensions, evidence model and provisional investigation order;
- [`docs/SIBLING_DONOR_AUDIT.md`](docs/SIBLING_DONOR_AUDIT.md) — source-level audit of what the current LLM Live NPC substrate can and cannot safely donate;
- [`docs/CROSS_REPO_COLLABORATION.md`](docs/CROSS_REPO_COLLABORATION.md) — reversible rules for sibling donor flow and gates for any future shared core;
- [`docs/FIRST_PHYSICAL_COOPERATION_APPARATUS_AUDIT.md`](docs/FIRST_PHYSICAL_COOPERATION_APPARATUS_AUDIT.md) — physical/world substrate decision audit;
- [`docs/S0_APPARATUS_SPIKE_PLAN.md`](docs/S0_APPARATUS_SPIKE_PLAN.md) — bounded S0 experiment contract;
- [`docs/S0_QUALIFICATION_STATE.md`](docs/S0_QUALIFICATION_STATE.md) — current evidence boundary and Owner-test gate.

These documents remain revisable research evidence rather than frozen architecture.
