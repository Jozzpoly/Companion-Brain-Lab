import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-task-pressure";
const TRACE_TICKS = 300;

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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 6500))}`);
}

async function tap(page, key, holdMs = 16) {
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

async function dragWorld(page, canvas, from, to) {
  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable.");
  const start = internalCanvasPoint(box, from);
  const end = internalCanvasPoint(box, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

function taskState(text) {
  const match = text.match(
    /phase (IDLE|ACTIVE|COMPLETED|SETTLED) · progress (\d+)\/(\d+)t[\s\S]*?player (COMMITTED|outside) · task (CONTESTED|clear)[\s\S]*?player↔hostile contact (YES|no)/
  );
  if (!match) return null;
  return {
    phase: match[1],
    progress: Number(match[2]),
    required: Number(match[3]),
    committed: match[4] === "COMMITTED",
    contested: match[5] === "CONTESTED",
    playerHostileContact: match[6] === "YES"
  };
}

async function runTrace(page, slot) {
  const button = page.locator(`[data-trial-toggle="${slot}"]`);
  await button.click();
  await waitFor(page, (value) => value.includes(`recording ${slot}`), 8_000, `trace ${slot} starts`);

  let maxProgress = 0;
  let contestedTicks = 0;
  let playerContactTicks = 0;
  let completionTick = null;
  let settledTick = null;
  let latest = null;

  for (let tick = 1; tick <= TRACE_TICKS; tick += 1) {
    await tap(page, "o");
    const text = await panelText(page);
    latest = taskState(text);
    invariant(latest, `task state missing during trace ${slot} tick ${tick}`);
    maxProgress = Math.max(maxProgress, latest.progress);
    if (latest.contested) contestedTicks += 1;
    if (latest.playerHostileContact) playerContactTicks += 1;
    if (completionTick === null && (latest.phase === "COMPLETED" || latest.phase === "SETTLED")) {
      completionTick = tick;
    }
    if (settledTick === null && latest.phase === "SETTLED") settledTick = tick;
  }

  await button.click();
  await waitFor(page, (value) => value.includes("not recording"), 5_000, `trace ${slot} stops`);
  return { maxProgress, contestedTicks, playerContactTicks, completionTick, settledTick, final: latest };
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
      value.includes("phase IDLE · progress 0/180t"),
    8_000,
    "authored task defaults"
  );

  // A: same task and threat, companion deliberately parked away from the lane.
  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  await dragWorld(page, canvas, { x: 8.2, y: 5 }, { x: 9.0, y: 5.0 });
  await dragWorld(page, canvas, { x: 10.4, y: 5 }, { x: 7.0, y: 2.0 });
  await setup.click();

  await page.getByRole("button", { name: /Hold here/ }).click();
  await waitFor(page, (value) => value.includes("C1 HOLD"), 4_000, "baseline C1 hold away");
  await page.locator('[data-experiment-capture="A"]').click();
  const labelA = page.locator('[data-experiment-slot="A"] .squad-lab-experiment-label');
  await labelA.fill("task · C1 parked away");
  await labelA.blur();

  // B: task/threat/player are unchanged. Only C1 is manually authored into a
  // physical screen position and HOLDs that real body against the approach.
  await page.locator('[data-experiment-restore="A"]').click();
  await waitFor(page, (value) => value.includes("phase IDLE · progress 0/180t"), 8_000, "restore A before B");
  await setup.click();
  await dragWorld(page, canvas, { x: 7.0, y: 2.0 }, { x: 10.55, y: 5.0 });
  await setup.click();
  await page.getByRole("button", { name: /Hold here/ }).click();
  await waitFor(page, (value) => value.includes("C1 HOLD"), 4_000, "screen C1 hold");
  await page.locator('[data-experiment-capture="B"]').click();
  const labelB = page.locator('[data-experiment-slot="B"] .squad-lab-experiment-label');
  await labelB.fill("task · C1 physical screen");
  await labelB.blur();

  const diff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(diff.includes("POSITIONS"), `screen strategy did not preserve position delta: ${diff}`);
  invariant(!diff.includes("SITUATION"), `task/threat situation drifted across A/B: ${diff}`);

  const baseline = await runTrace(page, "A");
  const screen = await runTrace(page, "B");

  invariant(
    baseline.maxProgress < 180,
    `No-help baseline unexpectedly completed task: ${JSON.stringify(baseline)}`
  );
  invariant(
    baseline.contestedTicks > 20,
    `No-help baseline never developed sustained task pressure: ${JSON.stringify(baseline)}`
  );
  invariant(
    screen.maxProgress === 180 && screen.completionTick !== null,
    `Physical screen did not allow task completion: ${JSON.stringify(screen)}`
  );
  invariant(
    screen.maxProgress >= baseline.maxProgress + 25,
    `Screen did not materially change task continuity: A=${baseline.maxProgress} B=${screen.maxProgress}`
  );
  invariant(
    screen.settledTick !== null,
    `Task completed but same-world recovery did not settle inside horizon: ${JSON.stringify(screen)}`
  );

  const status = (await page.locator('[data-task-pressure-status="true"]').textContent()) ?? "";
  invariant(status.includes("SETTLED") && status.includes("progress 100%"), `participant task status not legible: ${status}`);

  await page.screenshot({
    path: `${ROOT}/task-pressure-screening.png`,
    type: "png",
    fullPage: true
  });

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-task-pressure-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Can manual companion physical screening materially change player task continuity under the same visible task/threat problem?",
    baseline,
    screen,
    outcomes: {
      visibleWorldOwnedTaskProgress: true,
      baselineDevelopsSustainedContest: true,
      physicalScreenMateriallyChangesContinuity: true,
      screenAllowsTaskCompletion: true,
      sameWorldRecoverySettles: true,
      noRepelRequiredForDifference: true
    },
    interpretationBoundary:
      "Machine evidence for one manual shared-task apparatus only. No teammate feel, behavior-semantic, Owner, or autonomy claim.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_TASK_PRESSURE]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
