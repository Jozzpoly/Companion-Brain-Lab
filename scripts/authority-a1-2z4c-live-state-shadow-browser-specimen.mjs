import { chromium } from "playwright-chromium";
import { preview } from "vite";

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
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2500))}`);
}

async function a11f(page) {
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
}

async function z4c(page) {
  return page.evaluate(() => window.__authorityA12z4cBrowserBridge?.snapshot() ?? null);
}

async function waitForA11fCount(page, minimum, timeout = 15_000) {
  await page.waitForFunction(
    (value) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= value,
    minimum,
    { timeout }
  );
}

async function requestPausedProbe(page, label) {
  const before = await z4c(page);
  invariant(before, `${label}: Z4c bridge missing.`);
  const requestId = await page.evaluate(() => window.__authorityA12z4cBrowserBridge.requestProbe());
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (id) => window.__authorityA12z4cBrowserBridge?.snapshot().latest?.requestId === id,
    requestId,
    { timeout: 20_000 }
  );
  const shadow = await z4c(page);
  invariant(shadow.lastError === null, `${label}: Z4c probe error: ${shadow.lastError}`);
  invariant(shadow.latest?.requestId === requestId, `${label}: wrong completed request.`);
  invariant(shadow.pendingRequestId === null, `${label}: request remained pending.`);
  invariant(shadow.latest.evaluation.sourceTick === shadow.latest.tick, `${label}: evaluation tick misaligned.`);
  invariant(shadow.latest.situation.tick === shadow.latest.tick, `${label}: situation tick misaligned.`);
  invariant(shadow.latest.evaluation.semantics.horizonPolicy === "NONE_SCAN_ONLY", `${label}: probe invented horizon policy.`);
  invariant(shadow.latest.evaluation.semantics.tieBreak === "NONE", `${label}: probe invented tie-break.`);
  invariant(shadow.latest.evaluation.semantics.sidePreference === "NONE", `${label}: probe invented side preference.`);
  invariant(shadow.latest.evaluation.semantics.movementAuthority === "NONE_SHADOW_ONLY", `${label}: probe claimed movement authority.`);
  invariant(shadow.latest.evaluation.results.length === 5, `${label}: expected five horizon observations.`);

  const live = await a11f(page);
  const frame = live.frames.find((candidate) => candidate.tick === shadow.latest.tick && candidate.variant === shadow.latest.variant);
  invariant(frame, `${label}: no A1.1f frame aligned to probe t${shadow.latest.tick}.`);
  invariant(intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent), `${label}: A1 changed companion authority at probe tick.`);
  invariant(intentsEqual(frame.selectedCompanionIntent, shadow.latest.selectedCompanionIntent), `${label}: probe observed a different executed companion intent.`);

  return {
    label,
    requestId,
    tick: shadow.latest.tick,
    durationMs: shadow.latest.durationMs,
    playerMove: shadow.latest.situation.situated.playerControl.move,
    playerPosition: shadow.latest.situation.situated.playerBody.position,
    companionPosition: shadow.latest.situation.situated.companionBody.position,
    baselineCompanionMove: frame.baselineCompanionIntent.move,
    horizons: shadow.latest.evaluation.results.map((result) => ({
      horizonSeconds: result.horizonSeconds,
      proposalCount: result.proposalCount,
      decisionState: result.shadowDecisionState,
      frontier: result.frontierCandidates.map((candidate) => ({
        proposalId: candidate.proposalId,
        commandVelocity: candidate.commandVelocity,
        originFamilies: candidate.originFamilies,
        q: candidate.q,
        paceDelta: candidate.paceDelta,
        g3Status: candidate.g3Status
      }))
    }))
  };
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during Z4c.");
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

  const initialBridge = await z4c(page);
  invariant(initialBridge.schema === "companion-brain-lab-authority-a1-2z4c-browser-v1", "Z4c bridge schema mismatch.");
  invariant(initialBridge.authority === "ZERO_MOVEMENT_AUTHORITY_EXPLICIT_RESEARCH_PROBE", "Z4c bridge authority label mismatch.");

  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Head-on contact") && text.includes("A1 OFF"), 15_000, "head-on reset");
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 DIRECT") && text.includes("PASS-THROUGH ONLY"), 10_000, "A1 DIRECT");
  await waitForA11fCount(page, 6);

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED") && text.includes("A1 DIRECT"), 10_000, "initial pause");
  const probes = [];
  probes.push(await requestPausedProbe(page, "settled-live"));

  const countBeforeApproach = (await a11f(page)).frameCount;
  await page.keyboard.down("d");
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForA11fCount(page, countBeforeApproach + 12);
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "approach-12 pause");
  probes.push(await requestPausedProbe(page, "owner-approach-12"));

  const countBeforeLater = (await a11f(page)).frameCount;
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForA11fCount(page, countBeforeLater + 18);
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "approach-30 pause");
  probes.push(await requestPausedProbe(page, "owner-approach-30"));
  await page.keyboard.up("d");

  const finalBridge = await z4c(page);
  invariant(finalBridge.requestCount === 3, `Expected 3 Z4c requests, got ${finalBridge.requestCount}.`);
  invariant(finalBridge.completedCount === 3, `Expected 3 completed Z4c probes, got ${finalBridge.completedCount}.`);
  invariant(probes.every((probe) => probe.durationMs < 5000), `A Z4c explicit probe exceeded bounded research latency: ${JSON.stringify(probes.map((probe) => probe.durationMs))}`);
  invariant(probes[1].playerMove.x === 1 && probes[1].playerMove.y === 0, "Approach probe did not capture same-step Owner +X input.");
  invariant(probes[2].playerMove.x === 1 && probes[2].playerMove.y === 0, "Later approach probe did not capture same-step Owner +X input.");
  await assertNoFault(page, errors);

  console.log("[AUTHORITY_A1_2Z4C_LIVE_STATE_SHADOW]", JSON.stringify({
    schema: "companion-brain-lab-authority-a1-2z4c-browser-specimen-v1",
    authority: finalBridge.authority,
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "head-on",
    probeCount: probes.length,
    probes,
    semantics: {
      liveState: "EXACT_DECISION_FRAME_BEFORE_WORLD_STEP",
      execution: "BASELINE_INTENT_UNCHANGED",
      horizonPolicy: "NONE_SCAN_ONLY",
      sidePreference: "NONE",
      selector: "NONE",
      movementAuthority: "NONE"
    },
    errors
  }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
