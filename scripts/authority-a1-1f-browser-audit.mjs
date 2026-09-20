import { chromium } from "playwright-chromium";
import { preview } from "vite";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function intentsEqual(a, b) {
  return a?.actorId === b?.actorId && a?.move?.x === b?.move?.x && a?.move?.y === b?.move?.y;
}

function percentile(values, fraction) {
  invariant(values.length > 0, "Cannot compute percentile of an empty sample.");
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
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
  return page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
}

async function assertNoFault(page, errors) {
  const sentinel = await page.locator("#runtime-fault-sentinel").count();
  invariant(sentinel === 0, "Runtime fault sentinel became visible during Authority-A1.1f browser audit.");
  invariant(errors.page.length === 0, `Page errors observed: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors observed: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests observed: ${errors.requests.join(" | ")}`);
}

async function waitForFrameCount(page, minimum, timeout = 15_000) {
  await page.waitForFunction(
    (value) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= value,
    minimum,
    { timeout }
  );
}

function validateLiveFrames(frames) {
  invariant(frames.length >= 150, `Too few steady A1.1f decision frames (${frames.length}).`);

  for (const frame of frames) {
    const observation = frame.observation;
    invariant(frame.variant === "direct", `Steady frame t${frame.tick} is not DIRECT.`);
    invariant(intentsEqual(frame.baselineCompanionIntent, frame.selectedCompanionIntent), `A1.1f changed companion authority at t${frame.tick}.`);
    invariant(frame.situation.tick === frame.tick, `A1.1f situation tick diverged at t${frame.tick}.`);
    invariant(observation.lastAttemptTick === frame.tick, `A1.1f attempt clock is stale at t${frame.tick}.`);
    invariant(observation.latestTick === frame.tick, `A1.1f semantic clock is stale at t${frame.tick}.`);
    invariant(observation.semantic?.sourceTick === frame.tick, `A1.1f semantic evidence is not current at t${frame.tick}.`);
    invariant(frame.observationError === null, `A1.1f observer error at t${frame.tick}: ${frame.observationError?.message ?? "unknown"}`);
    invariant(observation.heavy !== null, `A1.1f has no heavy evidence at t${frame.tick}.`);
    invariant(observation.heavyAttempts === observation.heavyEvaluations, `A1.1f normal-path heavy attempts/evaluations diverged at t${frame.tick}.`);
    invariant(observation.heavy.ageTicks === frame.tick - observation.heavy.sourceTick, `A1.1f heavy age provenance is wrong at t${frame.tick}.`);
    invariant(observation.heavy.ageTicks >= 0 && observation.heavy.ageTicks <= 5, `A1.1f heavy evidence exceeded the 6-tick cache contract at t${frame.tick}: age ${observation.heavy.ageTicks}.`);
    invariant(observation.heavy.staticTraversalQueries > 0, `A1.1f heavy projection reported no static traversal work at t${frame.tick}.`);
  }

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    invariant(current.tick === previous.tick + 1, `A1.1f steady World ticks are not contiguous: ${previous.tick} -> ${current.tick}.`);
    invariant(current.observation.observations === previous.observation.observations + 1, `A1.1f observation count is not one-per-World-tick at t${current.tick}.`);
  }

  const heavyFrames = frames.filter((frame) => frame.observation.lastHeavyAttemptTick === frame.tick);
  invariant(heavyFrames.length >= 20, `Too few A1.1f heavy evaluations (${heavyFrames.length}).`);
  for (const frame of heavyFrames) {
    invariant(frame.observation.heavy?.sourceTick === frame.tick, `A1.1f heavy source tick did not refresh on attempt t${frame.tick}.`);
    invariant(frame.observation.heavy?.ageTicks === 0, `A1.1f heavy evidence is not fresh on attempt t${frame.tick}.`);
  }
  for (let index = 1; index < heavyFrames.length; index += 1) {
    const delta = heavyFrames[index].tick - heavyFrames[index - 1].tick;
    invariant(delta === 6, `A1.1f heavy cadence drifted: ${heavyFrames[index - 1].tick} -> ${heavyFrames[index].tick} (${delta} ticks).`);
  }

  return heavyFrames;
}

function classifyTiming(intervals, heavyTimes) {
  const heavy = [];
  const light = [];
  for (const interval of intervals) {
    const containsHeavy = heavyTimes.some((time) => time > interval.startMs && time <= interval.endMs);
    (containsHeavy ? heavy : light).push(interval.durationMs);
  }
  return { heavy, light };
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
    Object.defineProperty(window, "__authorityA11fTimingAudit", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: timing
    });
    let last = null;
    const sample = (now) => {
      if (last !== null) {
        timing.intervals.push({ startMs: last, endMs: now, durationMs: now - last });
        if (timing.intervals.length > 20_000) timing.intervals.shift();
      }
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
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await waitForPanel(page, (text) => text.includes("scenario Open field") && text.includes("A1 OFF"), 15_000, "A1.1f initial OFF state");
  await assertNoFault(page, errors);

  const initial = await bridgeSnapshot(page);
  invariant(initial?.schema === "companion-brain-lab-authority-a1-1f-browser-v1", "A1.1f bridge exposed the wrong schema.");
  invariant(initial.authority === "PASS_THROUGH_ONLY", "A1.1f bridge did not self-identify pass-through authority.");
  invariant(initial.frameCount === 0, `A1 OFF should not publish relationship observations, got ${initial.frameCount}.`);
  invariant(initial.lastBridgeError === null, `A1.1f bridge started with an error: ${initial.lastBridgeError}`);

  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 DIRECT") && text.includes("PASS-THROUGH ONLY"), 10_000, "A1.1f DIRECT activation");
  await waitForFrameCount(page, 8);

  const warm = await bridgeSnapshot(page);
  const directEpoch = warm.frames.at(-1)?.epoch;
  invariant(directEpoch !== undefined, "A1.1f produced no DIRECT epoch evidence.");
  const steadyStartCount = warm.frameCount;
  const steadyStartMs = await page.evaluate(() => performance.now());

  await page.keyboard.down("d");
  await waitForFrameCount(page, steadyStartCount + 60);
  await page.keyboard.up("d");
  await page.keyboard.down("a");
  await waitForFrameCount(page, steadyStartCount + 120);
  await page.keyboard.up("a");
  await waitForFrameCount(page, steadyStartCount + 180);
  const steadyEndMs = await page.evaluate(() => performance.now());

  let live = await bridgeSnapshot(page);
  invariant(live.lastBridgeError === null, `A1.1f bridge recorded an error: ${live.lastBridgeError}`);
  const steadyFrames = live.frames.filter((frame) =>
    frame.epoch === directEpoch &&
    frame.variant === "direct" &&
    frame.publishedAtMs >= steadyStartMs &&
    frame.publishedAtMs <= steadyEndMs
  );
  const heavyFrames = validateLiveFrames(steadyFrames);
  await assertNoFault(page, errors);

  const timingIntervals = await page.evaluate(
    ({ start, end }) => (window.__authorityA11fTimingAudit?.intervals ?? []).filter(
      (interval) => interval.endMs >= start && interval.startMs <= end
    ),
    { start: steadyStartMs, end: steadyEndMs }
  );
  const timing = classifyTiming(timingIntervals, heavyFrames.map((frame) => frame.publishedAtMs));
  invariant(timing.heavy.length >= 15, `Too few heavy-adjacent rAF samples (${timing.heavy.length}).`);
  invariant(timing.light.length >= 30, `Too few light rAF samples (${timing.light.length}).`);

  const heavyP50 = percentile(timing.heavy, 0.50);
  const heavyP95 = percentile(timing.heavy, 0.95);
  const lightP50 = percentile(timing.light, 0.50);
  const lightP95 = percentile(timing.light, 0.95);
  const maximumFrameMs = Math.max(...timingIntervals.map((interval) => interval.durationMs));
  invariant(maximumFrameMs < 250, `Gross steady browser stall observed during A1.1f (${maximumFrameMs}ms).`);
  invariant(heavyP50 <= lightP50 + 25, `A1.1f heavy cadence shows a median hitch: heavy ${heavyP50}ms vs light ${lightP50}ms.`);
  invariant(
    heavyP95 <= Math.max(lightP95 * 2.5, lightP95 + 50),
    `A1.1f heavy cadence shows a p95 hitch: heavy ${heavyP95}ms vs light ${lightP95}ms.`
  );

  const epochBeforeScenarioReset = live.frames.at(-1)?.epoch ?? directEpoch;
  const countBeforeScenarioReset = live.frameCount;
  await page.locator('[data-action="scenario-pillar"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Central pillar") && text.includes("A1 DIRECT"), 15_000, "A1.1f pillar reset");
  await page.waitForFunction(
    ({ count, epoch }) => {
      const frames = window.__authorityA11fBrowserBridge?.snapshot().frames ?? [];
      return frames.length > count && frames.some((frame) => frame.epoch > epoch);
    },
    { count: countBeforeScenarioReset, epoch: epochBeforeScenarioReset },
    { timeout: 10_000 }
  );

  live = await bridgeSnapshot(page);
  const resetFrame = live.frames.find((frame) => frame.epoch > epochBeforeScenarioReset && frame.variant === "direct");
  invariant(resetFrame, "A1.1f scenario reload produced no new epoch evidence.");
  invariant(resetFrame.observation.observations === 1, `A1.1f scenario reset did not restart observation count (${resetFrame.observation.observations}).`);
  invariant(resetFrame.observation.heavyAttempts === 1 && resetFrame.observation.heavyEvaluations === 1, "A1.1f scenario reset did not restart heavy cadence at one successful attempt.");
  invariant(resetFrame.observation.lastAttemptTick === resetFrame.tick, "A1.1f scenario reset first attempt is not current-tick.");
  invariant(resetFrame.observation.semantic?.sourceTick === resetFrame.tick, "A1.1f scenario reset first semantic evidence is stale.");
  invariant(resetFrame.observation.heavy?.sourceTick === resetFrame.tick && resetFrame.observation.heavy?.ageTicks === 0, "A1.1f scenario reset first heavy evidence is not fresh.");
  invariant(intentsEqual(resetFrame.baselineCompanionIntent, resetFrame.selectedCompanionIntent), "A1.1f scenario reset changed baseline companion authority.");
  await assertNoFault(page, errors);

  const directResetEpoch = resetFrame.epoch;
  const countBeforeTemporal = live.frameCount;
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 TEMPORAL"), 10_000, "A1.1f TEMPORAL activation");
  await page.waitForFunction(
    ({ count, epoch }) => {
      const frames = window.__authorityA11fBrowserBridge?.snapshot().frames ?? [];
      return frames.length > count && frames.some((frame) => frame.variant === "temporal" && frame.epoch > epoch);
    },
    { count: countBeforeTemporal, epoch: directResetEpoch },
    { timeout: 10_000 }
  );

  live = await bridgeSnapshot(page);
  const temporal = live.frames.find((frame) => frame.variant === "temporal" && frame.epoch > directResetEpoch);
  invariant(temporal, "A1.1f TEMPORAL produced no observation evidence.");
  invariant(temporal.observation.observations === 1, "A1.1f TEMPORAL transition did not reset observation history.");
  invariant(temporal.observation.heavyAttempts === 1 && temporal.observation.heavyEvaluations === 1, "A1.1f TEMPORAL transition did not reset heavy cadence.");
  invariant(temporal.observation.semantic?.sourceTick === temporal.tick, "A1.1f TEMPORAL first semantic evidence is stale.");
  invariant(temporal.observation.heavy?.sourceTick === temporal.tick && temporal.observation.heavy?.ageTicks === 0, "A1.1f TEMPORAL first heavy evidence is stale.");
  invariant(intentsEqual(temporal.baselineCompanionIntent, temporal.selectedCompanionIntent), "A1.1f TEMPORAL changed baseline companion authority.");

  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(page, (text) => text.includes("A1 OFF"), 10_000, "A1.1f OFF restoration");
  const countAtOff = (await bridgeSnapshot(page)).frameCount;
  await page.waitForTimeout(250);
  const afterOff = await bridgeSnapshot(page);
  invariant(afterOff.frameCount === countAtOff, "A1 OFF continued publishing A1.1f observation evidence.");
  invariant(afterOff.lastBridgeError === null, `A1.1f bridge ended with an error: ${afterOff.lastBridgeError}`);
  await assertNoFault(page, errors);

  console.log(`[AUTHORITY_A1_1F_BROWSER_AUDIT] ${JSON.stringify({
    schema: afterOff.schema,
    browser: await browser.version(),
    steadyDecisionFrames: steadyFrames.length,
    heavyEvaluations: heavyFrames.length,
    heavyCadenceTicks: 6,
    heavyAgeRange: [
      Math.min(...steadyFrames.map((frame) => frame.observation.heavy.ageTicks)),
      Math.max(...steadyFrames.map((frame) => frame.observation.heavy.ageTicks))
    ],
    timing: {
      intervals: timingIntervals.length,
      heavySamples: timing.heavy.length,
      lightSamples: timing.light.length,
      heavyP50,
      heavyP95,
      lightP50,
      lightP95,
      maximumFrameMs
    },
    scenarioReset: {
      epoch: resetFrame.epoch,
      tick: resetFrame.tick,
      observations: resetFrame.observation.observations,
      heavyAttempts: resetFrame.observation.heavyAttempts,
      heavyEvaluations: resetFrame.observation.heavyEvaluations
    },
    temporalReset: {
      epoch: temporal.epoch,
      tick: temporal.tick,
      observations: temporal.observation.observations,
      passThroughExact: intentsEqual(temporal.baselineCompanionIntent, temporal.selectedCompanionIntent)
    },
    offSilent: afterOff.frameCount === countAtOff,
    errors
  })}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
