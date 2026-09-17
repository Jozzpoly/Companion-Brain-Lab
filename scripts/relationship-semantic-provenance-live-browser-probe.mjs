import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/relationship-semantic-provenance-live";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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

async function perturbation(page) {
  return page.evaluate(() => window.__relationshipSemanticPerturbationBridge?.snapshot() ?? null);
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
  const perturb = await perturbation(page);
  invariant(a1?.frames?.length > 0, `${label}: no A1.1f frame.`);
  invariant(perturb?.frames?.length > 0, `${label}: no perturbation frame.`);
  const a1Frame = a1.frames.at(-1);
  const perturbFrame = perturb.frames.at(-1);
  invariant(a1Frame.tick === perturbFrame.tick, `${label}: bridge ticks diverged (${a1Frame.tick} vs ${perturbFrame.tick}).`);
  return { a1Frame, perturbFrame, perturb };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during provenance replay.");
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1&semanticpush=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__relationshipSemanticPerturbationBridge?.enabled === true, null, { timeout: 10_000 });

  const initialPerturbation = await perturbation(page);
  invariant(
    initialPerturbation.schema === "companion-brain-lab-relationship-semantic-perturbation-v1",
    "Semantic perturbation bridge schema mismatch."
  );
  invariant(
    initialPerturbation.authority === "TEST_APPARATUS_PHYSICAL_PERTURBATION_NOT_A1_AUTHORITY",
    "Semantic perturbation bridge authority label mismatch."
  );

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "initial pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Head-on contact") && text.includes("PAUSED") && text.includes("A1 OFF"),
    15_000,
    "paused head-on reset"
  );
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("PAUSED") && text.includes("A1 DIRECT") && text.includes("SPATIAL"),
    10_000,
    "paused A1 DIRECT SPATIAL setup"
  );

  // Establish genuine Owner +X semantic truth before any apparatus perturbation.
  await page.keyboard.down("d");
  for (let index = 0; index < 3; index += 1) {
    await singleStep(page, `owner-semantic-warmup-${index + 1}`);
  }
  const warmup = await latestAligned(page, "owner semantic warmup");
  invariant(warmup.a1Frame.situation.situated.playerControl.active === true, "Warmup did not contain active Owner control.");
  invariant(warmup.a1Frame.situation.situated.playerControl.move.x > 0.99, "Warmup Owner control was not +X.");
  invariant(warmup.perturbFrame.canonicalOrientation?.source === "SAME_STEP_OWNER", "Warmup canonical orientation was not same-step Owner evidence.");
  invariant((warmup.perturbFrame.canonicalOrientation?.direction?.x ?? 0) > 0.9, "Warmup canonical orientation did not point +X.");
  invariant((warmup.perturbFrame.baselineRelationship?.playerDirection?.x ?? 0) > 0.9, "Baseline relationship did not consume +X Owner semantics during warmup.");
  invariant(warmup.a1Frame.observation.orientation?.source === "SAME_STEP_OWNER", "A1 did not consume same-step Owner orientation during warmup.");
  invariant((warmup.a1Frame.observation.orientation?.direction?.x ?? 0) > 0.9, "A1 warmup orientation did not point +X.");
  invariant(intentsEqual(warmup.a1Frame.baselineCompanionIntent, warmup.a1Frame.selectedCompanionIntent), "A1 changed live movement authority during warmup.");

  // Explicit research apparatus: force only the companion body command toward -X.
  // The baseline relationship decision and A1 observation have already happened
  // before this wrapper changes the command sent into World.step.
  await page.evaluate(() => window.__relationshipSemanticPerturbationBridge.setForcedCompanionMove({ x: -1, y: 0 }));

  let contactTick = null;
  for (let index = 0; index < 60; index += 1) {
    await singleStep(page, `controlled-approach-${index + 1}`);
    const aligned = await latestAligned(page, `controlled approach ${index + 1}`);
    invariant(aligned.perturbFrame.apparatusApplied === true, "Controlled perturbation was not applied during approach.");
    invariant(aligned.perturbFrame.executedCompanionIntent?.move.x < -0.99, "Controlled perturbation did not execute companion -X.");
    if (aligned.a1Frame.situation.situated.playerBody.contacts.includes("companion")) {
      contactTick = aligned.a1Frame.tick;
      break;
    }
  }
  invariant(contactTick !== null, "Controlled companion -X perturbation did not create player-companion contact within 60 exact ticks.");

  // Release Owner input while the apparatus keeps pushing. We now require a
  // real live state in which the body moves -X with near-zero Owner request and
  // the causal evidence classifies that motion as externally driven.
  await page.keyboard.up("d");
  let witness = null;
  for (let index = 0; index < 24; index += 1) {
    await singleStep(page, `released-owner-push-${index + 1}`);
    const aligned = await latestAligned(page, `released Owner push ${index + 1}`);
    const body = aligned.a1Frame.situation.situated.playerBody;
    const provenance = aligned.a1Frame.situation.situated.playerMotionProvenance;
    if (
      aligned.a1Frame.situation.situated.playerControl.active === false &&
      Math.hypot(body.requestedVelocity.x, body.requestedVelocity.y) < 0.08 &&
      body.actualVelocity.x < -0.15 &&
      body.contacts.includes("companion") &&
      provenance.state === "EXTERNAL_MOTION_EVIDENT"
    ) {
      witness = aligned;
      break;
    }
  }
  invariant(witness !== null, "Controlled live replay did not reach solver-driven player -X evidence after Owner release.");

  const { a1Frame, perturbFrame } = witness;
  invariant(perturbFrame.apparatusApplied === true, "Witness was not produced under explicit apparatus perturbation.");
  invariant(perturbFrame.canonicalOrientation?.source === "OWNER_MEMORY", "Canonical orientation did not preserve bounded Owner memory at solver-push witness.");
  invariant((perturbFrame.canonicalOrientation?.direction?.x ?? 0) > 0.9, "Canonical orientation was rotated by solver-driven -X body motion.");
  invariant(perturbFrame.baselineRelationship?.semanticFrame?.evidenceSource === "OWNER_MEMORY", "Baseline relationship did not report Owner-memory semantic provenance.");
  invariant(perturbFrame.baselineRelationship?.semanticFrame?.frameProvenance === "OWNER_SEMANTIC_EVIDENCE", "Baseline relationship frame provenance was not Owner semantic evidence.");
  invariant((perturbFrame.baselineRelationship?.playerDirection?.x ?? 0) > 0.9, "Baseline relationship promoted solver-driven -X into relationship heading.");
  invariant(a1Frame.observation.orientation?.source === "OWNER_MEMORY", "A1 did not report Owner-memory orientation at solver-push witness.");
  invariant((a1Frame.observation.orientation?.direction?.x ?? 0) > 0.9, "A1 orientation was rotated by solver-driven -X body motion.");
  invariant(a1Frame.observationError === null, `A1 relationship observation error: ${JSON.stringify(a1Frame.observationError)}`);
  invariant(intentsEqual(a1Frame.baselineCompanionIntent, a1Frame.selectedCompanionIntent), "A1 changed live companion movement authority at the witness tick.");
  invariant(intentsEqual(a1Frame.selectedCompanionIntent, perturbFrame.prePerturbationCompanionIntent), "Perturbation wrapper did not preserve the pre-apparatus A1-selected intent for evidence.");
  invariant(perturbFrame.executedCompanionIntent?.move.x < -0.99, "Witness did not execute apparatus-owned companion -X.");

  const participant = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  const research = await page.screenshot({ type: "jpeg", quality: 65, fullPage: true });
  await writeFile(`${ARTIFACT_DIR}/witness-participant.jpg`, participant);
  await writeFile(`${ARTIFACT_DIR}/witness-research.jpg`, research);

  await page.evaluate(() => window.__relationshipSemanticPerturbationBridge.setForcedCompanionMove(null));
  await singleStep(page, "post-perturbation-release");
  const finalPerturbation = await perturbation(page);
  invariant(finalPerturbation.forcedCompanionMove === null, "Perturbation remained armed after explicit release.");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-relationship-semantic-provenance-live-controlled-replay-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "head-on",
    scheduler: "PAUSED_RESET_EXACT_SINGLE_STEP",
    contactTick,
    witnessTick: a1Frame.tick,
    physicalWitness: {
      ownerControlMove: a1Frame.situation.situated.playerControl.move,
      requestedVelocity: a1Frame.situation.situated.playerBody.requestedVelocity,
      actualVelocity: a1Frame.situation.situated.playerBody.actualVelocity,
      contacts: a1Frame.situation.situated.playerBody.contacts,
      motionProvenance: a1Frame.situation.situated.playerMotionProvenance
    },
    semanticWitness: {
      canonicalOrientation: perturbFrame.canonicalOrientation,
      baselineRelationship: {
        playerDirection: perturbFrame.baselineRelationship?.playerDirection ?? null,
        selectedSlot: perturbFrame.baselineRelationship?.selectedSlot ?? null,
        semanticFrame: perturbFrame.baselineRelationship?.semanticFrame ?? null
      },
      a1Orientation: a1Frame.observation.orientation,
      a1ObservationError: a1Frame.observationError
    },
    executionWitness: {
      a1BaselineCompanionIntent: a1Frame.baselineCompanionIntent,
      a1SelectedCompanionIntent: a1Frame.selectedCompanionIntent,
      prePerturbationCompanionIntent: perturbFrame.prePerturbationCompanionIntent,
      apparatusExecutedCompanionIntent: perturbFrame.executedCompanionIntent
    },
    interpretation: {
      solverDrivenBodyMotionObserved: true,
      baselineOwnerMeaningPreserved: true,
      a1OwnerMeaningPreserved: true,
      baselineAndA1ConsumeSameCanonicalOrientation: true,
      a1MovementAuthorityChanged: false,
      physicalPerturbationOwner: "TEST_APPARATUS_ONLY",
      noneExpiryPolicyQualified: false
    },
    imageBytes: {
      participant: participant.length,
      research: research.length
    },
    errors
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[RELATIONSHIP_SEMANTIC_PROVENANCE_LIVE_CONTROLLED] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
