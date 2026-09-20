import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/relationship-semantic-post-expiry-disturbance-live";
const PARTICIPANT_SEQUENCE_DIR = `${ARTIFACT_DIR}/participant-sequence`;
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
  if (length <= 1e-9) return { x: 0, y: 0 };
  return { x: value.x / length, y: value.y / length };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(value, scalar) {
  return { x: value.x * scalar, y: value.y * scalar };
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

function motorToward(from, target) {
  return normalized({ x: target.x - from.x, y: target.y - from.y });
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

async function setForcedMove(page, move) {
  await page.evaluate((value) => window.__relationshipSemanticPerturbationBridge.setForcedCompanionMove(value), move);
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

async function screenshotPair(page, label) {
  const participant = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  const research = await page.screenshot({ type: "jpeg", quality: 65, fullPage: true });
  await writeFile(`${ARTIFACT_DIR}/${label}-participant.jpg`, participant);
  await writeFile(`${ARTIFACT_DIR}/${label}-research.jpg`, research);
  return { participant: participant.length, research: research.length };
}

async function captureParticipantSequenceFrame(page, index, tick) {
  const file = `frame-${String(index).padStart(3, "0")}-t${String(tick).padStart(3, "0")}.jpg`;
  const bytes = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 78 });
  await writeFile(`${PARTICIPANT_SEQUENCE_DIR}/${file}`, bytes);
  return { index, tick, file, bytes: bytes.length };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during post-expiry disturbance replay.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);
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

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await mkdir(PARTICIPANT_SEQUENCE_DIR, { recursive: true });
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1&semanticpush=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__relationshipSemanticPerturbationBridge?.enabled === true, null, { timeout: 10_000 });

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

  // Establish genuine +X Owner meaning, then remove Owner input and wait until
  // the bounded canonical memory has fully expired. No apparatus intervention
  // is allowed before the post-expiry baseline is captured.
  await page.keyboard.down("d");
  for (let index = 0; index < 7; index += 1) await singleStep(page, `owner-plus-x-${index + 1}`);
  await page.keyboard.up("d");

  let expiryBaseline = null;
  for (let index = 0; index < 90; index += 1) {
    await singleStep(page, `await-none-${index + 1}`);
    const aligned = await latestAligned(page, `await NONE ${index + 1}`);
    invariant(aligned.semanticSnapshot.forcedCompanionMove === null, "Apparatus became armed before the expiry baseline.");
    invariant(aligned.semanticFrame.apparatusApplied === false, "Apparatus executed before the expiry baseline.");
    const canonical = aligned.semanticFrame.canonicalOrientation;
    const baseline = aligned.semanticFrame.baselineRelationship;
    if (canonical?.source === "NONE" && baseline?.reconsideredAtTick === aligned.a1Frame.tick) {
      invariant(canonical.direction === null && canonical.strength === 0, "Canonical NONE carried directional semantics.");
      invariant(aligned.a1Frame.observation.orientation?.source === "NONE", "A1 did not become directionless at canonical NONE.");
      invariant(baseline.semanticFrame?.evidenceSource === "NONE", "Baseline did not expose NONE evidence after expiry.");
      invariant(baseline.semanticFrame?.frameProvenance === "RETAINED_LAST_SEMANTIC_FRAME", "Baseline did not label post-expiry policy continuity explicitly.");
      invariant((baseline.playerDirection?.x ?? 0) > 0.9, "Baseline lost the established +X retained frame before disturbance.");
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
  invariant(magnitude(currentRelative) > 0.99, "Expiry baseline lacks a usable player-companion relative direction.");

  // Deliberately move the companion around the player without touching them:
  // outward along the current side, then around a wide corner, then to the
  // retained-forward side. This is apparatus-owned physical disturbance only.
  const waypoint1 = add(expiryPlayer, scale(currentRelative, 2.0));
  const waypoint2 = add(add(expiryPlayer, scale(currentRelative, 2.0)), scale(retainedForward, 2.0));
  const stageTarget = add(expiryPlayer, scale(retainedForward, 1.1));
  await driveCompanionTo(page, waypoint1, "stage-outward");
  await driveCompanionTo(page, waypoint2, "stage-around-corner");
  const staged = await driveCompanionTo(page, stageTarget, "stage-retained-forward-side");

  const stagedPlayer = staged.a1Frame.situation.situated.playerBody.position;
  const stagedCompanion = staged.a1Frame.situation.situated.companionBody.position;
  invariant(distance(stagedPlayer, stagedCompanion) > 0.75, "Staging accidentally entered player contact before the push phase.");
  invariant(staged.a1Frame.situation.situated.playerBody.contacts.includes("companion") === false, "Staging accidentally contacted the player.");

  // Push the player opposite the retained +X frame with zero Owner input.
  // We require the witness to coincide with a real baseline reconsideration so
  // the retained-frame decision is fresh for this disturbed state, not cached.
  const pushMove = scale(retainedForward, -1);
  await setForcedMove(page, pushMove);
  let disturbanceWitness = null;
  for (let index = 0; index < 36; index += 1) {
    await singleStep(page, `post-expiry-push-${index + 1}`);
    const aligned = await latestAligned(page, `post-expiry push ${index + 1}`);
    const body = aligned.a1Frame.situation.situated.playerBody;
    const provenance = aligned.a1Frame.situation.situated.playerMotionProvenance;
    const canonical = aligned.semanticFrame.canonicalOrientation;
    const baseline = aligned.semanticFrame.baselineRelationship;
    const actualAlongRetained = dot(body.actualVelocity, retainedForward);
    if (
      canonical?.source === "NONE" &&
      aligned.a1Frame.observation.orientation?.source === "NONE" &&
      aligned.a1Frame.situation.situated.playerControl.active === false &&
      magnitude(body.requestedVelocity) < 0.08 &&
      actualAlongRetained < -0.15 &&
      body.contacts.includes("companion") &&
      provenance.state === "EXTERNAL_MOTION_EVIDENT" &&
      baseline?.reconsideredAtTick === aligned.a1Frame.tick
    ) {
      disturbanceWitness = structuredClone(aligned);
      break;
    }
  }
  invariant(disturbanceWitness !== null, "Controlled post-expiry push did not produce an aligned external-motion baseline reconsideration.");

  const witnessA1 = disturbanceWitness.a1Frame;
  const witnessSemantic = disturbanceWitness.semanticFrame;
  const witnessBaseline = witnessSemantic.baselineRelationship;
  invariant(witnessBaseline.semanticFrame?.evidenceSource === "NONE", "Disturbance witness baseline no longer reports NONE evidence.");
  invariant(witnessBaseline.semanticFrame?.frameProvenance === "RETAINED_LAST_SEMANTIC_FRAME", "Disturbance witness lost explicit retained-frame provenance.");
  invariant(dot(normalized(witnessBaseline.playerDirection), retainedForward) > 0.999, "Disturbance rotated the retained policy frame.");
  invariant(intentsEqual(witnessA1.baselineCompanionIntent, witnessA1.selectedCompanionIntent), "A1 changed live movement authority during post-expiry disturbance.");
  invariant(witnessSemantic.apparatusApplied === true, "Disturbance witness was not apparatus-owned.");
  invariant(dot(normalized(witnessSemantic.executedCompanionIntent.move), pushMove) > 0.999, "Apparatus did not execute the intended opposite-frame push.");

  const witnessPlayer = witnessA1.situation.situated.playerBody.position;
  const witnessCompanion = witnessA1.situation.situated.companionBody.position;
  const relativeAtWitness = normalized({
    x: witnessCompanion.x - witnessPlayer.x,
    y: witnessCompanion.y - witnessPlayer.y
  });
  const holdTarget = { ...witnessCompanion };
  const radialNearestTarget = add(witnessPlayer, scale(relativeAtWitness, PREFERRED_RADIUS));
  const retainedTarget = { ...witnessBaseline.target };
  const counterfactuals = {
    retainedFrameLive: {
      authority: "LIVE_BASELINE",
      target: retainedTarget,
      motor: { ...witnessA1.baselineCompanionIntent.move },
      distanceFromCompanion: distance(witnessCompanion, retainedTarget)
    },
    holdCurrentBody: {
      authority: "QUERY_ONLY_COUNTERFACTUAL",
      target: holdTarget,
      motor: { x: 0, y: 0 },
      distanceFromCompanion: 0
    },
    radialNearestCurrentRelativePose: {
      authority: "QUERY_ONLY_COUNTERFACTUAL",
      target: radialNearestTarget,
      motor: motorToward(witnessCompanion, radialNearestTarget),
      distanceFromCompanion: distance(witnessCompanion, radialNearestTarget)
    }
  };
  const retainedVsRadialTargetDivergence = distance(retainedTarget, radialNearestTarget);
  const disturbanceImages = await screenshotPair(page, "post-expiry-disturbance");
  const participantSequence = [
    await captureParticipantSequenceFrame(page, 0, witnessA1.tick)
  ];

  // Release the apparatus completely and observe what the *actual* retained
  // baseline does for four tactical intervals. This is descriptive evidence:
  // contact or additional player displacement is recorded, not pre-judged.
  await setForcedMove(page, null);
  const released = await semantic(page);
  invariant(released.forcedCompanionMove === null, "Apparatus remained armed before recovery observation.");
  const playerAtRelease = { ...witnessPlayer };
  let contactTicks = 0;
  let externalMotionTicks = 0;
  let maxPlayerDisplacementMeters = 0;
  const recoveryReconsiderations = [];
  let lastRecovery = null;

  for (let index = 0; index < 24; index += 1) {
    await singleStep(page, `retained-recovery-${index + 1}`);
    const aligned = await latestAligned(page, `retained recovery ${index + 1}`);
    lastRecovery = aligned;
    invariant(aligned.semanticSnapshot.forcedCompanionMove === null, "Apparatus re-armed during baseline recovery.");
    invariant(aligned.semanticFrame.apparatusApplied === false, "Apparatus executed during baseline recovery.");
    invariant(aligned.semanticFrame.canonicalOrientation?.source === "NONE", "Fresh semantic orientation appeared without Owner input during recovery.");
    invariant(aligned.a1Frame.observation.orientation?.source === "NONE", "A1 gained directional semantics during NONE recovery.");
    invariant(intentsEqual(aligned.a1Frame.baselineCompanionIntent, aligned.a1Frame.selectedCompanionIntent), "A1 changed movement authority during NONE recovery.");

    const body = aligned.a1Frame.situation.situated.playerBody;
    if (body.contacts.includes("companion")) contactTicks += 1;
    if (aligned.a1Frame.situation.situated.playerMotionProvenance.state === "EXTERNAL_MOTION_EVIDENT") externalMotionTicks += 1;
    maxPlayerDisplacementMeters = Math.max(maxPlayerDisplacementMeters, distance(body.position, playerAtRelease));

    const baseline = aligned.semanticFrame.baselineRelationship;
    if (baseline?.reconsideredAtTick === aligned.a1Frame.tick) {
      recoveryReconsiderations.push({
        tick: aligned.a1Frame.tick,
        selectedSlot: baseline.selectedSlot,
        target: baseline.target,
        playerDirection: baseline.playerDirection,
        semanticFrame: baseline.semanticFrame,
        baselineIntent: aligned.a1Frame.baselineCompanionIntent,
        playerPosition: body.position,
        companionPosition: aligned.a1Frame.situation.situated.companionBody.position,
        playerMotionProvenance: aligned.a1Frame.situation.situated.playerMotionProvenance
      });
    }

    if ((index + 1) % 3 === 0) {
      participantSequence.push(
        await captureParticipantSequenceFrame(
          page,
          participantSequence.length,
          aligned.a1Frame.tick
        )
      );
    }
  }
  invariant(lastRecovery !== null, "No post-apparatus recovery frames were observed.");
  invariant(
    participantSequence.length === 9,
    `Expected witness + 8 temporal participant frames, got ${participantSequence.length}.`
  );
  await writeFile(
    `${PARTICIPANT_SEQUENCE_DIR}/manifest.json`,
    JSON.stringify({
      schema: "companion-brain-lab-ph02-post-expiry-participant-sequence-v1",
      sourceSha: process.env.GITHUB_SHA ?? null,
      witnessTick: witnessA1.tick,
      cadenceWorldTicks: 3,
      frames: participantSequence
    }, null, 2)
  );
  const recoveryImages = await screenshotPair(page, "post-expiry-recovery");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-relationship-semantic-post-expiry-disturbance-live-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "open",
    scheduler: "PAUSED_RESET_EXACT_SINGLE_STEP",
    authority: "TEST_APPARATUS_PHYSICAL_PERTURBATION_PLUS_QUERY_ONLY_COUNTERFACTUALS_ZERO_A1_AUTHORITY",
    expiryBaseline: {
      tick: expiryBaseline.a1Frame.tick,
      canonicalOrientation: expiryBaseline.semanticFrame.canonicalOrientation,
      baselineRelationship: expiryBaseline.semanticFrame.baselineRelationship,
      playerPosition: expiryPlayer,
      companionPosition: expiryCompanion
    },
    staging: {
      retainedForward,
      currentRelativeAtExpiry: currentRelative,
      waypoint1,
      waypoint2,
      stageTarget,
      stagedPlayer,
      stagedCompanion
    },
    disturbanceWitness: {
      tick: witnessA1.tick,
      physical: {
        playerControl: witnessA1.situation.situated.playerControl,
        playerBody: witnessA1.situation.situated.playerBody,
        playerMotionProvenance: witnessA1.situation.situated.playerMotionProvenance,
        companionBody: witnessA1.situation.situated.companionBody
      },
      canonicalOrientation: witnessSemantic.canonicalOrientation,
      a1Orientation: witnessA1.observation.orientation,
      baselineRelationship: witnessBaseline,
      prePerturbationCompanionIntent: witnessSemantic.prePerturbationCompanionIntent,
      apparatusExecutedCompanionIntent: witnessSemantic.executedCompanionIntent,
      counterfactuals,
      retainedVsRadialTargetDivergence
    },
    recovery: {
      observedTicks: 24,
      contactTicks,
      externalMotionTicks,
      maxPlayerDisplacementMeters,
      reconsiderations: recoveryReconsiderations,
      finalPlayerPosition: lastRecovery.a1Frame.situation.situated.playerBody.position,
      finalCompanionPosition: lastRecovery.a1Frame.situation.situated.companionBody.position,
      finalBaselineRelationship: lastRecovery.semanticFrame.baselineRelationship
    },
    interpretation: {
      canonicalNoneSurvivedExternalDisturbance: true,
      a1RemainedSemanticallyDirectionless: true,
      solverMotionWasNotPromotedToOwnerMeaning: true,
      retainedFrameWasReconsideredAgainstDisturbedLiveState: true,
      counterfactualsWereQueryOnly: true,
      apparatusWasReleasedBeforeRecoveryObservation: true,
      a1MovementAuthorityChanged: false,
      retainedFrameBehaviorOwnerQualified: false,
      replacementPolicySelected: false
    },
    participantTemporalSequence: {
      schema: "companion-brain-lab-ph02-post-expiry-participant-sequence-v1",
      frameCount: participantSequence.length,
      cadenceWorldTicks: 3,
      firstTick: participantSequence[0]?.tick ?? null,
      lastTick: participantSequence.at(-1)?.tick ?? null
    },
    imageBytes: {
      disturbance: disturbanceImages,
      recovery: recoveryImages
    },
    errors
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[RELATIONSHIP_SEMANTIC_POST_EXPIRY_DISTURBANCE_LIVE] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
