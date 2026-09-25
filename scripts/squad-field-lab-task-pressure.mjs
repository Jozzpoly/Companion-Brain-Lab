import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-task-pressure";
const MAX_TICKS = 520;
const KEY_A = "companion-brain-lab.field-lab.experiment.A.v1";
const KEY_B = "companion-brain-lab.field-lab.experiment.B.v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function waitFor(page, predicate, timeout = 10_000, label = "condition") {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 7000))}`);
}

async function tap(page, key, holdMs = 14) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(10);
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function rightClickWorld(page, canvas, world) {
  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable.");
  const point = internalCanvasPoint(box, world);
  await page.mouse.click(point.x, point.y, { button: "right" });
  await page.waitForTimeout(35);
}

function taskState(text) {
  const match = text.match(
    /phase (IDLE|ACTIVE|COMPLETED|SETTLED) · station (\d+)\/(\d+) · progress (\d+)\/(\d+)t[\s\S]*?player (COMMITTED|outside) · task (CONTESTED|clear)[\s\S]*?player↔hostile contact (YES|no)/
  );
  if (!match) return null;
  return {
    phase: match[1],
    station: Number(match[2]),
    stationCount: Number(match[3]),
    progress: Number(match[4]),
    required: Number(match[5]),
    committed: match[6] === "COMMITTED",
    contested: match[7] === "CONTESTED",
    playerHostileContact: match[8] === "YES"
  };
}

async function runStrategy(page, canvas, slot, dynamicReposition) {
  const button = page.locator(`[data-trial-toggle="${slot}"]`);
  await button.click();
  await waitFor(page, (value) => value.includes(`recording ${slot}`), 8_000, `trace ${slot} starts`);

  let tick = 0;
  let stage2Tick = null;
  let playerCommittedToStage2Tick = null;
  let completionTick = null;
  let settledTick = null;
  let contestedStage2Ticks = 0;
  let playerContactStage2Ticks = 0;
  let maxStage2Progress = 0;
  let latest = null;

  const step = async () => {
    await tap(page, "o");
    tick += 1;
    const text = await panelText(page);
    latest = taskState(text);
    invariant(latest, `task state missing during trace ${slot} tick ${tick}`);

    if (latest.station === 2) {
      if (stage2Tick === null) stage2Tick = tick;
      maxStage2Progress = Math.max(maxStage2Progress, latest.progress);
      if (latest.contested) contestedStage2Ticks += 1;
      if (latest.playerHostileContact) playerContactStage2Ticks += 1;
      if (playerCommittedToStage2Tick === null && latest.committed) {
        playerCommittedToStage2Tick = tick;
      }
    }
    if (completionTick === null && (latest.phase === "COMPLETED" || latest.phase === "SETTLED")) {
      completionTick = tick;
    }
    if (settledTick === null && latest.phase === "SETTLED") settledTick = tick;
    return { text, state: latest };
  };

  while (tick < 190 && stage2Tick === null) await step();
  invariant(stage2Tick !== null, `${slot} never completed Station A`);

  let repositionArrivalTick = null;
  if (dynamicReposition) {
    await rightClickWorld(page, canvas, { x: 10.15, y: 5.25 });
    for (let index = 0; index < 90 && tick < MAX_TICKS; index += 1) {
      const { text } = await step();
      if (text.includes("C1 MOVE") && text.includes("ARRIVED")) {
        repositionArrivalTick = tick;
        break;
      }
    }
    invariant(repositionArrivalTick !== null, "Dynamic C1 reposition did not arrive before Station B commitment.");
    await page.locator('[data-order-mode="HOLD"]').click();
    await waitFor(page, (value) => value.includes("C1 HOLD"), 3_000, "C1 holds second screen");
  }

  await page.keyboard.down("s");
  for (let index = 0; index < 105 && tick < MAX_TICKS; index += 1) {
    const { state } = await step();
    if (state.station === 2 && state.committed) break;
  }
  await page.keyboard.up("s");
  invariant(
    latest?.station === 2 && latest.committed,
    `${slot} player failed to commit to Station B: ${JSON.stringify(latest)}`
  );

  while (tick < MAX_TICKS && settledTick === null) await step();

  await button.click();
  await waitFor(page, (value) => value.includes("not recording"), 5_000, `trace ${slot} stops`);

  return {
    totalTicks: tick,
    stage2Tick,
    playerCommittedToStage2Tick,
    repositionArrivalTick,
    maxStage2Progress,
    contestedStage2Ticks,
    playerContactStage2Ticks,
    completionTick,
    settledTick,
    final: latest
  };
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4179, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.addInitScript(({ keyA, keyB }) => {
    localStorage.removeItem(keyA);
    localStorage.removeItem(keyB);
  }, { keyA: KEY_A, keyB: KEY_B });

  await page.goto("http://127.0.0.1:4179/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (value) => value.includes("scenario squad-field-lab"), 8_000, "Field Lab ready");

  await tap(page, "p");
  await waitFor(page, (value) => value.includes("PAUSED"), 3_000, "pause setup");
  await page.locator('[data-situation="TASK_PRESSURE"]').click();
  await waitFor(
    page,
    (value) => value.includes("scenario squad-field-lab-task-pressure"),
    8_000,
    "task pressure situation"
  );
  await page.locator('[data-layout="OPEN"]').click();
  await waitFor(page, (value) => value.includes("layout OPEN · obstacles 0"), 6_000, "open task layout");
  await page.locator('[data-squad-size="1"]').click();
  await waitFor(page, (value) => value.includes("real squad bodies 1"), 6_000, "single companion");
  await tap(page, "r");
  await waitFor(
    page,
    (value) =>
      value.includes("scenario squad-field-lab-task-pressure") &&
      value.includes("phase IDLE · station 1/2 · progress 0/120t"),
    8_000,
    "two-stage task defaults"
  );

  await page.locator('[data-order-mode="HOLD"]').click();
  await waitFor(page, (value) => value.includes("C1 HOLD"), 4_000, "C1 initial screen HOLD");

  for (const slot of ["A", "B"]) {
    await page.locator(`[data-experiment-capture="${slot}"]`).click();
    const label = page.locator(`[data-experiment-slot="${slot}"] .squad-lab-experiment-label`);
    await label.fill(slot === "A" ? "two-stage · static screen" : "two-stage · manual reposition");
    await label.blur();
  }

  const diff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(diff.includes("identical setup state"), `A/B two-stage starts drifted: ${diff}`);

  const staticScreen = await runStrategy(page, canvas, "A", false);
  const dynamicScreen = await runStrategy(page, canvas, "B", true);

  invariant(
    staticScreen.stage2Tick !== null && dynamicScreen.stage2Tick !== null,
    "Both strategies must complete Station A before the responsibility transfer."
  );
  invariant(
    staticScreen.completionTick === null,
    `Static screen still solved the entire two-stage episode: ${JSON.stringify(staticScreen)}`
  );
  invariant(
    staticScreen.contestedStage2Ticks > 20,
    `Static screen did not expose material Station B pressure: ${JSON.stringify(staticScreen)}`
  );
  invariant(
    dynamicScreen.completionTick !== null,
    `Manual reposition did not restore full two-stage completion: ${JSON.stringify(dynamicScreen)}`
  );
  invariant(
    dynamicScreen.maxStage2Progress >= staticScreen.maxStage2Progress + 25,
    `Manual reposition did not materially improve Station B continuity: static=${staticScreen.maxStage2Progress} dynamic=${dynamicScreen.maxStage2Progress}`
  );
  invariant(
    dynamicScreen.settledTick !== null,
    `Completed two-stage task did not recover to same-world SETTLED: ${JSON.stringify(dynamicScreen)}`
  );

  const comparison = await waitFor(
    page,
    (value) =>
      value.includes("Trial / Trace A/B") &&
      value.includes("ORDERS") &&
      value.includes("C1:MOVE") &&
      value.includes("C1:HOLD"),
    5_000,
    "manual responsibility transfer preserved in trace"
  );
  invariant(
    comparison.includes("C1:MOVE") && comparison.includes("C1:HOLD"),
    "Trace lost the explicit C1 reposition/handoff chain."
  );

  const status = (await page.locator('[data-task-pressure-status="true"]').textContent()) ?? "";
  invariant(
    status.includes("SETTLED") && status.includes("station 2/2") && status.includes("progress 100%"),
    `participant two-stage task status not legible: ${status}`
  );

  await page.screenshot({
    path: `${ROOT}/two-stage-responsibility-transfer.png`,
    type: "png",
    fullPage: true
  });

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-task-pressure-v2",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Does visible task responsibility transfer break the one-static-screen solution while an explicit manual C1 reposition restores task continuity?",
    staticScreen,
    dynamicScreen,
    outcomes: {
      bothStrategiesCompleteStationA: true,
      staticScreenFailsAfterVisibleTransfer: true,
      manualRepositionMateriallyImprovesStationB: true,
      manualRepositionCompletesBothStations: true,
      sameWorldRecoverySettles: true,
      repositionProvenanceSurvivesTrial: true,
      noRepelRequiredForDifference: true
    },
    interpretationBoundary:
      "Machine evidence for one manually authored two-stage situation only. No autonomous screening, teammate feel, general behavior semantic, or Owner qualification.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_TASK_PRESSURE]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
