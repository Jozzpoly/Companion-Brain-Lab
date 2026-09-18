# OS-PREP-1 Evidence Integrity Implementation Plan

> **Agent execution note:** execute task-by-task, preserve the active campaign constraints, reverify live branch state before each write boundary, and stop only at a genuine Owner-judgement or authority boundary.

**Goal:** Make one exported Companion incident sufficient to attribute an interesting baseline/P2 moment to the exact build and reconstruct same-step Owner control, explicit intervention and factual World outcome without guessing.

**Architecture:** Extend the existing causal path rather than create a second telemetry stack. Add same-step Owner control to each causal frame, add a small build-identity seam, move incident construction into a pure typed builder, then integrate the existing download action and qualify the result in the real built browser with an explicit P2 one-step specimen.

**Tech Stack:** TypeScript 7, Vitest 5, Vite 8, Phaser 4.2.1, Playwright Chromium 1.63, existing R1/P2 browser bridges.

**Spec:** [OWNER_SANDBOX_PREPARATION_CAMPAIGN.md](OWNER_SANDBOX_PREPARATION_CAMPAIGN.md), especially OS-PREP-1 and section 9.

## Global constraints

- No new automatic A1 selector or horizon/right-of-way/yield policy.
- P2 authority remains explicit, exact-proposal, one-World-step and auto-disarming.
- Incident capture is observational; it must not step World, arm/disarm P2, alter A1 state or mutate causal history.
- World/Rapier remains factual physical authority.
- Same-step Owner control must not be inferred from actual body velocity.
- Exact source SHA is required for qualified CI/Owner-candidate artifacts; local unpinned development must be labeled honestly rather than fabricated.
- Do not introduce an always-on giant session recorder in this tranche.
- Do not change public Foundation Pages to point at the active branch.
- Update current campaign state only after qualification evidence exists.

---

## File map

### Modify

- `src/debug/causal-frame-trace.ts`
  - add same-step player control evidence to the observation phase;
  - preserve defensive cloning.

- `src/debug/causal-frame-trace.test.ts`
  - qualify cloning and retention of same-step Owner control.

- `src/app/r1-lab-scene.ts`
  - populate same-step player control from the current intent set;
  - replace inline incident object construction with the pure Owner Sandbox incident builder;
  - include current A1/P2 state and build identity at capture time.

- `.github/workflows/validate.yml`
  - provide the exact GitHub commit SHA to the Vite build as `VITE_SOURCE_SHA`;
  - upload the bounded OS-PREP-1 browser artifact.

- `package.json`
  - add `browser:audit:os-prep1`;
  - include it in the aggregate browser audit after P2.

### Create

- `src/debug/build-identity.ts`
  - one small typed build-identity seam.

- `src/debug/build-identity.test.ts`
  - pinned vs local-unpinned normalization.

- `src/debug/owner-sandbox-incident.ts`
  - pure schema + builder for exported incidents.

- `src/debug/owner-sandbox-incident.test.ts`
  - schema, cloning, explicit P2 availability and build identity.

- `scripts/owner-sandbox-incident-p2-browser-specimen.mjs`
  - real built-client qualification of P2 incident capture and capture non-interference.

Artifact directory:

- `artifacts/os-prep1-incident/`

No new runtime module may own gameplay authority.

---

## Public interfaces to establish

### Build identity

```ts
export type BuildIdentityState = "PINNED_SOURCE_SHA" | "UNPINNED_LOCAL";

export interface CompanionBuildIdentity {
  sourceSha: string | null;
  state: BuildIdentityState;
}

export function buildCompanionBuildIdentity(
  sourceSha: string | undefined
): CompanionBuildIdentity;

export const CURRENT_COMPANION_BUILD_IDENTITY: CompanionBuildIdentity;
```

Rules:

- trim input;
- accept a non-empty SHA-like string as the exact supplied identity without inventing branch semantics;
- missing/empty value becomes `{ sourceSha: null, state: "UNPINNED_LOCAL" }`;
- `CURRENT_COMPANION_BUILD_IDENTITY` reads `import.meta.env.VITE_SOURCE_SHA`.

The builder does not query GitHub and does not guess the branch.

### Causal same-step Owner evidence

Extend `CausalObservationPhase`:

```ts
playerControlMove: Vec2;
```

Meaning:

> the current `MotionIntent.move` submitted for actor `player` in the same decision/World step represented by this causal frame.

It is **control evidence**, not body motion and not a claim about high-level human intent.

`R1LabScene.recordCausalFrame()` must populate it from `evidence.intents`, not from `beforePlayer.actualVelocity` or `requestedVelocity`.

If a player intent is unexpectedly absent, fail closed to `{x:0,y:0}` only if the current scene contract already permits absence; otherwise preserve the current invariant behavior. Do not infer direction from physics.

### Owner Sandbox incident

```ts
export interface OwnerSandboxIncident {
  schema: "companion-brain-lab-owner-sandbox-incident-v1";
  build: CompanionBuildIdentity;
  capture: {
    scenario: string;
    tick: number;
    paused: boolean;
    mode: string;
    actuator: "natural" | "direct";
    a1Variant: string;
    timeScale: number;
  };
  p2: {
    available: boolean;
    snapshot: AuthorityA12p2BrowserSnapshot | null;
  };
  frames: CausalFrame[];
  events: string[];
}
```

Builder:

```ts
export function buildOwnerSandboxIncident(input: {
  build: CompanionBuildIdentity;
  scenario: string;
  tick: number;
  paused: boolean;
  mode: string;
  actuator: "natural" | "direct";
  a1Variant: string;
  timeScale: number;
  p2: AuthorityA12p2BrowserSnapshot | null;
  frames: readonly CausalFrame[];
  events: readonly string[];
}): OwnerSandboxIncident;
```

Rules:

- defensive-copy every public nested value;
- `p2.available === true` iff the P2 bridge snapshot was supplied;
- `p2.snapshot === null` when P2 is unavailable;
- do not synthesize “no P2 activity” from absence of the bridge;
- no callback into World/scene/P2 from the builder.

---

## Task 1 — Preserve same-step Owner control in causal frames

**Files:**

- Modify: `src/debug/causal-frame-trace.ts`
- Modify: `src/debug/causal-frame-trace.test.ts`
- Modify: `src/app/r1-lab-scene.ts`

**Produces:**

- `CausalObservationPhase.playerControlMove`

### Steps

- [ ] Add a failing trace test that constructs a frame with `playerControlMove: {x:1,y:0}`, records it, mutates the source vector and verifies the public trace still reports `{x:1,y:0}`.

- [ ] Run:

```bash
npx vitest run src/debug/causal-frame-trace.test.ts
```

Expected before implementation: TypeScript/test failure because the observation contract does not yet carry `playerControlMove`.

- [ ] Add `playerControlMove: Vec2` to `CausalObservationPhase` and clone it in `cloneFrame()`.

- [ ] In `R1LabScene.recordCausalFrame()`, obtain the same-step player intent from `evidence.intents`:

```ts
const playerIntent = evidence.intents.find((intent) => intent.actorId === "player") ?? {
  actorId: "player" as const,
  move: { x: 0, y: 0 }
};
```

Populate:

```ts
playerControlMove: { ...playerIntent.move }
```

Do not use body velocity as a fallback semantic/control direction.

- [ ] Update existing frame fixtures in `causal-frame-trace.test.ts` with explicit player control.

- [ ] Run targeted test again and require PASS.

- [ ] Run `npm run check` before committing the task.

- [ ] Commit independently with a message equivalent to:

`feat: preserve Owner control in causal frames`

**Task acceptance:**

A causal frame from observation tick `t` can state what control vector the player submitted for the exact `t -> t+1` World step, independently of what physics later made the player body do.

---

## Task 2 — Add exact build identity seam

**Files:**

- Create: `src/debug/build-identity.ts`
- Create: `src/debug/build-identity.test.ts`
- Modify: `.github/workflows/validate.yml`

**Produces:**

- `CompanionBuildIdentity`
- `buildCompanionBuildIdentity()`
- `CURRENT_COMPANION_BUILD_IDENTITY`

### Steps

- [ ] Write tests for:

1. `" abc123 "` -> `{sourceSha:"abc123", state:"PINNED_SOURCE_SHA"}`;
2. `""` -> `{sourceSha:null, state:"UNPINNED_LOCAL"}`;
3. `undefined` -> unpinned.

- [ ] Run the targeted test and verify it fails before implementation.

- [ ] Implement the pure normalization function and the current-build constant using `import.meta.env.VITE_SOURCE_SHA`.

The module must not import Node APIs or query network state.

- [ ] At the `check` job level in `.github/workflows/validate.yml`, set:

```yaml
env:
  VITE_SOURCE_SHA: ${{ github.sha }}
```

This ensures the `vite build` created by `npm run check` embeds the exact workflow source SHA used later by browser audits.

- [ ] Run:

```bash
npx vitest run src/debug/build-identity.test.ts
npm run check
```

and require PASS.

- [ ] Commit independently:

`feat: bind browser build to source identity`

**Task acceptance:**

A CI-built client can expose the exact source SHA embedded at build time. An unpinned local build says that it is unpinned instead of inventing provenance.

---

## Task 3 — Extract a pure Owner Sandbox incident builder

**Files:**

- Create: `src/debug/owner-sandbox-incident.ts`
- Create: `src/debug/owner-sandbox-incident.test.ts`

**Consumes:**

- `CompanionBuildIdentity`
- `CausalFrame`
- type-only `AuthorityA12p2BrowserSnapshot`

**Produces:**

- `OwnerSandboxIncident`
- `buildOwnerSandboxIncident()`

### Steps

- [ ] Write a failing test that supplies:

  - pinned build SHA;
  - scenario `head-on`;
  - paused tick 1;
  - SPATIAL + DIRECT;
  - A1 variant `direct`;
  - one causal frame with player control `+X`;
  - a representative P2 snapshot containing one confirmed application;
  - two semantic event strings.

Assert the exact schema and all provenance fields.

- [ ] Add a defensive-copy test. Mutate the source frame, source event array and source P2 snapshot after building; the incident must remain unchanged.

- [ ] Add a P2-absent test requiring:

```ts
p2: {
  available: false,
  snapshot: null
}
```

This distinguishes “P2 not available” from “P2 available but never used”.

- [ ] Run targeted tests and verify failure before implementation.

- [ ] Implement the pure builder. It must call no browser API, no scene method and no World method.

- [ ] Run targeted tests and then `npm run check`.

- [ ] Commit independently:

`feat: define Owner Sandbox incident evidence`

**Task acceptance:**

Incident construction is deterministic, independently testable and unable to mutate the runtime it documents.

---

## Task 4 — Integrate v1 incident capture into R1 workbench

**Files:**

- Modify: `src/app/r1-lab-scene.ts`

**Consumes:**

- `CURRENT_COMPANION_BUILD_IDENTITY`
- `buildOwnerSandboxIncident()`
- `window.__authorityA12p2BrowserBridge?.snapshot()`

### Steps

- [ ] Replace only the data-construction portion of `captureIncident()`.

The function should gather:

```ts
const p2 = window.__authorityA12p2BrowserBridge?.snapshot() ?? null;
const a1Variant = this.a1Authority.debugState().variant;
```

Then call the pure builder with:

- exact build identity;
- current scenario/tick;
- `this.paused`;
- current companion mode;
- actuator;
- A1 variant;
- current time scale;
- P2 snapshot/null;
- `this.causalTrace.recent(240)`;
- current event log.

- [ ] Keep the existing download mechanism. Do not introduce storage, network upload or background recording.

- [ ] Change filename to make source identity visible when pinned, for example:

`companion-os-prep-<short-sha>-<scenario>-tick-<tick>.json`

and `unbound`/equivalent when sourceSha is null.

- [ ] The act of capture may update presentation-only `incidentNotice` / event log after the evidence object is built, but must not step or alter World/A1/P2 state.

- [ ] Run `npm run check`.

- [ ] Commit independently:

`feat: export Owner Sandbox incident provenance`

**Task acceptance:**

The existing one-action incident control exports the new bounded evidence schema without changing gameplay/authority semantics.

---

## Task 5 — Qualify the complete incident path in real Chromium

**Files:**

- Create: `scripts/owner-sandbox-incident-p2-browser-specimen.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/validate.yml`

**Produces:**

- `artifacts/os-prep1-incident/summary.json`
- downloaded incident JSON copied into the artifact directory;
- one real-browser qualification path.

### Scenario

Use the already-qualified P2 shape rather than inventing a new behavior:

`paused head-on tick 0 + Owner +X -> P2 preview -> explicit singleton arm -> single World step -> confirmed t0->t1 application -> incident capture while still paused`

### Browser assertions

The script must require:

1. no runtime fault sentinel;
2. no page/console/request errors;
3. P2 application status `APPLIED_OUTCOME_CONFIRMED`;
4. exactly one P2 application and auto-disarm;
5. download occurs after the incident action;
6. incident schema is `companion-brain-lab-owner-sandbox-incident-v1`;
7. incident `build.sourceSha` equals `process.env.GITHUB_SHA` in CI;
8. incident build state is `PINNED_SOURCE_SHA` in CI;
9. incident scenario is `head-on`;
10. incident capture tick is 1;
11. incident contains a causal frame for `t0 -> t1`;
12. that frame contains `playerControlMove: {x:1,y:0}`;
13. incident P2 snapshot is available and contains the exact confirmed proposal/application;
14. P2 source/outcome ticks are `0 -> 1`;
15. P2 proposal identity in the incident matches the proposal that was explicitly armed;
16. A0 command velocity error remains within the existing P2 tolerance;
17. capturing the incident does not increment World/frame count;
18. capture does not change P2 preview/arm/application counts or re-arm authority.

Use `page.waitForEvent("download")` and parse the actual downloaded bytes. Do not inspect only an in-memory JS object.

### Package/workflow wiring

Add:

```json
"browser:audit:os-prep1": "node scripts/owner-sandbox-incident-p2-browser-specimen.mjs"
```

Run it after `browser:audit:a1-2p2` in the aggregate browser audit.

Upload `artifacts/os-prep1-incident` with `if-no-files-found: error`.

- [ ] First run the new browser specimen alone and require PASS.

- [ ] Run the full `npm run browser:audit`.

- [ ] Run `npm run check`.

- [ ] Commit independently:

`test: qualify Owner Sandbox incident provenance`

**Task acceptance:**

The exact built Chromium path proves that a real P2 intervention can be captured from the UI into exact downloaded bytes with source identity, same-step Owner control, proposal/application provenance and no repeated authority or capture-side World progression.

---

## Task 6 — Full qualification and state transition

**Files:**

- Modify only after evidence passes:
  - `docs/CURRENT.md`
  - optionally this plan if a material claim changed during execution.

### Steps

- [ ] Reacquire the branch head before final qualification.

- [ ] Require the normal pushed `validate` workflow to PASS on the exact implementation head, including:

  - `npm run check`;
  - aggregate `browser:audit`;
  - existing relationship semantic probes;
  - P1/P2 artifact upload;
  - new OS-PREP-1 incident artifact upload.

- [ ] Inspect the OS-PREP-1 artifact rather than trusting job green alone.

Require the exact source SHA inside the downloaded incident to equal the workflow head SHA.

- [ ] Verify no implementation commit introduced automatic A1 selection, widened P2 beyond one step, or changed gameplay policy.

- [ ] Only then update `docs/CURRENT.md`:

  - OS-PREP-1 -> **PASS / CLOSED ENOUGH**;
  - record the exact qualified SHA and workflow run;
  - set **OS-PREP-2 — Claim → observable phenomenon map** as active;
  - carry forward any real residual risk discovered.

- [ ] Commit the state transition separately:

`docs: advance Owner Sandbox preparation to phenomenon mapping`

**Task acceptance:**

A fresh continuation can recover, from the repository alone, that evidence integrity is qualified and the next work is product-facing phenomenon mapping rather than more provenance plumbing.

---

## Failure classification during execution

If a task goes RED, classify before patching.

### Product/mechanism RED

Examples:

- P2 capture reveals command/outcome mismatch;
- same-step Owner control is inconsistent with the exact World step;
- capture itself changes authority state.

Treat as real project evidence.

### Oracle/test RED

Examples:

- download test sampled before the browser produced the file;
- assertion expects a label that changed while the semantic contract is intact.

Repair the oracle without weakening the causal claim.

### Instrumentation interference

If adding the incident path changes World hashes, frame count, P2 counts or movement outcome, stop. The observer has become an actor and must be repaired before qualification.

### Build-identity RED

If `VITE_SOURCE_SHA` is absent in CI, do not fill the incident with the branch head discovered later by API. Fix the build/deployment provenance seam. Source identity must describe the bytes actually running.

---

## Explicit non-goals for OS-PREP-1

This tranche does not:

- improve companion movement quality;
- choose a P2 proposal automatically;
- define a right-of-way policy;
- define temporal cooperation commitment;
- solve the `NONE` semantic policy;
- redesign the debug panel;
- deploy the Owner candidate;
- create a full-session recorder;
- add combat/commands/multiple companions.

Its value is narrower and foundational:

> when the Owner later says “tu zrobił coś genialnego” or “tu kompletnie odjebał”, we can bind that judgement to the exact bytes, control evidence, intervention and causal outcome that produced it.
