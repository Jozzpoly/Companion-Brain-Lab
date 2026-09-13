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

**Pre-architecture / research framing.**

The repository is intentionally almost empty. The immediate goal is to define the experimental skeleton, research questions, donor boundaries, evidence strategy, and first playable investigation before committing to behavior trees, utility AI, GOAP, planners, blackboards, squad hierarchies, LLM orchestration, or any other particular decision architecture.

The first design pass should remain easy to revise as evidence and Owner playtesting accumulate.

Current draft planning material:

- [`docs/INITIAL_RESEARCH_SKELETON.md`](docs/INITIAL_RESEARCH_SKELETON.md) — Owner intent, research axes, tensions, evidence model and provisional investigation order;
- [`docs/SIBLING_DONOR_AUDIT.md`](docs/SIBLING_DONOR_AUDIT.md) — source-level audit of what the current LLM Live NPC substrate can and cannot safely donate;
- [`docs/CROSS_REPO_COLLABORATION.md`](docs/CROSS_REPO_COLLABORATION.md) — reversible rules for sibling donor flow and gates for any future shared core.

These documents are planning evidence, not frozen architecture.
