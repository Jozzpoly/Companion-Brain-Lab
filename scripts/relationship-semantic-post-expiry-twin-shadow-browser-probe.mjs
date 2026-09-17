import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/relationship-semantic-post-expiry-twin-shadow-live";
const PREFERRED_RADIUS = 1.45;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function magnitude(value) {
  return Math.hypot(value.x, value.y);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function normalized(value) {
  const length = magnitude(value);
  return length > 1e-9 ? { x: value.x / length, y: value.y / length } : { x: 0, y: 0 };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(value, scalar) {
  return { x: value.x * scalar, y: value.y * scalar };
}

function actor(snapshot, id) {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  invariant(value, `snapshot missing ${id}`);
  return value;
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

async function panelText(page) {
  return page.locator("#debug-panel").innerText();
}

async function waitForPanel(page, predicate, timeout = 15_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(50);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2500))}`);
}

async function a11f(page) {
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
}

async function semantic(page) {
  return page.evaluate(() => window.__relationshipSemanticPerturbationBridge?.snapshot() ?? null);
}

async function shadow(page) {
  return page.evaluate(() => window.__relationshipSemanticPhysicsShadowBridge?.snapshot() ?? null);
}

async function setForcedMove(page, move) {
  await page.evaluate((value) => window.__relationshipSemanticPerturbationBridge.setForcedCompanionMove(value), move);
}

async function armShadow(page, frame) {
  await page.evaluate((value) => window.__relationshipSemanticPhysicsShadowBridge.armNextDisturbedNoneReconsideration(value), frame);
}

async function singleStep(page, label) {
  const before = await a11f(page);
  invariant(before, `${label}: A1.1f bridge missing.`);
  const expectedCount = before.frameCount + 1;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= count,
    expectedCount,
    { timeout: 15_000 }
  );
}

async function latestAligned(page, label) {
  const a1 = await a11f(page);
  const sem = await semantic(page);
  invariant(a1?.frames?.length > 0, `${label}: no A1.1f frame.`);
  invariant(sem?.frames?.length > 0, `${label}: no semantic perturbation frame.`);
  const a1Frame = a1.frames.at(-1);
  const semanticFrame = sem.frames.at(-1);
  invariant(a1Frame.tick === semanticFrame.tick, `${label}: bridge ticks diverged (${a1Frame.tick} vs ${semanticFrame.tick}).`);
  return { a1Frame, semanticFrame, semanticSnapshot: sem };
}

async function driveCompanionTo(page, target, label, maxSteps = 72) {
  let latest = await latestAligned(page, `${label} initial`);
  for (let index = 0; index < maxSteps; index += 1) {
    const companion = latest.a1Frame.situation.situated.companionBody.position;
    const delta = { x: target.x - companion.x, y: target.y - companion.y };
    if (magnitude(delta) <= 0.12) return latest;
    await setForcedMove(page, normalized(delta));
    await singleStep(page, `${label}-${index + 1}`);
    latest = await latestAligned(page, `${label} ${index + 1}`);
    invariant(latest.semanticFrame.apparatusApplied === true, `${label}: apparatus was not applied.`);
    invariant(latest.semanticFrame.canonicalOrientation?.source === "NONE", `${label}: canonical orientation stopped being NONE during staging.`);
    invariant(latest.a1Frame.observation.orientation?.source === "NONE", `${label}: A1 orientation stopped being NONE during staging.`);
  }
  const companion = latest.a1Frame.situation.situated.companionBody.position;
  throw new Error(`${label}: companion did not reach staging target; remaining ${distance(companion, target).toFixed(3)} m.`);
}

function analyzeBranch(branch, sourceSnapshot) {
  const initialPlayer = actor(sourceSnapshot, "player").position;
  const initialCompanion = actor(sourceSnapshot, "companion").position;
  let previousCompanion = initialCompanion;
  let contactFrames = 0;
  let maxPlayerDisplacementMeters = 0;
  let maxPlayerSpeed = 0;
  let minSeparationMeters = Number.POSITIVE_INFINITY;
  let companionTravelMeters = 0;

  for (const frame of branch.rehearsal.frames) {
    const player = frame.actors.find((candidate) => candidate.id === "player");
    const companion = frame.actors.find((candidate) => candidate.id === "companion");
    invariant(player && companion, `${branch.policy}: rehearsal frame missing actor.`);
    if (player.contacts.includes("companion")) contactFrames += 1;
    maxPlayerDisplacementMeters = Math.max(maxPlayerDisplacementMeters, distance(player.position, initialPlayer));
    maxPlayerSpeed = Math.max(maxPlayerSpeed, magnitude(player.actualVelocity));
    minSeparationMeters = Math.min(minSeparationMeters, distance(player.position, companion.position));
    companionTravelMeters += distance(previousCompanion, companion.position);
    previousCompanion = companion.position;
  }

  const finalFrame = branch.rehearsal.frames.at(-1);
  invariant(finalFrame, `${branch.policy}: empty rehearsal.`);
  const finalPlayer = finalFrame.actors.find((candidate) => candidate.id === "player");
  const finalCompanion = finalFrame.actors.find((candidate) => candidate.id === "companion");
  invariant(finalPlayer && finalCompanion, `${branch.policy}: final rehearsal frame missing actor.`);
  const finalRadius = distance(finalPlayer.position, finalCompanion.position);

  return {
    policy: branch.policy,
    companionMove: branch.companionMove,
    companionRawVelocity: branch.companionRawVelocity,
    radialTarget: branch.radialTarget,
    frameCount: branch.rehearsal.frames.length,
    contactFrames,
    maxPlayerDisplacementMeters,
    maxPlayerSpeed,
    minSeparationMeters,
    companionTravelMeters,
    finalRadiusMeters: finalRadius,
    finalRadialErrorMeters: Math.abs(finalRadius - PREFERRED_RADIUS),
    finalPlayerPosition: finalPlayer.position,
    finalCompanionPosition: finalCompanion.position,
    physicsProvenance: branch.rehearsal.physicsProvenance,
    liveWorldMutationClaim: branch.rehearsal.liveWorldMutationClaim
  };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during twin-shadow replay.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.goto("http://127.0.0.1:4173/?a1debug=1&semanticpush=1&semanticshadow=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__relationshipSemanticPerturbationBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__relationshipSemanticPhysicsShadowBridge?.enabled === true, null, { timeout: 10_000 });

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "initial pause");
  await page.locator('[data-action="scenario-open"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Open field") && text.includes("PAUSED") && text.includes("A1 OFF"),
    15_000,
    "paused open reset"
  );
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("PAUSED") && text.includes("A1 DIRECT") && text.includes("SPATIAL"),
    10_000,
    "paused A1 DIRECT SPATIAL setup"
  );

  await page.keyboard.down("d");
  for (let index = 0; index < 7; index += 1) await singleStep(page, `owner-plus-x-${index + 1}`);
  await page.keyboard.up("d");

  let expiryBaseline = null;
  for (let index = 0; index < 90; index += 1) {
    await singleStep(page, `await-none-${index + 1}`);
    const aligned = await latestAligned(page, `await NONE ${index + 1}`);
    const canonical = aligned.semanticFrame.canonicalOrientation;
    const baseline = aligned.semanticFrame.baselineRelationship;
    if (canonical?.source === "NONE" && baseline?.reconsideredAtTick === aligned.a1Frame.tick) {
      invariant(canonical.direction === null && canonical.strength === 0, "Canonical NONE carried directional semantics.");
      invariant(aligned.a1Frame.observation.orientation?.source === "NONE", "A1 did not become directionless at canonical NONE.");
      invariant(baseline.semanticFrame?.frameProvenance === "RETAINED_LAST_SEMANTIC_FRAME", "Baseline did not label retained continuity explicitly.");
      expiryBaseline = structuredClone(aligned);
      break;
    }
  }
  invariant(expiryBaseline !== null, "Did not reach a baseline reconsideration under canonical NONE.");

  const expiryPlayer = expiryBaseline.a1Frame.situation.situated.playerBody.position;
  const expiryCompanion = expiryBaseline.a1Frame.situation.situated.companionBody.position;
  const retainedForward = normalized(expiryBaseline.semanticFrame.baselineRelationship.playerDirection);
  const currentRelative = normalized({
    x: expiryCompanion.x - expiryPlayer.x,
    y: expiryCompanion.y - expiryPlayer.y
  });
  invariant(magnitude(currentRelative) > 0.99, "Expiry baseline lacks a usable current-relative direction.");

  const waypoint1 = add(expiryPlayer, scale(currentRelative, 2.0));
  const waypoint2 = add(add(expiryPlayer, scale(currentRelative, 2.0)), scale(retainedForward, 2.0));
  const stageTarget = add(expiryPlayer, scale(retainedForward, 1.1));
  await driveCompanionTo(page, waypoint1, "stage-outward");
  await driveCompanionTo(page, waypoint2, "stage-around-corner");
  const staged = await driveCompanionTo(page, stageTarget, "stage-retained-forward-side");
  invariant(staged.a1Frame.situation.situated.playerBody.contacts.includes("companion") === false, "Staging contacted player before shadow trigger.");

  await armShadow(page, retainedForward);
  const armed = await shadow(page);
  invariant(armed?.armed === true && armed.capture === null, "Twin-shadow bridge did not arm cleanly.");

  const pushMove = scale(retainedForward, -1);
  await setForcedMove(page, pushMove);
  let capture = null;
  let captureA1 = null;
  let captureSemantic = null;

  for (let index = 0; index < 42; index += 1) {
    await singleStep(page, `shadow-trigger-push-${index + 1}`);
    const shadowState = await shadow(page);
    if (!shadowState?.capture) continue;
    capture = shadowState.capture;
    const a1 = await a11f(page);
    const sem = await semantic(page);
    captureA1 = a1.frames.find((frame) => frame.tick === capture.sourceTick) ?? null;
    captureSemantic = sem.frames.find((frame) => frame.tick === capture.sourceTick) ?? null;
    break;
  }

  invariant(capture !== null, "Twin-shadow bridge did not capture a disturbed NONE reconsideration within 42 exact ticks.");
  invariant(captureA1 !== null, "Twin-shadow source tick has no aligned A1.1f frame.");
  invariant(captureSemantic !== null, "Twin-shadow source tick has no aligned perturbation frame.");
  invariant(capture.semantics.stateAlignment === "EXACT_PRE_WORLD_STEP_LIVE_STATE", "Twin-shadow did not capture exact pre-step state.");
  invariant(capture.canonicalOrientation.source === "NONE" && capture.canonicalOrientation.direction === null, "Twin-shadow source was not semantic NONE.");
  invariant(captureA1.observation.orientation?.source === "NONE", "A1 was not directionless at twin-shadow source.");
  invariant(capture.baselineRelationship.semanticFrame?.frameProvenance === "RETAINED_LAST_SEMANTIC_FRAME", "Twin-shadow retained branch lacks stale-continuity provenance.");
  invariant(intentsEqual(captureA1.baselineCompanionIntent, captureA1.selectedCompanionIntent), "A1 changed movement authority at twin-shadow source.");
  invariant(intentsEqual(capture.retainedCompanionIntent, captureA1.selectedCompanionIntent), "Twin-shadow retained command is not the exact live pre-perturbation command.");
  invariant(captureSemantic.apparatusApplied === true, "Physical disturbance apparatus was not applied at twin-shadow source tick.");
  invariant(dot(normalized(captureSemantic.executedCompanionIntent.move), pushMove) > 0.999, "Physical disturbance apparatus did not execute the intended push.");
  invariant(capture.branches.length === 3, "Twin-shadow capture requires exactly three policy branches.");

  const branchMetrics = capture.branches.map((branch) => analyzeBranch(branch, capture.sourceSnapshot));
  for (const metrics of branchMetrics) {
    invariant(metrics.frameCount === 6, `${metrics.policy}: twin-shadow horizon was not exactly six ticks.`);
    invariant(metrics.physicsProvenance === "LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE", `${metrics.policy}: wrong physics provenance.`);
    invariant(metrics.liveWorldMutationClaim === "NONE_QUERY_ONLY_CLONE", `${metrics.policy}: rehearsal did not preserve no-mutation contract.`);
  }

  const retained = branchMetrics.find((entry) => entry.policy === "RETAINED_LIVE_COMMAND");
  const radial = branchMetrics.find((entry) => entry.policy === "RADIAL_NONE_CURRENT_RELATIVE");
  const hold = branchMetrics.find((entry) => entry.policy === "HOLD_CURRENT_BODY");
  invariant(retained && radial && hold, "Twin-shadow branch metrics are incomplete.");

  const retainedBranch = capture.branches.find((entry) => entry.policy === "RETAINED_LIVE_COMMAND");
  const radialBranch = capture.branches.find((entry) => entry.policy === "RADIAL_NONE_CURRENT_RELATIVE");
  invariant(retainedBranch && radialBranch, "Twin-shadow branch commands are incomplete.");
  const commandDot = dot(normalized(retainedBranch.companionMove), normalized(radialBranch.companionMove));

  const participant = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  const research = await page.screenshot({ type: "jpeg", quality: 65, fullPage: true });
  await writeFile(`${ARTIFACT_DIR}/source-participant.jpg`, participant);
  await writeFile(`${ARTIFACT_DIR}/source-research.jpg`, research);

  await setForcedMove(page, null);
  await page.evaluate(() => window.__relationshipSemanticPhysicsShadowBridge.clear());
  await singleStep(page, "post-shadow-release");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-relationship-semantic-post-expiry-twin-shadow-live-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "open",
    scheduler: "PAUSED_RESET_EXACT_SINGLE_STEP",
    sourceTick: capture.sourceTick,
    sourceTruth: {
      canonicalOrientation: capture.canonicalOrientation,
      a1Orientation: captureA1.observation.orientation,
      baselineRelationship: capture.baselineRelationship,
      playerBody: captureA1.situation.situated.playerBody,
      playerMotionProvenance: captureA1.situation.situated.playerMotionProvenance,
      playerIntent: capture.playerIntent,
      retainedLiveCompanionIntent: capture.retainedCompanionIntent,
      apparatusExecutedCompanionIntent: captureSemantic.executedCompanionIntent
    },
    comparisonContract: capture.semantics,
    commands: capture.branches.map((branch) => ({
      policy: branch.policy,
      companionMove: branch.companionMove,
      companionRawVelocity: branch.companionRawVelocity,
      radialTarget: branch.radialTarget
    })),
    retainedVsRadialCommandDot: commandDot,
    branchMetrics,
    interpretation: {
      sameExactPreStepState: true,
      sameRapierPhysics: true,
      horizonIsOneTacticalInterval: true,
      canonicalNoneInAllBranches: true,
      radialBranchUsesNoDirectionalOwnerSemantics: true,
      holdIsNeutralControl: true,
      counterfactualBranchesHaveNoAuthority: true,
      a1MovementAuthorityChanged: false,
      scalarWinnerScore: null,
      replacementPolicySelected: false,
      retainedPolicyOwnerQualified: false
    },
    imageBytes: {
      participant: participant.length,
      research: research.length
    },
    errors
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[RELATIONSHIP_SEMANTIC_POST_EXPIRY_TWIN_SHADOW] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
