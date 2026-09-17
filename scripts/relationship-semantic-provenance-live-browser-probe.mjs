import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/relationship-semantic-provenance-live";
const MAX_APPROACH_STEPS = 120;
const MAX_RELEASE_STEPS = 60;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function magnitude(value) {
  return Math.hypot(value?.x ?? 0, value?.y ?? 0);
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

function contactWithCompanion(frame) {
  return frame?.situation?.situated?.playerBody?.contacts?.includes("companion") ?? false;
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

async function bridge(page) {
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
}

async function singleStep(page, label) {
  const before = await bridge(page);
  invariant(before, `${label}: A1.1f bridge missing.`);
  const expectedCount = before.frameCount + 1;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= count,
    expectedCount,
    { timeout: 15_000 }
  );
  const after = await bridge(page);
  const frame = after?.frames?.at(-1) ?? null;
  invariant(frame, `${label}: no live A1.1f frame after exact step.`);
  invariant(
    intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent),
    `${label}: A1 changed live companion authority at t${frame.tick}.`
  );
  return frame;
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during semantic provenance replay.");
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });

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
    (text) => text.includes("PAUSED") && text.includes("A1 DIRECT") && text.includes("waiting for first SPATIAL decision"),
    10_000,
    "paused A1 DIRECT pre-decision"
  );

  const initial = await bridge(page);
  invariant(initial?.frameCount === 0, "Deterministic replay leaked an A1.1f frame before first exact step.");
  invariant(initial?.authority === "PASS_THROUGH_ONLY", "A1.1f authority label changed.");

  const trace = [];
  let contactTick = null;
  let contamination = null;
  let repairRegression = null;
  let minReleasedActualVelocityX = Number.POSITIVE_INFINITY;
  let releasedContactFrames = 0;

  await page.keyboard.down("d");
  for (let step = 0; step < MAX_APPROACH_STEPS; step += 1) {
    const frame = await singleStep(page, `owner-approach-${step + 1}`);
    const body = frame.situation.situated.playerBody;
    const orientation = frame.observation.orientation;
    trace.push({
      phase: "OWNER_PLUS_X",
      tick: frame.tick,
      ownerMove: frame.situation.situated.playerControl.move,
      requestedVelocity: body.requestedVelocity,
      actualVelocity: body.actualVelocity,
      contacts: body.contacts,
      motionProvenance: frame.situation.situated.playerMotionProvenance,
      orientation,
      baselineCompanionIntent: frame.baselineCompanionIntent,
      selectedCompanionIntent: frame.selectedCompanionIntent
    });
    if (contactWithCompanion(frame)) {
      contactTick = frame.tick;
      break;
    }
  }
  await page.keyboard.up("d");

  for (let step = 0; step < MAX_RELEASE_STEPS && contactTick !== null; step += 1) {
    const frame = await singleStep(page, `owner-release-${step + 1}`);
    const situated = frame.situation.situated;
    const body = situated.playerBody;
    const orientation = frame.observation.orientation;
    const ownerSilent = magnitude(situated.playerControl.move) < 1e-9;
    const inContact = contactWithCompanion(frame);
    const actualX = body.actualVelocity.x;
    minReleasedActualVelocityX = Math.min(minReleasedActualVelocityX, actualX);
    if (inContact) releasedContactFrames += 1;

    trace.push({
      phase: "OWNER_RELEASED",
      tick: frame.tick,
      ownerMove: situated.playerControl.move,
      requestedVelocity: body.requestedVelocity,
      actualVelocity: body.actualVelocity,
      contacts: body.contacts,
      motionProvenance: situated.playerMotionProvenance,
      orientation,
      baselineCompanionIntent: frame.baselineCompanionIntent,
      selectedCompanionIntent: frame.selectedCompanionIntent
    });

    const externallyDrivenNegative =
      ownerSilent &&
      situated.playerMotionProvenance.state === "EXTERNAL_MOTION_EVIDENT" &&
      magnitude(body.requestedVelocity) < 0.08 &&
      actualX < -0.15 &&
      inContact;

    if (externallyDrivenNegative) {
      const orientationPreserved =
        orientation?.source === "OWNER_MEMORY" &&
        (orientation.direction?.x ?? -1) > 0.9;
      if (!orientationPreserved) {
        repairRegression = {
          tick: frame.tick,
          orientation,
          ownerMove: situated.playerControl.move,
          requestedVelocity: body.requestedVelocity,
          actualVelocity: body.actualVelocity,
          motionProvenance: situated.playerMotionProvenance,
          contacts: body.contacts
        };
      } else {
        contamination = {
          tick: frame.tick,
          ownerMove: situated.playerControl.move,
          requestedVelocity: body.requestedVelocity,
          actualVelocity: body.actualVelocity,
          motionProvenance: situated.playerMotionProvenance,
          contacts: body.contacts,
          canonicalA1Orientation: orientation,
          baselineCompanionIntent: frame.baselineCompanionIntent,
          selectedCompanionIntent: frame.selectedCompanionIntent
        };
      }

      const canvas = page.locator("#game-root canvas");
      await writeFile(`${ARTIFACT_DIR}/external-push-participant.jpg`, await canvas.screenshot({ type: "jpeg", quality: 75 }));
      await writeFile(`${ARTIFACT_DIR}/external-push-research.jpg`, await page.screenshot({ type: "jpeg", quality: 65, fullPage: true }));
      break;
    }
  }

  await assertNoFault(page, errors);

  const result = repairRegression
    ? "PROVENANCE_REPAIR_REGRESSION"
    : contamination
      ? "NATURAL_LIVE_REPLAY_OBSERVED"
      : contactTick === null
        ? "NATURAL_REPLAY_NO_CONTACT"
        : "CONTACT_WITHOUT_QUALIFYING_NEGATIVE_EXTERNAL_PUSH";

  const summary = {
    schema: "companion-brain-lab-relationship-semantic-provenance-live-browser-probe-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "head-on",
    scheduler: "PAUSED_RESET_A1_DIRECT_EXACT_SINGLE_STEP",
    authority: "A1_PASS_THROUGH_ONLY",
    result,
    contactTick,
    releasedContactFrames,
    minReleasedActualVelocityX: Number.isFinite(minReleasedActualVelocityX) ? minReleasedActualVelocityX : null,
    contamination,
    repairRegression,
    interpretation: {
      targetFalsifier: "Owner +X -> contact -> Owner release -> solver-driven player -X while semantic orientation remains Owner +X memory",
      baselineAndA1ShareCanonicalOrientation: "STRUCTURALLY_WIRED_IN_R1_COMPUTE_INTENTS_NOT_REPROVEN_BY_THIS_BRIDGE",
      movementAuthority: "NONE_A1_PASS_THROUGH",
      postOwnerMemoryExpiryPolicy: "OUT_OF_SCOPE_NOT_QUALIFIED_BY_THIS_PROBE"
    },
    errors,
    trace
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[RELATIONSHIP_SEMANTIC_PROVENANCE_LIVE_BROWSER] ${JSON.stringify({
    sourceSha: summary.sourceSha,
    result,
    contactTick,
    releasedContactFrames,
    minReleasedActualVelocityX: summary.minReleasedActualVelocityX,
    contaminationTick: contamination?.tick ?? null,
    repairRegressionTick: repairRegression?.tick ?? null
  })}`);

  invariant(!repairRegression, `Live semantic provenance repair regressed at t${repairRegression?.tick}.`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
