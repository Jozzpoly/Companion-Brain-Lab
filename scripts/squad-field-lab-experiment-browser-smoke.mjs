import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-experiment-browser";
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
    await page.waitForTimeout(30);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 5000))}`);
}

async function tap(page, key, holdMs = 55) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

function bodyPosition(text) {
  const match = text.match(/body (-?\d+\.\d+), (-?\d+\.\d+)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function requestedVelocity(text) {
  const match = text.match(/requested (-?\d+\.\d+), (-?\d+\.\d+)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function shot(page, name) {
  await page.screenshot({ path: `${ROOT}/${name}.png`, type: "png", fullPage: true });
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4174, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1700, height: 1050 } });
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
    const guard = "companion-field-lab-experiment-smoke-initialized";
    if (sessionStorage.getItem(guard) === "1") return;
    localStorage.removeItem(keyA);
    localStorage.removeItem(keyB);
    sessionStorage.setItem(guard, "1");
  }, { keyA: KEY_A, keyB: KEY_B });

  await page.goto("http://127.0.0.1:4174/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(
    page,
    (value) => value.includes("scenario squad-field-lab") && value.includes("layout MIXED"),
    8_000,
    "initial Field Lab"
  );
  await tap(page, "p");
  await waitFor(page, (value) => value.includes("PAUSED"), 3_000, "pause setup");

  // Capture A as a reproducible baseline and label it.
  await page.locator('[data-experiment-capture="A"]').click();
  const inputA = page.locator('[data-experiment-slot="A"] .squad-lab-experiment-label');
  await inputA.fill("baseline mixed");
  await inputA.blur();
  await page.waitForTimeout(80);
  invariant(
    await page.locator('[data-experiment-restore="A"]').isEnabled(),
    "Restore A did not become available after capture."
  );
  const storedA = await page.evaluate((key) => localStorage.getItem(key), KEY_A);
  invariant(storedA && storedA.includes("baseline mixed"), "Setup A was not persisted to localStorage.");
  await shot(page, "00-captured-a.png");

  // Perturb multiple independent experimental axes before capturing B:
  // selection/focus, physical position, order, layout and formation dynamics.
  await page.locator('.squad-lab-roster-button[data-member-id="squad-2"]').click();
  await page.getByRole("button", { name: /Direct/ }).click();
  await tap(page, "p");
  const beforeDrive = bodyPosition(await waitFor(
    page,
    (value) => value.includes("Focused · C2") && value.includes("authority DIRECT"),
    3_000,
    "C2 direct authority"
  ));
  invariant(beforeDrive, "C2 body position unavailable before perturbation.");
  await hold(page, "ArrowRight", 420);
  await tap(page, "p");
  const afterDrive = bodyPosition(await waitFor(
    page,
    (value) => value.includes("PAUSED") && value.includes("Focused · C2"),
    3_000,
    "pause after direct perturbation"
  ));
  invariant(afterDrive && afterDrive.x > beforeDrive.x + 0.12, "Direct perturbation did not move C2.");
  await page.getByRole("button", { name: /Direct C2: ON/ }).click();

  await page.locator('[data-layout="PILLAR"]').click();
  await waitFor(page, (value) => value.includes("layout PILLAR · obstacles 1"), 5_000, "pillar layout");

  const spacing = page.locator(".squad-lab-slider input").nth(0);
  await spacing.evaluate((element) => {
    element.value = "1.70";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Hold here" }).click();
  await waitFor(
    page,
    (value) =>
      value.includes("Focused · C2") &&
      value.includes("C2 HOLD") &&
      value.includes("spacing 1.70"),
    4_000,
    "B perturbation state"
  );

  await page.locator('[data-experiment-capture="B"]').click();
  const inputB = page.locator('[data-experiment-slot="B"] .squad-lab-experiment-label');
  await inputB.fill("pillar C2 hold");
  await inputB.blur();
  await page.waitForTimeout(80);

  const diffSummary = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(/A\/B: \d+ differences/.test(diffSummary), `A/B summary is not comparative: ${diffSummary}`);
  for (const category of ["SITUATION", "SELECTION", "ORDERS", "DYNAMICS", "POSITIONS"]) {
    invariant(diffSummary.includes(category), `A/B summary omitted ${category}: ${diffSummary}`);
  }
  const diffPanel = await panelText(page);
  invariant(diffPanel.includes("Experiment A/B"), "Focused debug does not expose A/B experiment truth.");
  invariant(diffPanel.includes("spacingScale"), "Detailed diff does not expose dynamics delta.");
  invariant(diffPanel.includes("positions.squad-2"), "Detailed diff does not expose embodied position delta.");
  await shot(page, "01-captured-b-with-diff.png");

  const storedB = await page.evaluate((key) => localStorage.getItem(key), KEY_B);
  invariant(storedB && storedB.includes("pillar C2 hold"), "Setup B was not persisted to localStorage.");

  // Persistence is cross-reload, not only an in-memory Map.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(
    page,
    (value) => value.includes("loaded persistent setup A") && value.includes("loaded persistent setup B"),
    8_000,
    "persistent A/B reload"
  );
  invariant(await page.locator('[data-experiment-restore="A"]').isEnabled(), "Restore A unavailable after reload.");
  invariant(await page.locator('[data-experiment-restore="B"]').isEnabled(), "Restore B unavailable after reload.");
  invariant((await inputA.inputValue()) === "baseline mixed", "A label did not survive reload.");
  invariant((await inputB.inputValue()) === "pillar C2 hold", "B label did not survive reload.");

  // Restore A and prove authored state, not only metadata, returns.
  await page.locator('[data-experiment-restore="A"]').click();
  const restoredA = await waitFor(
    page,
    (value) =>
      value.includes("layout MIXED · obstacles 3") &&
      value.includes("selected C1") &&
      value.includes("focus C1") &&
      value.includes("spacing 1.00") &&
      value.includes("C1 FOLLOW"),
    8_000,
    "restore exact A setup"
  );
  invariant(restoredA.includes("layout MIXED"), "Restore A did not restore layout.");
  await shot(page, "02-restored-a.png");

  // Restore B and prove the orthogonal authored state returns.
  await page.locator('[data-experiment-restore="B"]').click();
  const restoredB = await waitFor(
    page,
    (value) =>
      value.includes("layout PILLAR · obstacles 1") &&
      value.includes("selected C2") &&
      value.includes("focus C2") &&
      value.includes("spacing 1.70") &&
      value.includes("C2 HOLD"),
    8_000,
    "restore exact B setup"
  );
  const restoredBPosition = bodyPosition(restoredB);
  invariant(restoredBPosition, "Restored B physical C2 position unavailable.");
  invariant(
    Math.hypot(restoredBPosition.x - afterDrive.x, restoredBPosition.y - afterDrive.y) < 0.12,
    "Restore B did not recover the captured embodied C2 position."
  );
  await shot(page, "03-restored-b.png");

  // Scoped exact dynamics are not decorative. Author three exact C2 overrides,
  // capture them into B, then prove the response override changes Rapier's
  // requested velocity for the same far MOVE responsibility.
  await page.locator('[data-dynamics-scope="SELECTED"]').click();

  for (const [parameter, value] of [
    ["responsiveness", "0.27"],
    ["slotTolerance", "0.41"],
    ["slowdownRadius", "2.35"]
  ]) {
    const numeric = page.locator(
      `[data-parameter="${parameter}"] .squad-lab-number-input`
    );
    await numeric.fill(value);
    await numeric.press("Enter");
    await numeric.blur();
  }

  const scoped = await waitFor(
    page,
    (value) =>
      value.includes("Focused · C2") &&
      value.includes("dynamics response 0.27") &&
      value.includes("tolerance 0.41m") &&
      value.includes("slowdown 2.35m") &&
      value.includes("override: response, tolerance, slowdown"),
    4_000,
    "exact selected dynamics overrides"
  );
  invariant(scoped.includes("dynamics response 0.27"), "C2 response override not visible in causal truth.");

  await page.locator('[data-experiment-capture="B"]').click();
  const scopedDiff = await waitFor(
    page,
    (value) =>
      value.includes("memberDynamics.squad-2.responsiveness") &&
      value.includes("memberDynamics.squad-2.slotTolerance") &&
      value.includes("memberDynamics.squad-2.slowdownRadius"),
    4_000,
    "A/B diff captures scoped member dynamics"
  );
  invariant(scopedDiff.includes("memberDynamics.squad-2.responsiveness"), "A/B diff lost C2 dynamics provenance.");

  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  invariant(box, "Canvas bounding box unavailable for dynamics motor proof.");
  const farTarget = internalCanvasPoint(box, { x: 12.3, y: 7.0 });
  await page.mouse.click(farTarget.x, farTarget.y, { button: "right" });
  await tap(page, "p");

  const slowMotion = await waitFor(
    page,
    (value) => {
      if (!value.includes("Focused · C2")) return false;
      const requested = requestedVelocity(value);
      return Boolean(requested && Math.hypot(requested.x, requested.y) > 0.5);
    },
    4_000,
    "C2 moves with scoped response override"
  );
  const slowRequested = requestedVelocity(slowMotion);
  invariant(slowRequested, "Scoped C2 requested velocity unavailable.");
  const slowMagnitude = Math.hypot(slowRequested.x, slowRequested.y);
  invariant(
    slowMagnitude > 0.65 && slowMagnitude < 0.95,
    `C2 response 0.27 did not materially constrain requested speed: ${slowMagnitude}`
  );
  await tap(page, "p");

  await page.locator('[data-clear-dynamics-overrides="true"]').click();
  const inherited = await waitFor(
    page,
    (value) =>
      value.includes("Focused · C2") &&
      value.includes("dynamics response 0.82") &&
      value.includes("inherit group defaults"),
    4_000,
    "C2 returns to group dynamics"
  );
  invariant(inherited.includes("dynamics response 0.82"), "C2 did not return to group response.");

  await tap(page, "p");
  const fastMotion = await waitFor(
    page,
    (value) => {
      const requested = requestedVelocity(value);
      return Boolean(requested && Math.hypot(requested.x, requested.y) > 2.0);
    },
    4_000,
    "C2 moves with inherited group response"
  );
  const fastRequested = requestedVelocity(fastMotion);
  invariant(fastRequested, "Inherited C2 requested velocity unavailable.");
  const fastMagnitude = Math.hypot(fastRequested.x, fastRequested.y);
  invariant(
    fastMagnitude > slowMagnitude * 2.4,
    `Scoped response did not create a strong physical delta: slow=${slowMagnitude} fast=${fastMagnitude}`
  );
  await tap(page, "p");
  await shot(page, "04-scoped-dynamics-physical-delta.png");

  // The reload earlier reset the scene to RUNNING. The dynamics proof leaves it
  // running again, so explicitly pause before deterministic tick-by-tick traces.
  await tap(page, "p");
  await page.waitForTimeout(80);

  // Temporal evidence: each trial must restore its captured setup, then record
  // real World ticks rather than comparing only static setup state.
  const traceAButton = page.locator('[data-trial-toggle="A"]');
  const traceBButton = page.locator('[data-trial-toggle="B"]');
  invariant(await traceAButton.isEnabled(), "Trace A is unavailable despite captured setup A.");
  invariant(await traceBButton.isEnabled(), "Trace B is unavailable despite captured setup B.");

  await traceAButton.click();
  await waitFor(
    page,
    (value) => value.includes("recording A"),
    8_000,
    "trace A starts from restored setup"
  );
  for (let index = 0; index < 12; index += 1) {
    await tap(page, "o", 20);
    await page.waitForTimeout(20);
  }
  await waitFor(
    page,
    (value) => /recording A · 1[0-2] ticks/.test(value),
    4_000,
    "trace A accumulates World ticks"
  );
  await traceAButton.click();
  await waitFor(
    page,
    (value) => value.includes("A baseline mixed ·") && value.includes("not recording"),
    4_000,
    "trace A captured"
  );

  await traceBButton.click();
  await waitFor(
    page,
    (value) => value.includes("recording B"),
    8_000,
    "trace B starts from restored setup"
  );
  for (let index = 0; index < 12; index += 1) {
    await tap(page, "o", 20);
    await page.waitForTimeout(20);
  }
  await waitFor(
    page,
    (value) => /recording B · 1[0-2] ticks/.test(value),
    4_000,
    "trace B accumulates World ticks"
  );
  await traceBButton.click();

  const tracePanel = await waitFor(
    page,
    (value) =>
      value.includes("Trial / Trace A/B") &&
      value.includes("A baseline mixed ·") &&
      value.includes("B pillar C2 hold ·") &&
      value.includes("Δpath") &&
      value.includes("blocked"),
    5_000,
    "temporal A/B comparison"
  );
  invariant(tracePanel.includes("ΔmotionErr"), "Temporal comparison omitted physical motion error.");
  invariant(tracePanel.includes("authority transitions"), "Temporal comparison omitted authority transitions.");
  const traceSummary = (await page.locator('[data-trial-diff="true"]').textContent()) ?? "";
  invariant(traceSummary.includes("Trace A"), `HUD temporal comparison unavailable: ${traceSummary}`);
  invariant(traceSummary.includes("Δtarget"), `HUD temporal comparison omitted target error: ${traceSummary}`);
  await shot(page, "05-trial-trace-ab.png");

  // Clearing is also persistent; reload must not resurrect stale evidence.
  await page.locator('[data-experiment-clear="B"]').click();
  invariant(
    await page.locator('[data-experiment-restore="B"]').isDisabled(),
    "Restore B remained enabled after clear."
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (value) => value.includes("loaded persistent setup A"), 8_000, "A survives final reload");
  invariant(await page.locator('[data-experiment-restore="A"]').isEnabled(), "A disappeared after B clear.");
  invariant(await page.locator('[data-experiment-restore="B"]').isDisabled(), "Cleared B resurrected after reload.");

  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-experiment-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      capturePersistsAcrossReload: true,
      labelsPersistAcrossReload: true,
      structuralDiffIsVisible: true,
      diffSeparatesMultipleExperimentalAxes: true,
      restoreARecoversAuthoredSetup: true,
      restoreBRecoversAuthoredSetup: true,
      restoreRecoversEmbodiedPosition: true,
      clearingSlotIsPersistent: true,
      exactNumericDynamicsAuthoring: true,
      selectedOverridesAreCapturedByDiff: true,
      scopedResponseChangesPhysicalRequestedVelocity: true,
      temporalTrialsRestoreCapturedSetups: true,
      temporalTrialComparisonExposesTrajectoryAndBlockedEvidence: true
    },
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_EXPERIMENT_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
