import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep3-ph03-sustained-slow-walk";
const PARTICIPANT_DIR = `${ARTIFACT_DIR}/participant`;
const RESEARCH_DIR = `${ARTIFACT_DIR}/research`;
const OWNER_SCALE = 0.2;
const TOTAL_TICKS = 360;
const INCIDENT_WINDOW = 240;
const EXPECTED_INCIDENT_START_TICK = TOTAL_TICKS - INCIDENT_WINDOW;
const SCREENSHOT_EVERY = 20;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function magnitude(v) {
  return Math.hypot(v.x, v.y);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function panelTick(text) {
  const match = text.match(/tick\s+(\d+)/);
  return match ? Number(match[1]) : null;
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
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2400))}`);
}

async function currentTick(page) {
  const tick = panelTick(await panelText(page));
  invariant(Number.isInteger(tick), "Could not parse World tick from panel.");
  return tick;
}

async function singleStep(page, expectedTick) {
  const before = await currentTick(page);
  invariant(before === expectedTick, `PH-03 M1 tick drift: expected ${expectedTick}, got ${before}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(
    page,
    (text) => panelTick(text) === expectedTick + 1,
    15_000,
    `PH-03 M1 single-step t${expectedTick}->${expectedTick + 1}`
  );
}

async function setOwnerScale(page) {
  await page.waitForFunction(
    () => window.__ownerControlScaleBrowserBridge?.enabled === true,
    null,
    { timeout: 10_000 }
  );
  await page.evaluate((value) => window.__ownerControlScaleBrowserBridge.setScale(value), OWNER_SCALE);
  const snapshot = await page.evaluate(() => window.__ownerControlScaleBrowserBridge.snapshot());
  invariant(snapshot.scale === OWNER_SCALE, "PH-03 M1 Owner scale mismatch.");
  invariant(
    snapshot.authority === "TEST_APPARATUS_OWNER_CONTROL_MAGNITUDE_ONLY",
    "PH-03 M1 Owner scale authority label changed."
  );
  return snapshot;
}

async function captureIncident(page, targetPath) {
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator('[data-action="capture-incident"]').click();
  const download = await downloadPromise;
  const path = await download.path();
  invariant(path, "PH-03 M1 incident download produced no path.");
  const bytes = await readFile(path);
  await writeFile(targetPath, bytes);
  return JSON.parse(bytes.toString("utf8"));
}

async function captureCanvas(page, dir, index, tick) {
  const file = `frame-${String(index).padStart(3, "0")}-t${String(tick).padStart(3, "0")}.jpg`;
  const bytes = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 78 });
  await writeFile(`${dir}/${file}`, bytes);
  return { tick, file, bytes: bytes.length };
}

function physicalView(frame) {
  return {
    observationTick: frame.observation.worldTick,
    outcomeTick: frame.outcome.worldTick,
    playerControlMove: frame.observation.playerControlMove,
    playerPosition: frame.observation.playerPosition,
    companionPosition: frame.observation.companionPosition,
    companionActualVelocity: frame.observation.companionActualVelocity,
    commandedVelocity: frame.command.commandedVelocity,
    outcomePosition: frame.outcome.companionPosition,
    requestedVelocity: frame.outcome.companionRequestedVelocity,
    outcomeVelocity: frame.outcome.companionActualVelocity,
    contacts: frame.outcome.companionContacts
  };
}

function compareTwinWindow(aFrames, bFrames) {
  invariant(aFrames.length === INCIDENT_WINDOW, `Participant incident expected ${INCIDENT_WINDOW} frames.`);
  invariant(bFrames.length === INCIDENT_WINDOW, `Research incident expected ${INCIDENT_WINDOW} frames.`);
  let maxPositionError = 0;
  let maxVelocityError = 0;

  for (let i = 0; i < INCIDENT_WINDOW; i += 1) {
    const a = physicalView(aFrames[i]);
    const b = physicalView(bFrames[i]);
    invariant(a.observationTick === b.observationTick, `Twin tick mismatch at window index ${i}.`);
    invariant(a.outcomeTick === b.outcomeTick, `Twin outcome mismatch at window index ${i}.`);
    invariant(
      a.playerControlMove.x === b.playerControlMove.x &&
      a.playerControlMove.y === b.playerControlMove.y,
      `Twin Owner control mismatch at t${a.observationTick}.`
    );
    maxPositionError = Math.max(
      maxPositionError,
      distance(a.playerPosition, b.playerPosition),
      distance(a.companionPosition, b.companionPosition),
      distance(a.outcomePosition, b.outcomePosition)
    );
    maxVelocityError = Math.max(
      maxVelocityError,
      distance(a.companionActualVelocity, b.companionActualVelocity),
      distance(a.commandedVelocity, b.commandedVelocity),
      distance(a.requestedVelocity, b.requestedVelocity),
      distance(a.outcomeVelocity, b.outcomeVelocity)
    );
    invariant(JSON.stringify(a.contacts) === JSON.stringify(b.contacts), `Twin contacts differ at t${a.outcomeTick}.`);
  }

  invariant(maxPositionError <= 1e-9, `Research lens changed positions; max error ${maxPositionError}.`);
  invariant(maxVelocityError <= 1e-9, `Research lens changed movement; max error ${maxVelocityError}.`);
  return { maxPositionError, maxVelocityError };
}

function summarizeSteadyWindow(frames) {
  const samples = frames.map((frame) => ({
    tick: frame.observation.worldTick,
    separation: distance(frame.observation.playerPosition, frame.observation.companionPosition),
    companionSpeed: magnitude(frame.observation.companionActualVelocity),
    commandSpeed: magnitude(frame.command.commandedVelocity),
    targetDistance: frame.decision.relationshipTarget
      ? distance(frame.observation.companionPosition, frame.decision.relationshipTarget)
      : null,
    paceLabel: frame.decision.shadowCoordination?.paceLabel ?? null,
    paceDesiredSpeed: frame.decision.shadowCoordination?.desiredSpeed ?? null,
    paceUrgency: frame.decision.shadowCoordination?.paceUrgency ?? null,
    relationshipLabel: frame.decision.relationshipLabel,
    relationshipRevision: frame.decision.relationshipRevision
  }));

  let flips = 0;
  let lastSign = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const delta = samples[i].separation - samples[i - 1].separation;
    const sign = Math.abs(delta) < 1e-4 ? 0 : Math.sign(delta);
    if (sign && lastSign && sign !== lastSign) flips += 1;
    if (sign) lastSign = sign;
  }

  const pace = samples.map((s) => s.paceDesiredSpeed).filter((v) => typeof v === "number");
  return {
    firstTick: samples[0]?.tick ?? null,
    lastTick: samples.at(-1)?.tick ?? null,
    separationStart: samples[0]?.separation ?? null,
    separationEnd: samples.at(-1)?.separation ?? null,
    separationMin: Math.min(...samples.map((s) => s.separation)),
    separationMax: Math.max(...samples.map((s) => s.separation)),
    separationTrendFlips: flips,
    companionSpeedAverage: average(samples.map((s) => s.companionSpeed)),
    companionSpeedMin: Math.min(...samples.map((s) => s.companionSpeed)),
    companionSpeedMax: Math.max(...samples.map((s) => s.companionSpeed)),
    commandSpeedAverage: average(samples.map((s) => s.commandSpeed)),
    targetDistanceMin: Math.min(...samples.map((s) => s.targetDistance ?? Number.POSITIVE_INFINITY)),
    targetDistanceMax: Math.max(...samples.map((s) => s.targetDistance ?? 0)),
    shadowPaceDesiredMin: pace.length ? Math.min(...pace) : null,
    shadowPaceDesiredMax: pace.length ? Math.max(...pace) : null,
    shadowPaceLabels: [...new Set(samples.map((s) => s.paceLabel).filter(Boolean))],
    relationshipLabels: [...new Set(samples.map((s) => s.relationshipLabel).filter(Boolean))],
    samples
  };
}

async function runTwin({ browser, research }) {
  const dir = research ? RESEARCH_DIR : PARTICIPANT_DIR;
  await mkdir(dir, { recursive: true });
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

  const query = research ? "?ownerscale=1&a1debug=1" : "?ownerscale=1";
  await page.goto(`http://127.0.0.1:4173/${query}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  const scale = await setOwnerScale(page);

  if (research) {
    await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  }

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "PH-03 M1 pause");
  await page.locator('[data-action="scenario-open"]').click();
  await waitForPanel(
    page,
    (text) =>
      text.includes("scenario Open field") &&
      text.includes("PAUSED") &&
      text.includes("mode SPATIAL") &&
      text.includes("actuator NATURAL") &&
      text.includes("A1 OFF") &&
      panelTick(text) === 0,
    15_000,
    "PH-03 M1 reset"
  );

  if (research) {
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(page, (text) => text.includes("A1 DIRECT") && text.includes("PAUSED"), 10_000, "PH-03 M1 A1 pass-through");
  }

  const manifest = [];
  let imageIndex = 0;
  manifest.push(await captureCanvas(page, dir, imageIndex++, 0));

  await page.keyboard.down("d");
  let tick = 0;
  for (let i = 0; i < TOTAL_TICKS; i += 1) {
    await singleStep(page, tick);
    tick += 1;
    if (tick % SCREENSHOT_EVERY === 0 || tick === TOTAL_TICKS) {
      manifest.push(await captureCanvas(page, dir, imageIndex++, tick));
    }
  }
  await page.keyboard.up("d");

  const incident = await captureIncident(page, `${dir}/incident.json`);
  invariant(incident.schema === "companion-brain-lab-owner-sandbox-incident-v1", "PH-03 M1 incident schema mismatch.");
  invariant(incident.capture.tick === TOTAL_TICKS, "PH-03 M1 capture tick mismatch.");
  invariant(incident.capture.scenario === "open", "PH-03 M1 scenario mismatch.");
  invariant(incident.capture.actuator === "natural", "PH-03 M1 requires NATURAL actuator.");
  invariant(incident.capture.a1Variant === (research ? "direct" : "off"), "PH-03 M1 A1 variant mismatch.");
  invariant(incident.frames.length === INCIDENT_WINDOW, `PH-03 M1 expected ${INCIDENT_WINDOW} incident frames, got ${incident.frames.length}.`);
  invariant(
    incident.frames[0]?.observation.worldTick === EXPECTED_INCIDENT_START_TICK,
    `PH-03 M1 incident should begin at t${EXPECTED_INCIDENT_START_TICK}.`
  );
  invariant(
    incident.frames.at(-1)?.observation.worldTick === TOTAL_TICKS - 1,
    "PH-03 M1 incident final observation tick mismatch."
  );

  for (const frame of incident.frames) {
    const move = frame.observation.playerControlMove;
    invariant(Math.abs(move.x - OWNER_SCALE) <= 1e-12 && Math.abs(move.y) <= 1e-12, `PH-03 M1 input mismatch at t${frame.observation.worldTick}.`);
  }

  if (process.env.GITHUB_SHA) {
    invariant(incident.build.sourceSha === process.env.GITHUB_SHA, "PH-03 M1 source SHA mismatch.");
    invariant(incident.build.state === "PINNED_SOURCE_SHA", "PH-03 M1 build is not pinned.");
  }

  let a11f = null;
  if (research) {
    a11f = await page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
    invariant(a11f, "PH-03 M1 research Twin lost A1 bridge.");
    invariant(a11f.authority === "PASS_THROUGH_ONLY", "PH-03 M1 research lens gained authority.");
    invariant(a11f.lastBridgeError === null, `PH-03 M1 A1 error: ${a11f.lastBridgeError}`);
    invariant(a11f.frameCount === TOTAL_TICKS, `PH-03 M1 expected ${TOTAL_TICKS} A1 frames, got ${a11f.frameCount}.`);
    invariant(
      a11f.frames.every((frame) => JSON.stringify(frame.baselineCompanionIntent) === JSON.stringify(frame.selectedCompanionIntent)),
      "PH-03 M1 A1 lens changed companion intent."
    );
    await writeFile(`${dir}/a1-1f.json`, JSON.stringify(a11f, null, 2));
  }

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "PH-03 M1 runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `PH-03 M1 page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `PH-03 M1 console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `PH-03 M1 request errors: ${errors.requests.join(" | ")}`);

  await writeFile(`${dir}/manifest.json`, JSON.stringify({
    research,
    ownerScale: scale,
    totalTicks: TOTAL_TICKS,
    incidentWindow: {
      count: INCIDENT_WINDOW,
      firstObservationTick: EXPECTED_INCIDENT_START_TICK,
      lastObservationTick: TOTAL_TICKS - 1
    },
    screenshotEveryTicks: SCREENSHOT_EVERY,
    frames: manifest
  }, null, 2));

  await context.close();
  return { incident, manifest, a11f, errors };
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(PARTICIPANT_DIR, { recursive: true });
  await mkdir(RESEARCH_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const participant = await runTwin({ browser, research: false });
  const research = await runTwin({ browser, research: true });

  const twinNonInterference = compareTwinWindow(participant.incident.frames, research.incident.frames);
  const steadyWindow = summarizeSteadyWindow(participant.incident.frames);

  const summary = {
    schema: "companion-brain-lab-os-prep3-ph03-sustained-slow-walk-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    story: {
      ownerScale: OWNER_SCALE,
      totalTicks: TOTAL_TICKS,
      incidentWindow: INCIDENT_WINDOW,
      incidentStartTick: EXPECTED_INCIDENT_START_TICK
    },
    participant: {
      imageCount: participant.manifest.length,
      incidentFrameCount: participant.incident.frames.length,
      build: participant.incident.build
    },
    research: {
      imageCount: research.manifest.length,
      incidentFrameCount: research.incident.frames.length,
      a11fFrameCount: research.a11f.frameCount,
      a11fAuthority: research.a11f.authority,
      build: research.incident.build
    },
    twinNonInterference,
    steadyWindow,
    interpretationStatus: "UNREAD_PARTICIPANT_FIRST_REQUIRED",
    errors: {
      participant: participant.errors,
      research: research.errors
    }
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP3_PH03_SUSTAINED_SLOW_WALK] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
