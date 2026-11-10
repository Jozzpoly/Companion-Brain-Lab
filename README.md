# Companion Brain Lab

Independent R&D on **embodied cooperation between a player and one-to-few NPC teammates**. The aim is a competent, readable, correctable partner in a real shared world—not a chatbot, follower demo, behavior-list framework, or debug-only success.

**New AI agent / different provider? Start with [AGENTS.md](AGENTS.md) and [docs/STATE.md](docs/STATE.md).** No prior ChatGPT/Claude conversation, memory, account library, or proprietary workflow is required.

## What exists

- `main` contains the **Squad Field Lab**: player and up to four companion bodies, formations, direct control, orders, parametric experiments, real Rapier/World authority, and causal diagnostics. This is a research instrument, **not an Owner-qualified teammate**.
- One-to-one Combat Micro and manual intervention are bounded research capabilities. They do **not** prove tactical intelligence or useful cooperation.
- The Nov 2026 **Jaskinia live note** and **C1 Cover** were *unmerged donor experiments*, not part of `main`. Recover exact sources via [archive/branch-manifest-2026-11-10.json](archive/branch-manifest-2026-11-10.json), and PRs [#65](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/65)/[#66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66).
- Published GitHub Pages points at **historical pinned specimens**, not the current main-branch Field Lab or an approved product.

## Run locally

Use Node.js 22 (`.nvmrc`). Install dependencies with `npm ci`, run `npm run dev`, and open `http://localhost:5173/?fieldlab=1`. Use `npm run check` for TypeScript, unit tests, and build. For browser tests, see [docs/RUN_AND_VERIFY.md](docs/RUN_AND_VERIFY.md).

**Dependency baseline verified 2026-11-10:** `package-lock.json` and project `.npmrc` enable clean `npm ci` on Node 22. [Full CI proof](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42906609446): 192 files / 780 tests and build PASS. `.npmrc` explicitly uses `legacy-peer-deps=true` because normal npm 10 peer resolution crashes (`edgesOut`). This is a documented compatibility compromise, not a fixed peer graph.

## Read next

- [docs/STATE.md](docs/STATE.md) — concise actual state, evidence and open problems
- [docs/RUN_AND_VERIFY.md](docs/RUN_AND_VERIFY.md) — executable commands and safety
- [docs/RESEARCH_INDEX.md](docs/RESEARCH_INDEX.md) — how to find useful history without following old roadmaps
- [docs/INITIAL_RESEARCH_SKELETON.md](docs/INITIAL_RESEARCH_SKELETON.md) — original intent (Sep 2026)
- [archive/README.md](archive/README.md) — recover experiments without preserving stale development branches

This repository is **main-first**. Keep valuable evidence; do not keep obsolete plans in charge. Product/UX claims require Owner experience, not merely machine PASS.
