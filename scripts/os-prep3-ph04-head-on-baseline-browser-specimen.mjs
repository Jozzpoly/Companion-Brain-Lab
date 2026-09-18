import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/os-prep3-ph04-head-on-baseline";
const PARTICIPANT_DIR = `${ARTIFACT_DIR}/participant`;
const RESEARCH_DIR = `${ARTIFACT_DIR}/research`;
const TOTAL_TICKS = 120;
const STEP_SECONDS = 1 / 60;
const PLAYER_SPEED = 3;
const IDEAL_FORWARD_PROGRESS = TOTAL_TICKS * STEP_SECONDS * PLAYER_SPEED;
const SCREENSHOT_EVERY = 6;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function magnitude(v) {
  return Math.hypot(v.x, v.y);
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
  invariant(Number.isInteger(tick), "Could not parse World tick.");
  return tick;
}

async function singleStep(page, expectedTick) {
  const before = await currentTick(page);
  invariant(before === expectedTick, `PH-04 tick drift before step: expected ${expectedTick}, got ${before}.`);
  await page.locator('[data-action="single-step"]').click();
  await waitForPanel(
    page,
    (text) => panelTick(text) === expectedTick + 1,
    15_000,
    `PH-04 single-step t${expectedTick}->${expectedTick + 1}`
  );
}

async function captureIncident(page, targetPath) {
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator('[data-action="capture-incident"]').click();
  const download = await downloadPromise;
  const path = await download.path();
  invariant(path, "PH-04 incident download produced no local path.");
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
    companionOutcomePosition: frame.outcome.companionPosition,
    companionRequestedVelocity: frame.outcome.companionRequestedVelocity,
    companionOutcomeVelocity: frame.outcome.companionActualVelocity,
    contacts: frame.outcome.companionContacts
  };
}

function compareTwins(aFrames, bFrames) {
  invariant(aFrames.length === TOTAL_TICKS && bFrames.length === TOTAL_TICKS, "PH-04 Twin frame count mismatch.");
  let maxPositionError = 0;
  let maxVelocityError = 0;
  for (let i = 0; i < TOTAL_TICKS; i += 1) {
    const a = physicalView(aFrames[i]);
    const b = physicalView(bFrames[i]);
    invariant(a.observationTick === b.observationTick, `PH-04 observation tick mismatch at index ${i}.`);
    invariant(a.outcomeTick === b.outcomeTick, `PH-04 outcome tick mismatch at index ${i}.`);
    invariant(
      a.playerControlMove.x === b.playerControlMove.x &&
      a.playerControlMove.y === b.playerControlMove.y,
      `PH-04 Owner input mismatch at t${a.observationTick}.`
    );
    maxPositionError = Math.max(
      maxPositionError,
      distance(a.playerPosition, b.playerPosition),
      distance(a.companionPosition, b.companionPosition),
      distance(a.companionOutcomePosition, b.companionOutcomePosition)
    );
    maxVelocityError = Math.max(
      maxVelocityError,
      distance(a.companionActualVelocity, b.companionActualVelocity),
      distance(a.commandedVelocity, b.commandedVelocity),
      distance(a.companionRequestedVelocity, b.companionRequestedVelocity),
      distance(a.companionOutcomeVelocity, b.companionOutcomeVelocity)
    );
    invariant(JSON.stringify(a.contacts) === JSON.stringify(b.contacts), `PH-04 contacts differ at t${a.outcomeTick}.`);
  }
  invariant(maxPositionError <= 1e-9, `PH-04 research lens changed positions; max error ${maxPositionError}.`);
  invariant(maxVelocityError <= 1e-9, `PH-04 research lens changed movement; max error ${maxVelocityError}.`);
  return { maxPositionError, maxVelocityError };
}

function hasPlayerContact(frame) {
  return frame.observation.companionContacts.includes("player") ||
    frame.outcome.companionContacts.includes("player");
}

function summarizeBehavior(frames) {
  const first = frames[0];
  const last = frames.at(-1);
  invariant(first && last, "PH-04 incident has no frames.");

  const start = first.observation.playerPosition;
  const end = last.outcome.worldTick === TOTAL_TICKS
    ? {
        x: last.observation.playerPosition.x + (last.observation.playerControlMove.x * PLAYER_SPEED * STEP_SECONDS),
        y: last.observation.playerPosition.y
      }
    : last.observation.playerPosition;

  // Use actual observation positions for per-step progress. The final one-step estimate above
  // is not used for the primary deficit; it is retained only as a diagnostic.
  const actualForwardProgress = last.observation.playerPosition.x - start.x;
  const forwardProgressDeficit = IDEAL_FORWARD_PROGRESS - actualForwardProgress;
  const maxLateralDeviation = Math.max(
    ...frames.map((frame) => Math.abs(frame.observation.playerPosition.y - start.y))
  );
  const contactTicks = frames.filter(hasPlayerContact).map((frame) => frame.observation.worldTick);

  let stalledTicks = 0;
  let backwardTicks = 0;
  let minimumStepProgress = Number.POSITIVE_INFINITY;
  let maximumStepProgress = Number.NEGATIVE_INFINITY;
  const stepProgress = [];
  for (let i = 1; i < frames.length; i += 1) {
    const delta = frames[i].observation.playerPosition.x - frames[i - 1].observation.playerPosition.x;
    stepProgress.push({ tick: frames[i].observation.worldTick, delta });
    minimumStepProgress = Math.min(minimumStepProgress, delta);
    maximumStepProgress = Math.max(maximumStepProgress, delta);
    if (delta < -1e-5) backwardTicks += 1;
    if (delta < PLAYER_SPEED * STEP_SECONDS * 0.2) stalledTicks += 1;
  }

  const shadowSamples = frames
    .map((frame) => frame.decision.shadowCoordination)
    .filter(Boolean)
    .map((shadow) => ({
      shadowTick: shadow.shadowTick,
      ageTicks: shadow.ageTicks,
      preferredFlowConflictState: shadow.preferredFlowConflictState,
      authoritativeFlowConflictState: shadow.authoritativeFlowConflictState,
      authoritativePhysicalClearance: shadow.authoritativeFlowPhysicalClearance,
      authoritativeComfortClearance: shadow.authoritativeFlowComfortClearance
    }));

  return {
    initialPlayerPosition: start,
    finalObservedPlayerPosition: last.observation.playerPosition,
    finalOneStepDiagnosticEstimate: end,
    idealForwardProgress: IDEAL_FORWARD_PROGRESS,
    actualForwardProgress,
    forwardProgressDeficit,
    forwardProgressFraction: actualForwardProgress / IDEAL_FORWARD_PROGRESS,
    maxLateralDeviation,
    contactTickCount: contactTicks.length,
    firstContactTick: contactTicks[0] ?? null,
    lastContactTick: contactTicks.at(-1) ?? null,
    backwardTicks,
    stalledTicks,
    minimumStepProgress,
    maximumStepProgress,
    stepProgress,
    shadowSamples
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

  const url = research
    ? "http://127.0.0.1:4173/?a1debug=1"
    : "http://127.0.0.1:4173/";

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });

  if (research) {
    await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });
  }

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "PH-04 initial pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(
    page,
    (text) =>
      text.includes("scenario Head-on contact") &&
      text.includes("PAUSED") &&
      text.includes("mode SPATIAL") &&
      text.includes("actuator NATURAL") &&
      text.includes("A1 OFF") &&
      panelTick(text) === 0,
    15_000,
    "PH-04 head-on reset"
  );

  if (research) {
    await page.locator('[data-action="cycle-a1-authority"]').click();
    await waitForPanel(
      page,
      (text) => text.includes("PAUSED") && text.includes("A1 DIRECT"),
      10_000,
      "PH-04 A1 pass-through research lens"
    );
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
  invariant(incident.schema === "companion-brain-lab-owner-sandbox-incident-v1", "PH-04 incident schema mismatch.");
  invariant(incident.capture.scenario === "head-on", "PH-04 incident scenario mismatch.");
  invariant(incident.capture.tick === TOTAL_TICKS, "PH-04 capture tick mismatch.");
  invariant(incident.capture.mode === "spatial", "PH-04 requires SPATIAL mode.");
  invariant(incident.capture.actuator === "natural", "PH-04 requires NATURAL actuator.");
  invariant(incident.capture.a1Variant === (research ? "direct" : "off"), "PH-04 A1 variant mismatch.");
  invariant(incident.frames.length === TOTAL_TICKS, `PH-04 expected ${TOTAL_TICKS} frames, got ${incident.frames.length}.`);

  for (const frame of incident.frames) {
    invariant(
      Math.abs(frame.observation.playerControlMove.x - 1) <= 1e-12 &&
      Math.abs(frame.observation.playerControlMove.y) <= 1e-12,
      `PH-04 Owner +X mismatch at t${frame.observation.worldTick}.`
    );
  }

  if (process.env.GITHUB_SHA) {
    invariant(incident.build.sourceSha === process.env.GITHUB_SHA, "PH-04 source SHA mismatch.");
    invariant(incident.build.state === "PINNED_SOURCE_SHA", "PH-04 CI build is not pinned.");
  }

  let a11f = null;
  if (research) {
    a11f = await page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
    invariant(a11f, "PH-04 research Twin lost A1 bridge.");
    invariant(a11f.authority === "PASS_THROUGH_ONLY", "PH-04 A1 research lens gained authority.");
    invariant(a11f.lastBridgeError === null, `PH-04 A1 bridge error: ${a11f.lastBridgeError}`);
    invariant(a11f.frameCount === TOTAL_TICKS, `PH-04 expected ${TOTAL_TICKS} A1 frames, got ${a11f.frameCount}.`);
    invariant(
      a11f.frames.every((frame) =>
        JSON.stringify(frame.baselineCompanionIntent) === JSON.stringify(frame.selectedCompanionIntent)
      ),
      "PH-04 A1 research lens changed selected companion intent."
    );
    await writeFile(`${dir}/a1-1f.json`, JSON.stringify(a11f, null, 2));
  }

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "PH-04 runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `PH-04 page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `PH-04 console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `PH-04 request errors: ${errors.requests.join(" | ")}`);

  await writeFile(
    `${dir}/manifest.json`,
    JSON.stringify({
      research,
      story: {
        totalTicks: TOTAL_TICKS,
        stepSeconds: STEP_SECONDS,
        playerSpeed: PLAYER_SPEED,
        idealForwardProgress: IDEAL_FORWARD_PROGRESS,
        input: { x: 1, y: 0 }
      },
      frames: manifest
    }, null, 2)
  );

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

  const twinNonInterference = compareTwins(participant.incident.frames, research.incident.frames);
  const behavior = summarizeBehavior(participant.incident.frames);

  const summary = {
    schema: "companion-brain-lab-os-prep3-ph04-head-on-baseline-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    authority: {
      gameplay: "BASELINE_SPATIAL_NATURAL",
      a1ResearchTwin: "PASS_THROUGH_ONLY",
      p2: "NOT_ENABLED",
      rightOfWayPolicyClaim: "NONE",
      yieldPolicyClaim: "NONE",
      priorityClaim: "NONE"
    },
    story: {
      totalTicks: TOTAL_TICKS,
      stepSeconds: STEP_SECONDS,
      playerSpeed: PLAYER_SPEED,
      idealForwardProgress: IDEAL_FORWARD_PROGRESS,
      input: { x: 1, y: 0 }
    },
    participant: {
      imageCount: participant.manifest.length,
      frameCount: participant.incident.frames.length,
      build: participant.incident.build
    },
    research: {
      imageCount: research.manifest.length,
      frameCount: research.incident.frames.length,
      a11fFrameCount: research.a11f.frameCount,
      a11fAuthority: research.a11f.authority,
      build: research.incident.build
    },
    twinNonInterference,
    behavior,
    interpretationStatus: "UNREAD_PARTICIPANT_FIRST_REQUIRED",
    errors: {
      participant: participant.errors,
      research: research.errors
    }
  };

  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[OS_PREP3_PH04_HEAD_ON_BASELINE] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
