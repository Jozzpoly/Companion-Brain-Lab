# Companion × Jaskinia — lived cooperative moment (GPT-6, 6 Nov 2026)

**Status: ISOLATED EXPERIMENT; NOT OWNER QUALIFIED; NO PUBLIC BUILD OF PR #65 ALONE; NO NEW WORLD AUTHORITY.** The descendant [C1 Cover PR #66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66) later published an independent, compiled, non-Owner-qualified specimen — not an old Jaskinia release or the historical public R1.

## What this experiment actually changes

The existing **real Squad Field Lab** (only when served as `?fieldlab=1`) can identify itself to an instance of the **old Jaskinia** which has framed it. It uses Jaskinia's already established `hello/state/signals/state?/remark` v1 contract.

Every state read is taken directly from the current World snapshot and squad control: tick, situation/layout, paused state, body positions and contacts, focused and selected members, player directives, whether direct control is active, and optional Combat Micro responsibility bearer. If a Trial is in progress, its slot and progress are represented.

When the Owner flags a moment in Jaskinia, a `state?` request captures **the then-current tick**. This anchor is held separately from the continuously advancing telemetry until the remark is saved. The Owner remark subsequently returns to the lab with this moment as context; the lab logs its reception but does not execute a command or replicate the Owner's private text into the repository.

The lab has no dependency on Jaskinia for simulation. No new window shell, page overlay, telemetry framework or universal data model is introduced.

## Why this is not the Combat-Lab Worldbench witness

Combat Lab's contemporary isolated experiment observes physical world state and an explicit source witness. This Companion experiment is more specifically about **embodied cooperation and human judgement**: a note needs to refer to who did what under which player/companion authority in which living situation.

The result may inspire the broader Worldbench, but it is **not a shared dependency**, and uses Jaskinia's existing v1 instrument contact, not another team's new protocol.

## Boundaries and falsifiers

- `sourceReported: true` / `restorable: false`: a World snapshot is **not** a whole Rapier solver checkpoint, a replayable Trial, proof of autonomy, nor an Owner gameplay PASS.
- The old Jaskinia does not have authority to send movement/action orders. Inbound messages are `hi`, `state?` and `remark` only.
- Parent source and origin are checked. Old Jaskinia explicitly sets `iframe referrerpolicy=no-referrer`, so the bridge must bind to a narrowly allowed origin after the source-bound `hi`; when same-origin parent pathname is readable, a non-Jaskinia path is rejected. This is **not cryptographic host authentication** or full cross-project storage isolation: all Jozzpoly GitHub Pages apps share an origin. No secret/private data or World authority is transmitted.
- The lab never reads or rewrites Jaskinia storage or private notes. The Owner's text is deliberately not included in periodic telemetry.
- Host state is bounded to a small structured payload for the existing v1 channel.
- Headless/unit checks cannot establish whether the Owner finds the interaction useful, or whether the historical published `/Companion-Brain-Lab/` URL contains the current Field Lab (**it does not**).
- If real Jaskinia resizing/focus causes input regressions, that is a material FAIL requiring change, not an acceptable UX downgrade.
- Reported moments are **not automatically playable or rehydratable**. A truly replayable, shareable workpiece is a separate challenge.

## Evidence (6 Nov 2026)

- Initial compile/contract CI: **PASS** (193 test files / 784 tests), later one additional no-referrer test and one parent-path test added.
- [Genuine real-browser Jaskinia x CURRENT Field Lab](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42307706884): **bounded PASS**. Actual native Jaskinia iframe, source World tick advancing, reported bodies and authority, Owner note pinned to source data at tick 68, Owner feedback returned to lab, maximizing/unmaximizing window did not restart World (tick 127). Two browser screenshots saved as CI artifact. This was before the separate note-anchor-over-time correctness fix.
- The first browser attempt failed because the lab wrongly depended on a referrer that Jaskinia intentionally suppresses. That limitation was found **by real cross-repo execution** and corrected; do not regress into simulated referrer tests alone.
- Later exact-source [CI 42308967332](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42308967332) **PASS** established anchored note, responsive world-first interface and standalone Field Lab preservation in genuine old Jaskinia Chrome; descendant [CI 42314065483](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42314065483) also passed with Cover. These are strictly bounded engineering outcomes, not Owner experience or resilient long-term world continuity.

## What to validate next

1. No further CI repetition solely to reconfirm the existing transport/viewport proof. Reopen only on new contradictory browser evidence or materially changed source.
2. Owner's actual feel in Jaskinia: input, resize, focus and ease of rediscovering the real Companion, without routing them to the pinned historical R1 page.
3. Distinguish source-reported World snapshots from replayable experiment records. Do not claim a solver checkpoint.
4. Explore live, reversible in-world changes that preserve cooperation and experience, rather than only inspecting read-only source claims.

Main, the published historical R1, the old Jaskinia and other agents' experiment branches are untouched.

## Ownership

This branch is GPT-6 / Companion line's own reversible test, not a prescribed Jaskinia architecture and not a request that other agents halt their experiments. The source of truth remains Companion World. New Jaskinia's Opus teams are free to accept, reject or mutate the finding.
