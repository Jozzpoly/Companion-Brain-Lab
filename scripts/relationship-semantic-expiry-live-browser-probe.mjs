import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/relationship-semantic-expiry-live";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  invariant(sem?.frames?.length > 0, `${label}: no semantic bridge frame.`);
  const a1Frame = a1.frames.at(-1);
  const semanticFrame = sem.frames.at(-1);
  invariant(a1Frame.tick === semanticFrame.tick, `${label}: bridge ticks diverged.`);
  invariant(sem.forcedCompanionMove === null, `${label}: physical perturbation must remain disabled.`);
  invariant(semanticFrame.apparatusApplied === false, `${label}: expiry specimen must remain query-only.`);
  return { a1Frame, semanticFrame };
}

async function screenshotPair(page, label) {
  const participant = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  const research = await page.screenshot({ type: "jpeg", quality: 65, fullPage: true });
  await writeFile(`${ARTIFACT_DIR}/${label}-participant.jpg`, participant);
  await writeFile(`${ARTIFACT_DIR}/${label}-research.jpg`, research);
  return { participant: participant.length, research: research.length };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during expiry specimen.");
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

  // Establish a genuine +X relationship frame for long enough to cross one
  // tactical reconsideration, then release Owner control completely.
  await page.keyboard.down("d");
  for (let index = 0; index < 7; index += 1) {
    await singleStep(page, `owner-plus-x-${index + 1}`);
  }
  const established = await latestAligned(page, "established +X");
  invariant(established.semanticFrame.canonicalOrientation?.source === "SAME_STEP_OWNER", "Established frame lacks same-step Owner provenance.");
  invariant((established.semanticFrame.canonicalOrientation?.direction?.x ?? 0) > 0.9, "Established frame is not +X.");
  invariant((established.semanticFrame.baselineRelationship?.playerDirection?.x ?? 0) > 0.9, "Baseline did not establish +X relationship direction.");
  invariant(established.a1Frame.observation.orientation?.source === "SAME_STEP_OWNER", "A1 did not establish +X Owner orientation.");
  await page.keyboard.up("d");

  let lastOwnerMemoryReconsideration = null;
  let firstNoneTick = null;
  let firstNoneReconsideration = null;
  const noneReconsiderations = [];

  for (let index = 0; index < 80; index += 1) {
    await singleStep(page, `silence-${index + 1}`);
    const aligned = await latestAligned(page, `silence ${index + 1}`);
    const canonical = aligned.semanticFrame.canonicalOrientation;
    const baseline = aligned.semanticFrame.baselineRelationship;
    const a1Orientation = aligned.a1Frame.observation.orientation;

    invariant(canonical !== null, "Canonical relationship orientation disappeared from query-only bridge.");
    invariant(a1Orientation !== null, "A1 relationship orientation disappeared during expiry specimen.");

    if (canonical.source === "OWNER_MEMORY" && baseline?.reconsideredAtTick === aligned.a1Frame.tick) {
      lastOwnerMemoryReconsideration = structuredClone(aligned);
    }

    if (canonical.source === "NONE") {
      if (firstNoneTick === null) firstNoneTick = aligned.a1Frame.tick;
      invariant(canonical.direction === null && canonical.strength === 0, "Canonical NONE carried directional semantics.");
      invariant(canonical.samplingBasisSource === "WORLD_AXIS_SAMPLING_ONLY", "Canonical NONE sampling provenance changed.");
      invariant(a1Orientation.source === "NONE", "A1 did not consume canonical NONE orientation.");
      invariant(a1Orientation.direction === null && a1Orientation.strength === 0, "A1 NONE orientation retained directional semantics.");

      if (baseline?.reconsideredAtTick === aligned.a1Frame.tick) {
        invariant(baseline.semanticFrame?.evidenceSource === "NONE", "Baseline NONE reconsideration did not expose NONE evidence source.");
        invariant(baseline.semanticFrame?.frameProvenance === "RETAINED_LAST_SEMANTIC_FRAME", "Baseline NONE reconsideration lost explicit retained-frame provenance.");
        invariant((baseline.playerDirection?.x ?? 0) > 0.9, "Baseline retained frame no longer preserves the last genuine +X direction.");
        noneReconsiderations.push(structuredClone(aligned));
        if (firstNoneReconsideration === null) firstNoneReconsideration = structuredClone(aligned);
      }
    }

    if (noneReconsiderations.length >= 3) break;
  }

  invariant(lastOwnerMemoryReconsideration !== null, "No Owner-memory baseline reconsideration was observed before expiry.");
  invariant(firstNoneTick !== null, "Canonical Owner-memory did not expire to NONE.");
  invariant(firstNoneReconsideration !== null, "Baseline did not reconsider under canonical NONE.");
  invariant(noneReconsiderations.length >= 3, `Expected at least three NONE reconsiderations, got ${noneReconsiderations.length}.`);

  const beforeExpiry = lastOwnerMemoryReconsideration.semanticFrame.baselineRelationship;
  const atExpiry = firstNoneReconsideration.semanticFrame.baselineRelationship;
  const expiryTargetJumpMeters = distance(beforeExpiry.target, atExpiry.target);
  const expiryImages = await screenshotPair(page, "none-retained-frame");

  // Fresh Owner reversal must immediately reclaim canonical/A1 semantic truth.
  // Baseline execution is allowed to wait only for its existing six-tick tactical
  // cadence; the retained frame must not remain sticky beyond that cadence.
  const reversalStartTick = (await a11f(page)).frames.at(-1).tick + 1;
  await page.keyboard.down("a");
  let reversalCanonicalTick = null;
  let reversalBaseline = null;
  let reversalA1 = null;
  for (let index = 0; index < 8; index += 1) {
    await singleStep(page, `fresh-minus-x-${index + 1}`);
    const aligned = await latestAligned(page, `fresh -X ${index + 1}`);
    const canonical = aligned.semanticFrame.canonicalOrientation;
    const baseline = aligned.semanticFrame.baselineRelationship;
    const a1Orientation = aligned.a1Frame.observation.orientation;

    if (reversalCanonicalTick === null) {
      invariant(canonical?.source === "SAME_STEP_OWNER", "Fresh reversal did not immediately reclaim canonical semantic orientation.");
      invariant((canonical?.direction?.x ?? 0) < -0.9, "Fresh reversal canonical direction was not -X.");
      invariant(a1Orientation?.source === "SAME_STEP_OWNER", "A1 did not immediately consume fresh reversal semantics.");
      invariant((a1Orientation?.direction?.x ?? 0) < -0.9, "A1 fresh reversal direction was not -X.");
      reversalCanonicalTick = aligned.a1Frame.tick;
    }

    if (baseline?.reconsideredAtTick === aligned.a1Frame.tick && (baseline.playerDirection?.x ?? 0) < -0.9) {
      reversalBaseline = structuredClone(aligned);
      reversalA1 = structuredClone(a1Orientation);
      break;
    }
  }
  await page.keyboard.up("a");

  invariant(reversalCanonicalTick !== null, "Fresh reversal canonical witness was not observed.");
  invariant(reversalBaseline !== null, "Baseline retained frame was not displaced by fresh -X Owner input within tactical cadence.");
  invariant(reversalBaseline.semanticFrame.baselineRelationship?.semanticFrame?.evidenceSource === "SAME_STEP_OWNER", "Baseline reversal reconsideration did not expose fresh Owner provenance.");
  invariant(reversalBaseline.semanticFrame.baselineRelationship?.semanticFrame?.frameProvenance === "OWNER_SEMANTIC_EVIDENCE", "Baseline reversal did not restore Owner semantic frame provenance.");
  const reversalLatencyTicks = reversalBaseline.a1Frame.tick - reversalCanonicalTick;
  invariant(reversalLatencyTicks >= 0 && reversalLatencyTicks <= 6, `Baseline fresh-reversal latency exceeded tactical cadence: ${reversalLatencyTicks} ticks.`);

  const reversalImages = await screenshotPair(page, "fresh-reversal");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-relationship-semantic-expiry-live-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "open",
    scheduler: "PAUSED_RESET_EXACT_SINGLE_STEP",
    authority: "QUERY_ONLY_ZERO_A1_MOVEMENT_AUTHORITY",
    establishedOwnerDirection: established.semanticFrame.canonicalOrientation,
    firstNoneTick,
    lastOwnerMemoryReconsideration: {
      tick: lastOwnerMemoryReconsideration.a1Frame.tick,
      canonicalOrientation: lastOwnerMemoryReconsideration.semanticFrame.canonicalOrientation,
      baselineRelationship: lastOwnerMemoryReconsideration.semanticFrame.baselineRelationship,
      a1Orientation: lastOwnerMemoryReconsideration.a1Frame.observation.orientation
    },
    firstNoneReconsideration: {
      tick: firstNoneReconsideration.a1Frame.tick,
      canonicalOrientation: firstNoneReconsideration.semanticFrame.canonicalOrientation,
      baselineRelationship: firstNoneReconsideration.semanticFrame.baselineRelationship,
      a1Orientation: firstNoneReconsideration.a1Frame.observation.orientation
    },
    noneReconsiderations: noneReconsiderations.map((entry) => ({
      tick: entry.a1Frame.tick,
      selectedSlot: entry.semanticFrame.baselineRelationship?.selectedSlot ?? null,
      playerDirection: entry.semanticFrame.baselineRelationship?.playerDirection ?? null,
      target: entry.semanticFrame.baselineRelationship?.target ?? null,
      semanticFrame: entry.semanticFrame.baselineRelationship?.semanticFrame ?? null,
      baselineIntent: entry.a1Frame.baselineCompanionIntent,
      selectedIntent: entry.a1Frame.selectedCompanionIntent,
      a1Orientation: entry.a1Frame.observation.orientation
    })),
    expiryTransition: {
      targetJumpMeters: expiryTargetJumpMeters,
      slotBefore: beforeExpiry.selectedSlot,
      slotAfter: atExpiry.selectedSlot,
      retainedDirection: atExpiry.playerDirection
    },
    freshReversal: {
      inputDirection: { x: -1, y: 0 },
      canonicalTick: reversalCanonicalTick,
      baselineReconsiderationTick: reversalBaseline.a1Frame.tick,
      baselineLatencyTicks: reversalLatencyTicks,
      canonicalOrientation: reversalBaseline.semanticFrame.canonicalOrientation,
      baselineRelationship: reversalBaseline.semanticFrame.baselineRelationship,
      a1Orientation: reversalA1
    },
    interpretation: {
      canonicalMemoryActuallyExpires: true,
      a1BecomesSemanticallyDirectionlessAtNone: true,
      baselineRetainedFrameIsExplicitPolicyContinuity: true,
      retainedFramePersistsAcrossMultipleReconsiderations: true,
      freshOwnerInputPreemptsRetainedFrameWithinExistingTacticalCadence: true,
      retainedFrameBehaviorOwnerQualified: false,
      replacementPolicySelected: false
    },
    imageBytes: {
      expiry: expiryImages,
      reversal: reversalImages
    },
    errors
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[RELATIONSHIP_SEMANTIC_EXPIRY_LIVE] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
