import { chromium } from "playwright-chromium";
import { preview } from "vite";
import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT_PATH = "artifacts/a1-2z4g-stage-attribution-trace.json";
const FIRST_CAPTURE_TICK = 7;
const LAST_CAPTURE_TICK = 9;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

function near(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}

function magnitude(value) {
  return Math.hypot(value.x, value.y);
}

function boundedMove(value) {
  const length = magnitude(value);
  return length <= 1 || length === 0
    ? { ...value }
    : { x: value.x / length, y: value.y / length };
}

function commandVelocity(move, maxSpeed) {
  const bounded = boundedMove(move);
  return { x: bounded.x * maxSpeed, y: bounded.y * maxSpeed };
}

function isTangentFamily(value) {
  return value === "RELATIVE_TANGENT_POSITIVE" || value === "RELATIVE_TANGENT_NEGATIVE";
}

function normalizeOrigin(origin) {
  if (isTangentFamily(origin)) return "TANGENT";
  if (origin === "HOLD" || origin === "MAINTAIN_CURRENT") return "HOLD_MAINTAIN";
  if (origin === "PLAYER_FEED_FORWARD") return "PLAYER_FEED_FORWARD";
  if (origin === "RELATIVE_RADIAL_INWARD") return "RADIAL_INWARD";
  if (origin === "RELATIVE_RADIAL_OUTWARD") return "RADIAL_OUTWARD";
  return origin;
}

function proposalHasTangentOrigin(proposal) {
  return proposal.generationOrigins.some((origin) => isTangentFamily(origin.seedFamily));
}

function h1TangentFamilies(proposal) {
  return proposal.h1GenerationOrigins
    .filter((origin) => isTangentFamily(origin.seedFamily))
    .map((origin) => origin.seedFamily);
}

function semanticClasses(result) {
  return [...new Set(
    result.frontierCandidates.flatMap((candidate) => candidate.originFamilies.map(normalizeOrigin))
  )].sort();
}

function assertTraceParity(result, tick) {
  const trace = result.stageTrace;
  invariant(trace?.kind === "A1_H1_PRIMARY_STAGE_ATTRIBUTION_TRACE", `tick ${tick} h=${result.horizonSeconds}: missing stage trace.`);
  invariant(trace.sourceTick === tick, `tick ${tick} h=${result.horizonSeconds}: trace tick misaligned.`);
  invariant(near(trace.horizonSeconds, result.horizonSeconds, 1e-12), `tick ${tick} h=${result.horizonSeconds}: trace horizon misaligned.`);
  invariant(trace.proposalCount === result.proposalCount, `tick ${tick} h=${result.horizonSeconds}: proposal count drifted.`);
  invariant(trace.semantics.computationPath === "SAME_A1_H1_PRIMARY_SHADOW_EVALUATION_PASS", `tick ${tick} h=${result.horizonSeconds}: trace duplicated computation path.`);
  invariant(trace.semantics.tangentIdentity === "POSITIVE_NEGATIVE_PRESERVED_AS_GENERATION_ORIGINS", `tick ${tick} h=${result.horizonSeconds}: tangent identity was collapsed too early.`);
  invariant(trace.semantics.sidePreference === "NONE", `tick ${tick} h=${result.horizonSeconds}: side preference appeared.`);
  invariant(trace.semantics.movementAuthority === "NONE_SHADOW_ONLY", `tick ${tick} h=${result.horizonSeconds}: trace gained movement authority.`);

  const comparableIds = trace.proposals.filter((proposal) => proposal.comparisonEligible).map((proposal) => proposal.proposalId);
  const g4FrontierIds = trace.proposals.filter((proposal) => proposal.g4Frontier).map((proposal) => proposal.proposalId);
  const structuredFrontierIds = trace.proposals.filter((proposal) => proposal.structuredFrontier).map((proposal) => proposal.proposalId);
  invariant(JSON.stringify(comparableIds) === JSON.stringify(result.comparableIds), `tick ${tick} h=${result.horizonSeconds}: comparisonEligible parity failed.`);
  invariant(JSON.stringify(g4FrontierIds) === JSON.stringify(result.g4FrontierIds), `tick ${tick} h=${result.horizonSeconds}: G4 frontier parity failed.`);
  invariant(JSON.stringify(structuredFrontierIds) === JSON.stringify(result.structuredFrontierIds), `tick ${tick} h=${result.horizonSeconds}: structured frontier parity failed.`);

  const h1Tangents = trace.proposals.flatMap(h1TangentFamilies);
  invariant(h1Tangents.includes("RELATIVE_TANGENT_POSITIVE"), `tick ${tick} h=${result.horizonSeconds}: + tangent H1 origin missing.`);
  invariant(h1Tangents.includes("RELATIVE_TANGENT_NEGATIVE"), `tick ${tick} h=${result.horizonSeconds}: - tangent H1 origin missing.`);
}

function semanticAttribution(result) {
  const trace = result.stageTrace;
  const tangentProposals = trace.proposals.filter(proposalHasTangentOrigin);
  const classes = semanticClasses(result);
  return {
    h: result.horizonSeconds,
    finalState: result.shadowDecisionState,
    finalClasses: classes,
    tangentPresentInStructuredFrontier: classes.includes("TANGENT"),
    stageSupport: {
      proposal: tangentProposals.length,
      h1Rehearsed: tangentProposals.filter((proposal) => proposal.h1PhysicalStatus === "REHEARSED").length,
      comparisonEligible: tangentProposals.filter((proposal) => proposal.comparisonEligible).length,
      g4Frontier: tangentProposals.filter((proposal) => proposal.g4Frontier).length,
      structuredFrontier: tangentProposals.filter((proposal) => proposal.structuredFrontier).length
    },
    tangentProposals: tangentProposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      tangentOrigins: proposal.generationOrigins
        .filter((origin) => isTangentFamily(origin.seedFamily))
        .map((origin) => ({
          futureId: origin.futureId,
          futureFamily: origin.futureFamily,
          seedId: origin.seedId,
          taggedSeedId: origin.taggedSeedId,
          seedFamily: origin.seedFamily,
          desiredVelocity: { ...origin.desiredVelocity },
          commandVelocity: { ...origin.commandVelocity },
          capabilityClipped: origin.capabilityClipped
        })),
      h1TangentOrigins: proposal.h1GenerationOrigins
        .filter((origin) => isTangentFamily(origin.seedFamily))
        .map((origin) => ({
          seedId: origin.seedId,
          taggedSeedId: origin.taggedSeedId,
          seedFamily: origin.seedFamily,
          desiredVelocity: { ...origin.desiredVelocity },
          commandVelocity: { ...origin.commandVelocity },
          capabilityClipped: origin.capabilityClipped
        })),
      commandVelocity: { ...proposal.commandVelocity },
      generationOriginCount: proposal.generationOriginCount,
      h1PhysicalStatus: proposal.h1PhysicalStatus,
      h1FutureId: proposal.h1FutureId,
      h1PlayerVelocity: proposal.h1PlayerVelocity ? { ...proposal.h1PlayerVelocity } : null,
      g3Decision: proposal.g3Decision,
      g3Status: proposal.g3Status,
      relationStatus: proposal.relationStatus,
      comparisonEligible: proposal.comparisonEligible,
      q: proposal.q,
      paceDelta: proposal.paceDelta,
      dominatedByProposalIds: [...proposal.dominatedByProposalIds],
      g4Frontier: proposal.g4Frontier,
      qPaceDominatedByProposalIds: [...proposal.qPaceDominatedByProposalIds],
      structuredFrontier: proposal.structuredFrontier
    }))
  };
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
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 1200))}`);
}

async function a11f(page) {
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
}

async function z4c(page) {
  return page.evaluate(() => window.__authorityA12z4cBrowserBridge?.snapshot() ?? null);
}

async function requestProbe(page, expectedTick) {
  const requestId = await page.evaluate(() => window.__authorityA12z4cBrowserBridge.requestProbe());
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (id) => window.__authorityA12z4cBrowserBridge?.snapshot().latest?.requestId === id,
    requestId,
    { timeout: 20_000 }
  );

  const shadow = await z4c(page);
  invariant(shadow?.lastError === null, `tick ${expectedTick}: Z4c probe error: ${shadow?.lastError}`);
  invariant(shadow?.latest?.requestId === requestId, `tick ${expectedTick}: wrong completed request.`);
  const latest = shadow.latest;
  invariant(latest.tick === expectedTick, `expected exact live tick ${expectedTick}, got ${latest.tick}.`);
  invariant(latest.evaluation.sourceTick === latest.tick, `tick ${expectedTick}: evaluation tick misaligned.`);
  invariant(latest.situation.tick === latest.tick, `tick ${expectedTick}: situation tick misaligned.`);
  invariant(latest.situation.situated.playerControl.move.x === 1 && latest.situation.situated.playerControl.move.y === 0,
    `tick ${expectedTick}: same-step Owner +X input missing.`);
  invariant(latest.evaluation.semantics.horizonPolicy === "NONE_SCAN_ONLY", `tick ${expectedTick}: horizon policy appeared.`);
  invariant(latest.evaluation.semantics.tieBreak === "NONE", `tick ${expectedTick}: tie-break appeared.`);
  invariant(latest.evaluation.semantics.sidePreference === "NONE", `tick ${expectedTick}: side preference appeared.`);
  invariant(latest.evaluation.semantics.movementAuthority === "NONE_SHADOW_ONLY", `tick ${expectedTick}: movement authority appeared.`);
  latest.evaluation.results.forEach((result) => assertTraceParity(result, expectedTick));

  const live = await a11f(page);
  const frame = live.frames.find((candidate) => candidate.tick === latest.tick && candidate.variant === latest.variant);
  invariant(frame, `tick ${expectedTick}: missing A1.1f frame at exact probe tick.`);
  invariant(intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent), `tick ${expectedTick}: A1 changed companion authority.`);
  invariant(intentsEqual(frame.selectedCompanionIntent, latest.selectedCompanionIntent), `tick ${expectedTick}: executed intent differs from probe observation.`);

  if (expectedTick < FIRST_CAPTURE_TICK || expectedTick > LAST_CAPTURE_TICK) return null;

  const situated = latest.situation.situated;
  const player = situated.playerBody.position;
  const companion = situated.companionBody.position;
  const baselineMove = { ...frame.baselineCompanionIntent.move };
  const baselineVelocity = commandVelocity(baselineMove, situated.companionCapability.maxSpeed);
  const previous = latest.situation.previousOutcome;

  return {
    tick: latest.tick,
    player: {
      position: { ...player },
      requestedVelocityFromLastCompletedStep: { ...situated.playerBody.requestedVelocity },
      actualVelocity: { ...situated.playerBody.actualVelocity },
      motionError: situated.playerBody.motionError,
      contacts: [...situated.playerBody.contacts],
      currentMotionProvenance: { ...situated.playerMotionProvenance },
      sameStepOwnerRequest: structuredClone(latest.situation.playerRequestedVelocity)
    },
    companion: {
      position: { ...companion },
      requestedVelocityFromLastCompletedStep: { ...situated.companionBody.requestedVelocity },
      actualVelocity: { ...situated.companionBody.actualVelocity },
      motionError: situated.companionBody.motionError,
      contacts: [...situated.companionBody.contacts],
      baselineIntentMove: baselineMove,
      baselineCommandVelocity: baselineVelocity,
      selectedIntentMove: { ...frame.selectedCompanionIntent.move }
    },
    relative: {
      x: companion.x - player.x,
      y: companion.y - player.y,
      distance: Math.hypot(companion.x - player.x, companion.y - player.y)
    },
    previousA0: previous ? {
      scenarioId: previous.scenarioId,
      observationTick: previous.observationTick,
      outcomeTick: previous.outcomeTick,
      ageTicks: previous.ageTicks,
      playerBody: structuredClone(previous.playerBody),
      playerMotionProvenance: { ...previous.playerMotionProvenance },
      companionOutcomeAttribution: structuredClone(previous.companionOutcomeAttribution)
    } : null,
    durationMs: Math.round(latest.durationMs * 1000) / 1000,
    horizons: latest.evaluation.results.map((result) => ({
      horizonSeconds: result.horizonSeconds,
      proposalCount: result.proposalCount,
      comparableIds: [...result.comparableIds],
      g4FrontierIds: [...result.g4FrontierIds],
      structuredFrontierIds: [...result.structuredFrontierIds],
      stageTrace: structuredClone(result.stageTrace),
      semanticAttribution: semanticAttribution(result)
    }))
  };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during Z4g.");
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1&a1z4c=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA12z4cBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "pre-reset pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Head-on contact") && text.includes("PAUSED"), 15_000, "paused head-on reset");
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("A1 DIRECT") && text.includes("DIRECT active · waiting for first SPATIAL decision") && text.includes("PAUSED"),
    10_000,
    "paused pre-decision A1 DIRECT"
  );

  await page.keyboard.down("d");
  const captures = [];
  for (let tick = 0; tick <= LAST_CAPTURE_TICK; tick += 1) {
    const capture = await requestProbe(page, tick);
    if (capture) captures.push(capture);
  }
  await page.keyboard.up("d");

  invariant(captures.length === 3 && captures.every((capture, index) => capture.tick === FIRST_CAPTURE_TICK + index),
    "Z4g did not preserve exact tick 7/8/9 capture sequence.");

  const tick8 = captures.find((capture) => capture.tick === 8);
  invariant(tick8, "Z4g missing tick 8.");
  invariant(tick8.horizons.every((horizon) => !horizon.semanticAttribution.tangentPresentInStructuredFrontier),
    "Z4g failed to reproduce the Z4f tick-8 all-horizon tangent collapse.");

  const tick7 = captures.find((capture) => capture.tick === 7);
  invariant(tick7.horizons.filter((horizon) => horizon.semanticAttribution.tangentPresentInStructuredFrontier).length === 4,
    "Z4g failed to reproduce Z4f tick-7 tangent support in 4/5 horizons.");
  const tick9 = captures.find((capture) => capture.tick === 9);
  invariant(tick9.horizons.filter((horizon) => horizon.semanticAttribution.tangentPresentInStructuredFrontier).length === 1,
    "Z4g failed to reproduce Z4f tick-9 tangent return at the longest horizon.");

  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-authority-a1-2z4g-stage-attribution-trace-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    parentQualifiedZ4fSha: "cde58ee85247e3577c6eb51421d0ac81aaa261c7",
    authority: "ZERO_MOVEMENT_AUTHORITY_RESEARCH_ONLY_STAGE_ATTRIBUTION",
    scenario: "head-on",
    setup: "PAUSE_BEFORE_SCENARIO_RESET_THEN_OWNER_POSITIVE_X_FROM_EXACT_TICK_ZERO",
    capturedTicks: [FIRST_CAPTURE_TICK, LAST_CAPTURE_TICK],
    horizons: [0.5, 0.75, 1, 1.2, 1.5],
    captures,
    semantics: {
      rawProposalIdentity: "PRESERVE_POSITIVE_AND_NEGATIVE_TANGENT_GENERATION_ORIGINS_SEPARATELY",
      semanticGrouping: "GROUP_POSITIVE_AND_NEGATIVE_AS_TANGENT_ONLY_IN_SEMANTIC_ATTRIBUTION",
      h1Primary: true,
      horizonPolicy: "NONE",
      selector: "NONE",
      tieBreak: "NONE",
      sidePreference: "NONE",
      movementAuthority: "NONE"
    },
    errors
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log("[AUTHORITY_A1_2Z4G_STAGE_ATTRIBUTION_TRACE]", JSON.stringify(summary));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
