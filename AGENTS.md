# Agent entry — Companion Brain Lab (provider-independent)

Read **README.md → docs/STATE.md → docs/RUN_AND_VERIFY.md** before editing. This file is an orientation contract for any independent AI assistant, IDE agent, CLI model, or human engineer. It is not tied to ChatGPT, Codex, Claude, Gemini, or a specific memory service.

## Mission and scope

Build/research a local-live-brain teammate for active play: cheap continuous embodied behavior, useful initiative, preparation and combat cooperation, low-friction player commands, sensible arbitration between autonomy and direction, correction without constant babysitting, and eventual one-to-few teammate scale. Later high-level LLM cognition is optional. Preserve the opportunity to discover better architectures.

The Owner directs vision and judges creative/gameplay quality. Do not expect the Owner to write code, maintain Git plumbing, or manually reconstruct the history. Agents own technical implementation and verification, while avoiding unauthorized production/deployment or private-data changes.

**Judgment order:** recent explicit Owner experience/feedback > older Owner interpretation > participant-visible running behavior > controlled browser/World tests > unit tests/internal instrumentation > plans and prose. A valid diagnostic is not a product PASS. Do not re-present rejected marker/movement-only demos as a new milestone.

## Current authority and navigation

- `main` is the canonical source tree. `docs/STATE.md` is the time-stamped recovery point; VERIFY the live Git refs and CI before relying on it.
- `docs/CURRENT.md` is a **historical Sep 27 2026 research dossier**, despite its old title and former authority language. Do not treat its execution plan as the current queue. Older `docs/*PLAN*`, `docs/CONVERSATION_HANDOFF_2026-09-29.md`, and the historical branch manifest are likewise evidence, not orders.
- `src/main.ts`: URL selects `R1LabScene` or `SquadFieldLabScene` via `?fieldlab=1`. `src/app/` is UI/scene, `src/world/` owns outcomes, `src/physics/` owns material dynamics, `src/squad/` is manual/formation control, `src/brain/` decision experiments, `src/debug/` diagnostics and provenance, `src/coordination/` historical/reflexive cognition experiments.
- `scripts/` and `.github/workflows/` include both current and historical falsifiers. Do not delete tests/workflows solely because a name is old: first verify call sites, evidence requirements and pinned Pages dependencies.
- Nov 2026 donor code was deliberately **not** merged into `main`. See `archive/branch-manifest-2026-11-10.json` and PR #65/#66 for exact sources and qualifications.

## What we know and what we do NOT

1. World/Rapier truth, action-attempt versus outcome, causal instruments and manual Squad Field Lab have strong bounded evidence.
2. Real teammate quality, continuous cooperation, contextual initiative, situated perception and natural low-effort command UX remain **unqualified**. There were explicit Owner FAILs for empty-feeling command signals, marker-only Stage B, stripped-debug product candidates, and redundant movement-only reviews.
3. C1 Cover (Nov donor): explicit consent and factual strike in one OPEN Combat Micro fixture. It reads global positions/phase, has a fixed 12-tick threshold, and its A/B stops on different events. Target-transfer is **not** proof of actual damage/sacrifice, trust, understanding or persistent commitments.
4. Old Jaskinia integration donor: source-reported body/tick/authority and contextual Owner note, **not** full simulation save, safe host write access, portable replay or general integration.
5. Jaskinia's wider rebuild/Cloudflare/authoring environment is owned by independent workstreams. Companion supplies hard experimental cases; it must not establish a universal cross-project schema, silently edit Jaskinia or wait for Jaskinia to exist before doing its own research.

## Working discipline

- First test the current source and confirm which variant you are in; do not infer feature support from a pinned Pages URL.
- Pick a **meaningful falsifiable player–companion experience**, not another target circle, fabricated oracle or green fixture. Human/manual behavior is a comparator, not an embarrassment.
- Let the simulation determine physical results. Separate creator edits, player commands, NPC actions and diagnostics; do not upgrade observations into unrestricted world mutations.
- Make substantive changes in an isolated branch only when isolation is justified. Keep `main` recoverable; use targeted tests plus `npm run check` and relevant browser tests. State clearly what actually ran.
- Preserve exact source SHA for findings. Use PRs/commits and archive refs rather than transient chat links, expired CI screenshots or unverifiable words such as "fixed".
- Never rewrite/drop historical authored works, experimental evidence, private Owner files, or public deployment without justified, confirmed recovery. Consult `archive/README.md` for branch retirement.
- Update `docs/STATE.md` only when live truth materially changes. Keep it **short**; deep reports stay in research docs. Don't turn the repo into agent-facing paperwork.
- There is NO authorized automatic roadmap from this handoff. Revisit the current Owner's goal when work resumes.

## Verification boundary

`npm run check` is TypeScript + Vitest + Vite build (not a UI/gameplay proof). Playwright smoke scripts may require browser installation. `package-lock.json` is absent on main; dependency installation/reproducibility is a known debt. Historical GitHub Pages surfaces are source-pinned experiments. Product acceptance must not be inferred from successful Actions.
