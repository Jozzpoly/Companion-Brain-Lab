> **Repository cleanup completed 2026-11-10:** one branch remains (`main`); the November donor branches and orphan preview were retired after their exact SHAs were verified under three archive tags. PR #65/#66 were closed without merging any experiment into product code. [Verification run](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42904769440). See [archive manifest](../archive/branch-manifest-2026-11-10.json). No production Pages release or gameplay code was changed by the cleanup.

# Companion Brain Lab — recoverable state

**As-of: 2026-11-10. This is a snapshot, not an instruction to resume an old roadmap.** New AI assistants must compare this with live refs, CI, any newer repository documentation and current Owner direction. See [../AGENTS.md](../AGENTS.md).

## One-paragraph truth

The project studies **competent embodied cooperative NPCs**: one, later a few companions, with a cheap local live brain, useful preparation/combat and situational initiative, quick player direction and correction, and inspectable factual World consequences. The existing product does **not** yet feel like a trustworthy teammate at Owner-approved quality. `main` contains a strong but overly instrumented Squad Field Lab; Sept 2026 product FAILs remain material. Nov 2026 research donors establish a small real Jaskinia observation link and one C1 Cover physical strike, **without** proving cognition or Owner gameplay value. The current priority before a GPT-free interval is **portable repo clarity and preserving evidence**, not shipping a new Companion feature.

## Source and execution truth

| Part | What is present | Evidence boundary |
| --- | --- | --- |
| `main` source at audit start | `02ab485a634a9a4e2ad1974a263b99b0cbbc1b3c` (Sep 29) | historical code baseline; this document cleanup produces a new SHA |
| `?fieldlab=1` local | Current Squad Field Lab with embodied player + 1–4 squad, direct movement/orders, formations, manual experiments/trials, World/Rapier and causal diagnostics | working research apparatus; broad autonomous gameplay **not** Owner-qualified |
| Root/default URL | R1 Causal Workbench | not the Field Lab; do not call it the shipped teammate |
| Sep `main` CI | [run 36502387259](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/36502387259) at `02ab485a`: `validate` PASS | TypeScript/unit/build only; later docs-only changes need new CI verification |
| Nov Jaskinia donor | [PR #65](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/65) source `36e886abbacbebda95d0f13ceee5f4da3100e0e2` | actual old-Jaskinia browser contact, World tick + note, responsive viewport; no new host action authority |
| Nov Cover donor | [PR #66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66) source `7f6a0c6cbad79c732b32d87a0124f70ae6e26953` (stacked on #65) | opt-in one-C1 one-hostile OPEN strike; test source reached World and altered HP/pressure; not an autonomous general brain |
| Historical Pages | workflow `.github/workflows/pages-research-preview.yml` builds from several pinned older SHAs | historical preview surfaces, not `main`, not a current product deployment |
| Nov compiled preview | `2c24ff8940e905326c6d1f38c8c797af4e02733b` (orphan build history; see archival manifest) | compiled artifact only; browser-provider click-through and Owner experience not verified |
| Dependency reproducibility | `package-lock.json` (lock v3, 89 entries) + `.npmrc` (`legacy-peer-deps=true`) now tracked | clean Node 22 `npm ci` + 192 test files / 780 tests + build PASS in [CI #42906609446](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42906609446); normal npm 10 peer resolution still crashes (`edgesOut`) |

## Crucial historical acceptance boundaries

- **Movement substrate**: closed *enough to move on*; NOT a product PASS. Do not create a new movement-only Owner approval gate without a new material failure in actual cooperation.
- **Stage B Slice 1**: Owner explicitly rejected the product. Proximity markers + old follower gave almost no useful new experience; hiding debug was a regression.
- **Readiness/early actions**: recorded keyboard commands did not necessarily produce felt utility.
- **Shared Task Under Pressure**: rejected as behavior-discovery direction; magic placements and geometry-brittle transfers. Preserve only its evidence/donor infrastructure.
- **Field Lab**: Owner affirmed the value of broad manual authoring and deep debugger, but NOT the claim that the live teammate is complete.
- **C1 Cover**: STOP events differ between OFF and ON A/B (player hit vs C1 strike), so outcome counts do not establish a same-horizon protection effect. `COMPANION_CARRIES_PRESSURE` indicates target transfer and **0 actual C1 hits at the observed endpoint**. Policy uses global source facts and hard-coded 12-tick readiness; after target transfer it does not maintain an active longer-lived Cover policy. These are research debts, not ready features.

## What the next AI should *not* assume

- That a document named `CURRENT.md` from Sep 27 is today's execution plan. Its wide account is historically useful, but this snapshot + live evidence + new Owner input take precedence.
- That the most recent experimental PR was merged or endorsed. **It was not.** The PR/archive status may change when cleanup completes: consult the manifest and live Git refs.
- That Jaskinia is one shared game world, a universal AI engine, or an obligation to migrate another repository.
- That developer evidence can substitute for an accessible, interesting, uninterrupted experience.
- That the next project phase has been decided by a handoff. The 2026-11-09 agent hypothesis about authoring reciprocal C1 commitments is **not an Owner-approved design**.

## Where to resume

1. Verify the **actual** `main`, branch/tag refs, issue/PR states, and CI. Read this short file; use `docs/RESEARCH_INDEX.md` only for specific historical questions.
2. Run current Field Lab locally (see `docs/RUN_AND_VERIFY.md`) and retain the inspector/causal workbench; do not refer Owner to old rejected public Pages.
3. Reconstruct fresh Owner intent, then investigate one substantive player–C1 cooperative episode that can **fail in several meaningful ways** (unwanted help, insufficient knowledge, correctable initiative, actual cost and recovery), or another stronger hypothesis if live evidence justifies it.
4. Treat the independent Jaskinia rebuild as a possible future host/donor, **not** a prerequisite or a mandate to build a competing home.

Cross-provider recovery is complete when an agent can explain: *which runtime is source-backed; what the player can actually do; what evidence was only synthetic; what the Owner rejected; how to run and test; what remains open*—without reading any old GPT chat.
