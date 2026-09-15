import { readFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function magnitude(value) {
  return Math.hypot(value?.x ?? 0, value?.y ?? 0);
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
  return page.evaluate(() => window.__authorityA0BrowserBridge?.incident() ?? null);
}

async function waitForBridgeFrames(page, minimum, timeout = 10_000) {
  await page.waitForFunction(
    (min) => (window.__authorityA0BrowserBridge?.incident().frameCount ?? 0) >= min,
    minimum,
    { timeout }
  );
}

async function waitForHardRouteQualification(page, timeout = 10_000) {
  await page.waitForFunction(() => {
    const incident = window.__authorityA0BrowserBridge?.incident();
    return Boolean(incident?.hardRouteQualification || incident?.hardRouteQualificationError);
  }, null, { timeout });
}

function findOwnerDirectedInput(frames) {
  return frames.find((frame) =>
    frame.situated.playerControl.active &&
    frame.situated.playerControl.move.x > 0.9 &&
    frame.situated.playerControl.sourceTick === frame.observationTick
  ) ?? null;
}

function findZeroInputSolverMotion(frames) {
  return frames.find((frame) =>
    frame.scenarioId === "head-on" &&
    !frame.situated.playerControl.active &&
    magnitude(frame.situated.playerControl.move) < 0.01 &&
    magnitude(frame.playerOutcomeBody.requestedVelocity) < 0.01 &&
    magnitude(frame.playerOutcomeBody.actualVelocity) > 0.1 &&
    frame.playerOutcomeMotionProvenance.state !== "OWNER_DIRECTED" &&
    frame.playerOutcomeMotionProvenance.state !== "STATIONARY"
  ) ?? null;
}

function assertHardRouteQualification(qualification, error, label) {
  invariant(!error, `${label}: hard-route browser qualification failed: ${error}`);
  invariant(qualification, `${label}: hard-route browser qualification is missing.`);
  invariant(qualification.fixture === "narrow-boundary-hard-only-passage-v1", `${label}: unexpected hard-route fixture.`);
  invariant(qualification.evidence.hardReachable === true, `${label}: hard-only route should remain reachable.`);
  invariant(qualification.evidence.desiredReachable === false, `${label}: desired-clearance route should be unavailable in the counterexample.`);
  invariant(qualification.evidence.comfortErasesHardConnectivity === true, `${label}: hard/comfort disagreement was not preserved.`);
  invariant(qualification.evidence.hardStatus === "routed", `${label}: expected routed hard truth, got ${qualification.evidence.hardStatus}.`);
  invariant(qualification.evidence.desiredStatus === "unreachable", `${label}: expected unreachable desired route, got ${qualification.evidence.desiredStatus}.`);
}

async function assertNoFault(page, errors) {
  const sentinel = await page.locator("#runtime-fault-sentinel").count();
  invariant(sentinel === 0, "Runtime fault sentinel became visible during Authority-A0 browser audit.");
  invariant(errors.page.length === 0, `Page errors observed: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors observed: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests observed: ${errors.requests.join(" | ")}`);
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
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true
  });
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
    Object.defineProperty(window, "__authorityA0TimingAudit", {
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

  await page.goto("http://127.0.0.1:4173/?a0debug=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA0BrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await waitForPanel(page, (text) => text.includes("scenario Open field") && /\btick \d+\b/.test(text), 15_000, "open scenario boot");
  await waitForBridgeFrames(page, 4, 10_000);
  await waitForHardRouteQualification(page, 10_000);
  await assertNoFault(page, errors);

  const initial = await bridgeSnapshot(page);
  invariant(initial?.schema === "companion-brain-lab-authority-a0-incident-v1", "A0 bridge exposed the wrong incident schema.");
  invariant(initial.authority === "ZERO_NEW_MOVEMENT_AUTHORITY", "A0 bridge did not self-identify zero authority.");
  invariant(initial.frames.every((frame) => frame.outcomeTick === frame.observationTick + 1), "A0 frame tick phases are not adjacent.");
  invariant(initial.frames.every((frame) => frame.situated.playerCapability.maxSpeed === 3), "Player capability drifted from World truth.");
  invariant(initial.frames.every((frame) => frame.situated.companionCapability.maxSpeed === 3), "Companion capability drifted from World truth.");
  assertHardRouteQualification(initial.hardRouteQualification, initial.hardRouteQualificationError, "live bridge");

  await page.keyboard.down("d");
  await page.waitForTimeout(450);
  await page.keyboard.up("d");
  await page.waitForTimeout(150);
  let live = await bridgeSnapshot(page);
  const ownerDirected = findOwnerDirectedInput(live?.frames ?? []);
  invariant(ownerDirected, "Real D-key input never appeared in Authority-A0 same-step control evidence.");
  invariant(ownerDirected.situated.playerMotionProvenance.state !== "EXTERNAL_MOTION_EVIDENT", "Ordinary owner input was misclassified as externally driven before World.");
  await assertNoFault(page, errors);

  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(page, (text) => text.includes("scenario Head-on contact"), 10_000, "head-on scenario");
  await page.locator('[data-action="cycle-mode"]').click();
  await waitForPanel(page, (text) => text.includes("mode MANUAL"), 10_000, "MANUAL mode");

  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(1_650);
  await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(150);
  live = await bridgeSnapshot(page);
  const solverMotion = findZeroInputSolverMotion(live?.frames ?? []);
  invariant(solverMotion, "Real head-on manual companion push never produced zero-input post-World player solver motion evidence.");
  invariant(solverMotion.playerOutcomeBody.sourceTick === solverMotion.outcomeTick, "Post-World player body evidence carries the wrong source tick.");
  invariant(solverMotion.situated.playerControl.sourceTick === solverMotion.observationTick, "Same-step player control evidence carries the wrong source tick.");
  invariant(solverMotion.playerOutcomeMotionProvenance.state !== "OWNER_DIRECTED", "Solver-induced motion was attributed to the Owner.");
  await assertNoFault(page, errors);

  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  const requestedFileName = await page.evaluate(() => window.__authorityA0BrowserBridge?.downloadIncident() ?? null);
  const download = await downloadPromise;
  const downloadPath = await download.path();
  invariant(requestedFileName, "Browser bridge did not return an incident file name.");
  invariant(downloadPath, "Browser did not materialize the Authority-A0 incident download.");
  invariant(download.suggestedFilename() === requestedFileName, "Downloaded Authority-A0 incident filename diverged from bridge provenance.");

  const incident = JSON.parse(await readFile(downloadPath, "utf8"));
  invariant(incident.schema === "companion-brain-lab-authority-a0-incident-v1", "Downloaded incident schema mismatch.");
  invariant(incident.authority === "ZERO_NEW_MOVEMENT_AUTHORITY", "Downloaded incident lost zero-authority declaration.");
  invariant(incident.frameCount === incident.frames.length && incident.frameCount > 30, "Downloaded incident frame count is inconsistent or too small.");
  invariant(incident.scenarios.includes("open") && incident.scenarios.includes("head-on"), "Downloaded incident does not preserve both exercised scenarios.");
  invariant(findOwnerDirectedInput(incident.frames), "Downloaded incident lost real WASD control provenance.");
  const downloadedSolverMotion = findZeroInputSolverMotion(incident.frames);
  invariant(downloadedSolverMotion, "Downloaded incident lost real zero-input solver-motion evidence.");
  assertHardRouteQualification(incident.hardRouteQualification, incident.hardRouteQualificationError, "downloaded incident");

  const intervals = await page.evaluate(() => window.__authorityA0TimingAudit?.intervals ?? []);
  const maximumFrameMs = intervals.length > 0 ? Math.max(...intervals) : null;
  invariant(intervals.length > 60, `Too few requestAnimationFrame timing samples (${intervals.length}).`);
  invariant(maximumFrameMs !== null && maximumFrameMs < 1000, `Gross browser stall observed with A0 bridge enabled (${maximumFrameMs}ms).`);
  await assertNoFault(page, errors);

  console.log(`[AUTHORITY_A0_BROWSER_AUDIT] ${JSON.stringify({
    schema: incident.schema,
    browser: await browser.version(),
    incidentFile: requestedFileName,
    incidentFrames: incident.frameCount,
    scenarios: incident.scenarios,
    hardRoute: {
      fixture: incident.hardRouteQualification.fixture,
      hardStatus: incident.hardRouteQualification.evidence.hardStatus,
      desiredStatus: incident.hardRouteQualification.evidence.desiredStatus,
      comfortErasesHardConnectivity: incident.hardRouteQualification.evidence.comfortErasesHardConnectivity
    },
    ownerInput: {
      tick: ownerDirected.observationTick,
      move: ownerDirected.situated.playerControl.move,
      provenance: ownerDirected.situated.playerMotionProvenance.state
    },
    solverMotion: {
      observationTick: downloadedSolverMotion.observationTick,
      outcomeTick: downloadedSolverMotion.outcomeTick,
      requestedSpeed: magnitude(downloadedSolverMotion.playerOutcomeBody.requestedVelocity),
      actualSpeed: magnitude(downloadedSolverMotion.playerOutcomeBody.actualVelocity),
      provenance: downloadedSolverMotion.playerOutcomeMotionProvenance.state,
      contacts: downloadedSolverMotion.playerOutcomeBody.contacts
    },
    timingSamples: intervals.length,
    maximumFrameMs,
    errors
  })}`);

  await context.close();
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
