# Companion Brain Lab ↔ LLM Live NPC — Cross-Repo Collaboration Skeleton

Status: **working collaboration contract, not a software architecture**  
Date: 2026-09-13

This document exists because the long-term objective is not two isolated experiments. The laboratories should be able to **teach each other and eventually compose into stronger systems** without sacrificing the research freedom that makes the separate repositories valuable.

The principle is simple:

> **Share evidence and responsibility boundaries early. Share code only when the code has earned a stable common responsibility.**

---

## 1. Repository topology now

```text
Jozzpoly/Llm-Live-NPC
  persistent embodied resident laboratory

Jozzpoly/Companion-Brain-Lab
  player-companion / local-live-brain cooperation laboratory
```

Neither repository imports the other as a runtime dependency.

Neither repository is upstream authority for the other.

Neither repository must stay source-compatible with the other.

Both are allowed to diverge aggressively when their local research questions demand it.

---

## 2. What should be shared immediately

### 2.1 Research evidence

A finding can transfer even when code should not.

Examples:

- a world-authority invariant;
- a failure mode discovered in Owner play;
- an observation about command semantics;
- evidence that a debug representation is misleading;
- a useful test scenario;
- a timing/latency requirement;
- a perception or execution edge case;
- evidence for or against a decision architecture.

### 2.2 Proven responsibility boundaries

The projects should preferentially remain compatible around **who is allowed to own what**, for example:

- World owns physical truth;
- perception does not become action authority;
- cognition can propose direction without declaring factual success;
- execution attempts are distinct from outcomes;
- diagnostics observe rather than authorize;
- slow/high cognition does not own the simulation clock.

These can remain compatible even when the implementations are completely different.

### 2.3 Donor provenance

Whenever code or a concrete design is transplanted, preserve where it came from and why it was trusted.

---

## 3. What should *not* be shared automatically

Do not create coupling merely because both systems contain something named:

- World;
- perception;
- memory;
- task;
- intent;
- agent;
- command;
- executor;
- brain;
- event.

The same word can describe materially different responsibilities.

Before sharing an abstraction, ask:

> **If the implementations diverged tomorrow, would that represent duplicated engineering or legitimate different research?**

If the answer is "legitimate research", keep them separate.

---

## 4. Default donor mechanism

Until a common package is earned, use **snapshot transplant with provenance** rather than live coupling.

Preferred pattern:

```text
source repo @ exact commit
        ↓
identify narrow donor responsibility
        ↓
copy/adapt into recipient
        ↓
record local changes/assumptions
        ↓
qualify independently in recipient
        ↓
allow divergence
```

Avoid by default:

- Git submodules;
- Git subtrees used as pseudo-package management;
- one sibling importing source files from the other;
- automatic cross-repo synchronization;
- long-lived merge obligations between siblings.

Those mechanisms solve synchronization before we have established that synchronization is desirable.

---

## 5. Donor classification

When a candidate crosses repositories, classify it explicitly:

### `principle`
A proven or strongly supported responsibility/invariant. No code transfer required.

### `inspiration`
A useful approach or shape that informs a fresh implementation.

### `adapted donor`
Source code/design is transplanted but deliberately modified for recipient semantics.

### `compatible implementation`
Both repositories independently implement roughly the same contract. This is a candidate signal for future extraction.

### `shared-core candidate`
Repeated use shows that one implementation could genuinely serve both without importing domain-specific assumptions.

The classification may change as evidence accumulates.

---

## 6. Shared-core extraction gate

A common package/runtime is **not** justified by one successful transplant.

Before extraction, require evidence that:

1. at least two real consumers need substantially the same responsibility;
2. the semantic boundary has survived real runtime/Owner testing;
3. known domain-specific variation can stay outside the shared layer;
4. the abstraction has changed less often than its consumers;
5. sharing removes duplicated bugs/effort more than it creates coordination cost;
6. neither laboratory would lose the ability to run bounded experiments independently;
7. migration back out remains possible if the abstraction later proves wrong.

If these are not true, duplication is cheaper and epistemically safer.

---

## 7. If a common core eventually appears

The likely topology is **not** one research repo depending directly on the other.

A healthier eventual shape would be:

```text
                 [ earned small common core ]
                    ↑                 ↑
                    │                 │
          LLM Live NPC       Companion Brain Lab
             resident             companion
             systems              systems
```

The common core should be the least opinionated member of the family.

Candidate responsibilities, only if earned:

- deterministic frame/time contract;
- small domain math/id primitives;
- actor control/action envelopes;
- world action-result / occurrence provenance;
- generic observation interfaces;
- debug/trace transport structures;
- scenario-test harness utilities.

It should **not** initially own:

- resident semantics;
- companion tactics;
- command interpretation;
- memory policy;
- LLM orchestration;
- personality;
- squad strategy;
- game-specific combat rules.

---

## 8. Shared brain: long-term possibility, not current target

The final systems may eventually share more than a World/runtime substrate.

Companion Brain Lab is especially likely to discover local-live-brain mechanisms useful to `Llm-Live-NPC`:

- fast embodied reactions;
- continuous attention;
- stable behavior between expensive cognition events;
- local tactical/interaction competence;
- arbitration between an existing activity and a newly urgent stimulus;
- interpretable public decision state;
- escalation triggers for higher cognition.

Conversely, `Llm-Live-NPC` may donor:

- grounded semantic context;
- persistent continuity;
- memory/evidence discipline;
- higher-cognition proposal lifecycle;
- provider routing/budget evidence;
- natural communication and long-horizon intention.

The eventual interesting system may therefore be **composition of different kinds of intelligence**, not one project swallowing the other.

Do not select today whether this composition is hierarchical, parallel, event-driven, arbitration-based, blackboard-based or something else.

---

## 9. Cross-project stage closure question

At the end of a meaningful experiment in either repository, add only one lightweight cross-project check:

> **Did this stage discover anything that materially changes the sibling project's assumptions, provides a donor candidate, or falsifies a hoped-for common abstraction?**

If no, do nothing.

If yes, record the finding at its source and link it when the sibling actually consumes it.

This prevents continuous synchronization work from becoming a tax on experimentation.

---

## 10. Naming discipline

Avoid forcing shared terminology too early.

When a term is local, qualify it locally (`resident activity`, `companion command`, `motor control`, `tactical intent`, etc.).

Only promote a word into common vocabulary when both projects mean substantially the same responsibility by it.

This matters because vocabulary can create architecture by accident: once two different concepts share a type/name, later work tends to preserve the false equivalence.

---

## 11. Owner workflow implications

The repository split should **lower**, not raise, Owner orchestration cost.

The Owner should not need to manually track donor compatibility between repositories.

Browser GPT / repo-native agents should carry the burden of:

- checking current source refs before proposing reuse;
- distinguishing local truth from sibling inspiration;
- tracking donor provenance;
- identifying when an old shared assumption has been falsified;
- proposing cross-project extraction only when it has evidence;
- keeping each repo runnable and understandable on its own.

The Owner remains authority over vision, priorities, feel and whether a research direction is worth pursuing, not a package-integration coordinator.

---

## 12. Current working contract

For the near term:

1. **Companion Brain Lab stays independently runnable.**
2. **LLM Live NPC stays independently runnable.**
3. No runtime dependency between them.
4. Share research findings freely.
5. Transplant narrow donors explicitly, pinned to source provenance.
6. Qualify every transplant locally.
7. Allow transplanted code to diverge.
8. Re-evaluate potential common seams at meaningful stage closures.
9. Extract shared code only after repeated evidence.
10. Prefer an imperfect but reversible local solution over a premature family-wide abstraction.

This contract should itself be revised if it begins to obstruct better collaboration.
