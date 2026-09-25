import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-manual-episode-authoring";
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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 6500))}`);
}

async function tap(page, key, holdMs = 18) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(12);
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function stepTicks(page, count) {
  for (let index = 0; index < count; index += 1) await tap(page, "o");
}

async function stepUntilPhase(page, phase, maxTicks) {
  for (let index = 0; index < maxTicks; index += 1) {
    await tap(page, "o");
    const text = await panelText(page);
    if (text.includes(`phase ${phase}`)) return { ticks: index + 1, text };
  }
  throw new Error(`phase ${phase} not reached within ${maxTicks} ticks`);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4178, strictPort: true }
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

  await page.goto("http://127.0.0.1:4178/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (value) => value.includes("scenario squad-field-lab"), 8_000, "Field Lab ready");

  await tap(page, "p");
  await waitFor(page, (value) => value.includes("PAUSED"), 3_000, "paused setup");

  await page.locator('[data-situation="PRESSURE"]').click();
  await waitFor(page, (value) => value.includes("scenario squad-field-lab-pressure"), 8_000, "pressure situation");
  await page.locator('[data-layout="OPEN"]').click();
  await waitFor(page, (value) => value.includes("layout OPEN · obstacles 0"), 6_000, "open pressure layout");
  await page.locator('[data-squad-size="2"]').click();
  await waitFor(page, (value) => value.includes("real squad bodies 2"), 6_000, "two-member squad");

  // C1 is deliberately staged within REPEL range of the threat. This is manual
  // authoring of an experimental initial condition, not autonomous behavior.
  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  const c1From = internalCanvasPoint(box, { x: 4.6, y: 5.0 });
  const c1To = internalCanvasPoint(box, { x: 6.0, y: 5.0 });
  await page.mouse.move(c1From.x, c1From.y);
  await page.mouse.down();
  await page.mouse.move(c1To.x, c1To.y, { steps: 8 });
  await page.mouse.up();
  await waitFor(
    page,
    (value) => value.includes("setup place C1") && value.includes("Focused · C1"),
    6_000,
    "C1 staged near threat"
  );
  await setup.click();

  // Capture the same authored initial condition twice. Only B will receive a
  // multi-beat manual choreography while the trace is live.
  for (const slot of ["A", "B"]) {
    await page.locator(`[data-experiment-capture="${slot}"]`).click();
    const label = page.locator(`[data-experiment-slot="${slot}"] .squad-lab-experiment-label`);
    await label.fill(slot === "A" ? "no choreography" : "manual hold-repel-regroup");
    await label.blur();
  }
  const setupDiff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(setupDiff.includes("identical setup state"), `A/B setup drifted: ${setupDiff}`);

  // Baseline A: no authored intervention.
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (value) => value.includes("recording A"), 7_000, "trace A starts");
  await stepTicks(page, 155);
  await page.locator('[data-trial-toggle="A"]').click();

  // B: manual multi-beat sequence.
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (value) => value.includes("recording B"), 7_000, "trace B starts");

  await page.locator('[data-order-mode="HOLD"]').click();
  await waitFor(page, (value) => value.includes("C1 HOLD"), 3_000, "C1 hold authored");

  const approach = await stepUntilPhase(page, "APPROACHING", 140);
  invariant(approach.text.includes("C1 HOLD"), "C1 did not preserve authored hold before approach.");

  await page.locator('[data-pressure-action="focused"]').click();
  await tap(page, "o");
  const action = await waitFor(
    page,
    (value) => value.includes("REPEL companion -> SUCCEEDED"),
    4_000,
    "manual C1 repel succeeds"
  );
  invariant(action.includes("outcome REPELLED"), "Successful manual action did not change episode outcome.");

  await page.locator('[data-order-mode="FOLLOW"]').click();
  await waitFor(page, (value) => value.includes("C1 FOLLOW"), 3_000, "C1 regroup/follow authored");
  await stepTicks(page, 28);
  await page.locator('[data-trial-toggle="B"]').click();

  const comparison = await waitFor(
    page,
    (value) =>
      value.includes("Trial / Trace A/B") &&
      value.includes("authored interventions") &&
      value.includes("ORDERS") &&
      value.includes("ACTION") &&
      value.includes("REPEL outcome") &&
      value.includes("SUCCEEDED"),
    5_000,
    "manual episode provenance survives trace"
  );

  invariant(
    comparison.includes("C1:FOLLOW") && comparison.includes("C1:HOLD"),
    "Trace did not retain manual order transition semantics."
  );
  invariant(
    comparison.includes("queued@hostile"),
    "Trace did not retain the authored cooperative action attempt."
  );
  invariant(
    comparison.includes("REPELLED") || action.includes("outcome REPELLED"),
    "Manual episode did not produce a material cooperative outcome."
  );

  await page.screenshot({
    path: `${ROOT}/manual-hold-repel-regroup.png`,
    type: "png",
    fullPage: true
  });

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-manual-episode-authoring-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    authoredSequence: [
      "setup C1 within material action range",
      "HOLD during calm",
      "wait through episode transition",
      "manual C1 REPEL during APPROACHING",
      "FOLLOW to regroup"
    ],
    observations: {
      identicalInitialAB: true,
      setupPlacementUsedAsInitialConditionAuthoring: true,
      orderTransitionsRecordedInTrace: true,
      manualActionAttemptRecordedInTrace: true,
      manualActionOutcomeRecordedInTrace: true,
      materialEpisodeOutcomeOccurred: true,
      sequenceRequiresSpatialMicromanagementAndSingleREPELVerb: true
    },
    interpretationBoundary:
      "This proves the lab can preserve one manually authored multi-beat choreography as evidence. It does not prove rich behavior authoring, teammate feel, or autonomy.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_MANUAL_EPISODE_AUTHORING]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
