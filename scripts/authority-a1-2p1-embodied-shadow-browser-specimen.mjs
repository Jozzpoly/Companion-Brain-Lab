import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/a1-2p1";
const HORIZON_SECONDS = 1;

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

async function p1(page) {
  return page.evaluate(() => window.__authorityA12p1BrowserBridge?.snapshot() ?? null);
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

async function requestProjection(page, label) {
  const before = await p1(page);
  invariant(before, `${label}: P1 bridge missing.`);
  const requestId = await page.evaluate(
    (horizonSeconds) => window.__authorityA12p1BrowserBridge.requestProjection(horizonSeconds),
    HORIZON_SECONDS
  );
  await singleStep(page, `${label} projection step`);
  await page.waitForFunction(
    (id) => window.__authorityA12p1BrowserBridge?.snapshot().latest?.requestId === id,
    requestId,
    { timeout: 20_000 }
  );

  const bridge = await p1(page);
  invariant(bridge.lastError === null, `${label}: P1 probe error: ${bridge.lastError}`);
  invariant(bridge.latest?.requestId === requestId, `${label}: wrong completed P1 request.`);
  invariant(bridge.pendingRequestId === null, `${label}: P1 request remained pending.`);
  const evidence = bridge.latest;
  const projection = evidence.projection;
  invariant(projection.sourceTick === evidence.tick, `${label}: projection source tick misaligned.`);
  invariant(projection.horizonSeconds === HORIZON_SECONDS, `${label}: projection horizon changed.`);
  invariant(projection.semantics.selection === "NONE_SHOW_ALL_FRONTIER_MEMBERS_P1", `${label}: projection invented selection.`);
  invariant(projection.semantics.tieBreak === "NONE_P1", `${label}: projection invented tie-break.`);
  invariant(projection.semantics.sidePreference === "NONE_P1", `${label}: projection invented side preference.`);
  invariant(projection.semantics.liveWorldMutation === "NONE_QUERY_ONLY_REHEARSALS_P1", `${label}: projection claimed live mutation.`);
  invariant(projection.semantics.movementAuthority === "NONE_P1", `${label}: projection claimed movement authority.`);
  invariant(
    JSON.stringify(projection.frontierProposalIds) === JSON.stringify(projection.candidates.map((candidate) => candidate.proposalId)),
    `${label}: embodied candidates do not preserve the full ordered frontier.`
  );
  invariant(projection.candidates.length > 0, `${label}: expected at least one embodied frontier candidate.`);
  invariant(
    projection.candidates.every((candidate) =>
      candidate.frames.length === candidate.worldStepCount &&
      candidate.worldStepCount > 0 &&
      candidate.selectionClaim === "NONE_FRONTIER_MEMBER_ONLY_P1" &&
      candidate.runtimeAuthorityClaim === "NONE_P1" &&
      candidate.physicalEvidenceClaim === "SAME_PHYSICS_H1_GHOST_TRAJECTORY_P1"
    ),
    `${label}: embodied candidate contract mismatch.`
  );

  const live = await a11f(page);
  const liveFrame = live.frames.find((frame) => frame.tick === evidence.tick && frame.variant === evidence.variant);
  invariant(liveFrame, `${label}: no A1.1f live frame aligned to P1 source tick ${evidence.tick}.`);
  invariant(
    intentsEqual(liveFrame.baselineCompanionIntent, liveFrame.selectedCompanionIntent),
    `${label}: A1 changed live companion authority at the projection tick.`
  );
  invariant(
    intentsEqual(liveFrame.selectedCompanionIntent, evidence.selectedCompanionIntent),
    `${label}: P1 observed a different live companion intent.`
  );

  const canvas = page.locator("#game-root canvas");
  const participant = await canvas.screenshot({ type: "jpeg", quality: 70 });
  const research = await page.screenshot({ type: "jpeg", quality: 60, fullPage: true });
  await writeFile(`${ARTIFACT_DIR}/${label}-participant.jpg`, participant);
  await writeFile(`${ARTIFACT_DIR}/${label}-research.jpg`, research);

  return {
    label,
    requestId,
    tick: evidence.tick,
    durationMs: evidence.durationMs,
    playerMove: evidence.situation.situated.playerControl.move,
    frontierState: projection.frontierState,
    frontierProposalIds: projection.frontierProposalIds,
    candidateCount: projection.candidates.length,
    candidates: projection.candidates.map((candidate) => ({
      proposalId: candidate.proposalId,
      commandVelocity: candidate.commandVelocity,
      originFamilies: candidate.originFamilies,
      q: candidate.q,
      paceDelta: candidate.paceDelta,
      g3Status: candidate.g3Status,
      worldStepCount: candidate.worldStepCount,
      contactFrameCount: candidate.contactFrameCount,
      firstCompanionPosition: candidate.frames[0]?.companionPosition ?? null,
      lastCompanionPosition: candidate.frames.at(-1)?.companionPosition ?? null
    })),
    imageBytes: {
      participant: participant.length,
      research: research.length
    }
  };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during P1 specimen.");
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1&a1p1=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA12p1BrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });

  const initialBridge = await p1(page);
  invariant(initialBridge.schema === "companion-brain-lab-authority-a1-2p1-browser-v1", "P1 bridge schema mismatch.");
  invariant(
    initialBridge.authority === "ZERO_MOVEMENT_AUTHORITY_EXPLICIT_EMBODIED_SHADOW_PROBE",
    "P1 bridge authority label mismatch."
  );

  // Deterministic specimen construction: freeze first, reset while paused, then
  // enable A1 pass-through. No real-time frame is allowed to leak into tick 0.
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
    (text) => text.includes("PAUSED") && text.includes("A1 DIRECT") && text.includes("PASS-THROUGH ONLY"),
    10_000,
    "paused A1 DIRECT"
  );

  const probes = [];
  probes.push(await requestProjection(page, "tick-0"));
  invariant(probes[0].tick === 0, `First deterministic P1 projection expected tick 0, got ${probes[0].tick}.`);
  invariant(probes[0].frontierState === "SINGLETON_H1_FRONTIER", `Tick-0 P1 expected singleton H1 frontier, got ${probes[0].frontierState}.`);
  invariant(probes[0].candidateCount === 1, `Tick-0 P1 expected one embodied frontier candidate, got ${probes[0].candidateCount}.`);
  invariant(
    probes[0].candidates[0]?.originFamilies.includes("RELATIVE_TANGENT_NEGATIVE"),
    "Tick-0 P1 singleton did not preserve the qualified H1 negative-tangent provenance."
  );

  // Advance to a nonzero exact live state using seven additional explicit Owner
  // +X steps (the first projection already advanced t0 -> t1).
  await page.keyboard.down("d");
  for (let index = 0; index < 7; index += 1) {
    await singleStep(page, `owner-approach-${index + 2}`);
  }
  probes.push(await requestProjection(page, "tick-8-owner-approach"));
  await page.keyboard.up("d");

  invariant(probes[1].tick === 8, `Second deterministic P1 projection expected tick 8, got ${probes[1].tick}.`);
  invariant(probes[1].playerMove.x === 1 && probes[1].playerMove.y === 0, "Tick-8 P1 did not capture Owner +X input.");
  invariant(probes.every((probe) => probe.durationMs < 5000), `A P1 explicit projection exceeded bounded research latency: ${JSON.stringify(probes.map((probe) => probe.durationMs))}`);

  const finalBridge = await p1(page);
  invariant(finalBridge.requestCount === 2, `Expected 2 P1 requests, got ${finalBridge.requestCount}.`);
  invariant(finalBridge.completedCount === 2, `Expected 2 completed P1 probes, got ${finalBridge.completedCount}.`);
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-authority-a1-2p1-embodied-shadow-browser-specimen-v1",
    authority: finalBridge.authority,
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "head-on",
    horizonSeconds: HORIZON_SECONDS,
    scheduler: "PAUSED_RESET_EXACT_SINGLE_STEP",
    probeCount: probes.length,
    probes,
    semantics: {
      liveExecution: "BASELINE_INTENT_UNCHANGED",
      projection: "FULL_H1_STRUCTURED_FRONTIER_SAME_PHYSICS_GHOSTS",
      horizonSelection: "CALLER_SUPPLIED_VISUALIZATION_HORIZON_ONLY",
      selector: "NONE",
      tieBreak: "NONE",
      sidePreference: "NONE",
      movementAuthority: "NONE"
    },
    errors
  };
  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[AUTHORITY_A1_2P1_EMBODIED_SHADOW_BROWSER] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
