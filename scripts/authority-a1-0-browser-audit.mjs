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

async function waitForPanel(page, predicate, timeout = 10_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} timed out after ${timeout}ms. Latest panel: ${JSON.stringify(latest.slice(0, 3000))}`);
}

async function bridgeSnapshot(page) {
  return page.evaluate(() => window.__authorityA10BrowserBridge?.snapshot() ?? null);
}

async function assertNoFault(page, errors) {
  const sentinel = await page.locator("#runtime-fault-sentinel").count();
  invariant(sentinel === 0, "Runtime fault sentinel became visible during Authority-A1.0 browser audit.");
  invariant(errors.page.length === 0, `Page errors observed: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors observed: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests observed: ${errors.requests.join(" | ")}`);
}

function findSameTickReversal(frames) {
  return frames.find((frame) => {
    const current = frame.situation.playerRequestedVelocity.velocity;
    const previous = frame.situation.previousOutcome?.playerBody.requestedVelocity;
    return current.x < -2.9 && Math.abs(current.y) < 0.05 &&
      previous?.x > 2.9 && Math.abs(previous.y) < 0.05 &&
      frame.situation.playerRequestedVelocity.sourceTick === frame.tick &&
      frame.situation.previousOutcome?.outcomeTick === frame.tick;
  }) ?? null;
}

const server = await preview({
  logLevel: "error",
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
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

  await page.addInitScript(() => {
    const timing = { intervals: [] };
    Object.defineProperty(window, "__authorityA10TimingAudit", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: timing
    });
    let last = performance.now();
    const sample = (now) => {
      timing.intervals.push(now - last);
      if (timing.intervals.length > 20_000) timing.intervals.shift();
      last = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("http://127.0.0.1:4173/?a1debug=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA10BrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await waitForPanel(page, (text) => text.includes("scenario Open field") && text.includes("A1 OFF"), 15_000, "A1 OFF initial state");
  await assertNoFault(page, errors);

  const initial = await bridgeSnapshot(page);
  invariant(initial?.schema === "companion-brain-lab-authority-a1-0-browser-v1", "A1.0 bridge exposed the wrong schema.");
  invariant(initial.authority === "PASS_THROUGH_ONLY", "A1.0 bridge did not self-identify pass-through authority.");
  invariant(initial.frameCount === 0, `A1 OFF should not record decision situations, got ${initial.frameCount}.`);
  invariant(initial.lastError === null, `A1.0 bridge started with an error: ${initial.lastError}`);

  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("A1 DIRECT") && text.includes("PASS-THROUGH ONLY"),
    10_000,
    "A1 DIRECT activation"
  );
  await page.waitForFunction(() => (window.__authorityA10BrowserBridge?.snapshot().frameCount ?? 0) >= 4, null, { timeout: 10_000 });

  let live = await bridgeSnapshot(page);
  invariant(live.lastError === null, `A1.0 bridge recorded an error: ${live.lastError}`);
  invariant(live.frames.every((frame) => frame.variant === "direct"), "A1 DIRECT evidence contains the wrong selector variant.");
  invariant(live.frames.every((frame) => intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent)), "A1 DIRECT scaffold changed a baseline companion intent.");
  invariant(live.frames.every((frame) => frame.situation.tick === frame.tick), "A1 situation tick diverged from decision tick.");
  invariant(live.frames.every((frame) => frame.situation.situated.playerControl.sourceTick === frame.tick), "A1 same-step Owner control is stale.");
  await assertNoFault(page, errors);

  // Establish a completed +X World outcome, then freeze simulation while D is still held.
  await page.keyboard.down("d");
  await page.waitForFunction(() => {
    const latest = window.__authorityA10BrowserBridge?.latest();
    return (latest?.situation.playerRequestedVelocity.velocity.x ?? 0) > 2.9 &&
      (latest?.situation.previousOutcome?.playerBody.requestedVelocity.x ?? 0) > 2.9;
  }, null, { timeout: 10_000 });
  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED") && text.includes("A1 DIRECT"), 10_000, "paused +X state");

  // Change real keyboard state while paused. No World step can consume the intermediate key transition.
  await page.keyboard.up("d");
  await page.keyboard.down("a");
  const beforeReversalStep = await bridgeSnapshot(page);
  const frameCountBeforeReversal = beforeReversalStep.frameCount;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__authorityA10BrowserBridge?.snapshot().frameCount ?? 0) > count,
    frameCountBeforeReversal,
    { timeout: 10_000 }
  );
  await page.keyboard.up("a");

  live = await bridgeSnapshot(page);
  const reversal = findSameTickReversal(live.frames);
  invariant(reversal, "Paused real-keyboard D -> A single-step did not preserve current -X request beside previous +X World outcome.");
  invariant(intentsEqual(reversal.baselineCompanionIntent, reversal.selectedCompanionIntent), "A1 scaffold changed the companion command on the qualified reversal tick.");
  invariant(reversal.situation.previousOutcome.observationTick === reversal.tick - 1, "Previous outcome observation phase is not t-1 on the reversal tick.");
  invariant(reversal.situation.previousOutcome.ageTicks === 0, "Previous completed outcome should be age 0 at the decision boundary.");
  await assertNoFault(page, errors);

  // Still paused: switch to TEMPORAL and advance exactly one step to qualify reset semantics.
  const directEpoch = live.frames.at(-1)?.epoch;
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 TEMPORAL"), 10_000, "A1 TEMPORAL activation");
  const temporalFrameCount = (await bridgeSnapshot(page)).frameCount;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__authorityA10BrowserBridge?.snapshot().frameCount ?? 0) > count,
    temporalFrameCount,
    { timeout: 10_000 }
  );

  live = await bridgeSnapshot(page);
  const temporal = live.frames.filter((frame) => frame.variant === "temporal");
  invariant(temporal.length > 0, "A1 TEMPORAL produced no decision evidence.");
  invariant(temporal.every((frame) => intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent)), "A1 TEMPORAL scaffold changed a baseline companion intent.");
  invariant(temporal[0].epoch > (directEpoch ?? -1), "A1 TEMPORAL did not advance the A1-owned epoch on selector transition.");
  invariant(temporal[0].passThroughSteps === 1, "A1 TEMPORAL did not reset A1-owned pass-through history on selector transition.");

  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 OFF") && text.includes("baseline companion authority is untouched"), 10_000, "A1 OFF restoration");
  const framesAtOff = (await bridgeSnapshot(page)).frameCount;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForTimeout(150);
  const afterOff = await bridgeSnapshot(page);
  invariant(afterOff.frameCount === framesAtOff, "A1 OFF recorded a decision situation during a real single step, indicating the new path still executes.");
  invariant(afterOff.lastError === null, `A1.0 bridge ended with an error: ${afterOff.lastError}`);
  await assertNoFault(page, errors);

  const intervals = await page.evaluate(() => window.__authorityA10TimingAudit?.intervals ?? []);
  const maximumFrameMs = intervals.length > 0 ? Math.max(...intervals) : null;
  invariant(intervals.length > 60, `Too few A1.0 timing samples (${intervals.length}).`);
  invariant(maximumFrameMs !== null && maximumFrameMs < 1000, `Gross browser stall observed during A1.0 audit (${maximumFrameMs}ms).`);

  console.log(`[AUTHORITY_A1_0_BROWSER_AUDIT] ${JSON.stringify({
    schema: live.schema,
    browser: await browser.version(),
    totalDecisionFrames: afterOff.frameCount,
    reversal: {
      tick: reversal.tick,
      currentRequested: reversal.situation.playerRequestedVelocity.velocity,
      previousRequested: reversal.situation.previousOutcome.playerBody.requestedVelocity,
      previousOutcome: [
        reversal.situation.previousOutcome.observationTick,
        reversal.situation.previousOutcome.outcomeTick
      ],
      passThroughExact: intentsEqual(reversal.baselineCompanionIntent, reversal.selectedCompanionIntent)
    },
    temporalReset: {
      firstPassThroughStep: temporal[0].passThroughSteps,
      epoch: temporal[0].epoch
    },
    offSingleStepSilent: afterOff.frameCount === framesAtOff,
    timingSamples: intervals.length,
    maximumFrameMs,
    errors
  })}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
