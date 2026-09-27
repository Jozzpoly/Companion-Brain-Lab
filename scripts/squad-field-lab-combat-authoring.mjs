import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-combat-authoring";
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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 7500))}`);
}

async function tap(page, key, holdMs = 18) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(12);
}

async function stepTicks(page, count) {
  for (let index = 0; index < count; index += 1) await tap(page, "o");
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function combatStatus(page) {
  return (await page.locator('[data-combat-micro-status="true"]').textContent()) ?? "";
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4181, strictPort: true }
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
    errors.requests.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`
    );
  });

  await page.addInitScript(({ keyA, keyB }) => {
    localStorage.removeItem(keyA);
    localStorage.removeItem(keyB);
  }, { keyA: KEY_A, keyB: KEY_B });

  await page.goto("http://127.0.0.1:4181/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (text) => text.includes("scenario squad-field-lab"), 8_000, "Field Lab ready");

  // Work in fixed-step authoring mode so A/B differ only by deliberate actions.
  await tap(page, "p");
  await waitFor(page, (text) => text.includes("PAUSED"), 3_000, "Field Lab paused");

  await page.locator('[data-situation="COMBAT_MICRO"]').click();
  await waitFor(
    page,
    (text) =>
      text.includes("scenario squad-field-lab-combat-micro") &&
      text.includes("situation COMBAT_MICRO"),
    8_000,
    "combat micro Field Lab situation"
  );
  await page.locator('[data-layout="OPEN"]').click();
  await waitFor(page, (text) => text.includes("layout OPEN · obstacles 0"), 6_000, "open combat layout");
  await page.locator('[data-squad-size="1"]').click();
  await waitFor(page, (text) => text.includes("real squad bodies 1 · C1"), 6_000, "one-companion scope");

  invariant(
    (await page.locator('[data-combat-micro-block="true"]').textContent())?.includes("YOU + C1 only"),
    "Combat authoring surface does not state its one-companion semantic scope."
  );

  // Author C1 near enough for an immediate explicit STRIKE. Proximity itself must
  // not change the encounter; it is only an initial condition for the manual trial.
  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  const c1From = internalCanvasPoint(box, { x: 4.6, y: 5.0 });
  const c1To = internalCanvasPoint(box, { x: 10.9, y: 5.0 });
  await page.mouse.move(c1From.x, c1From.y);
  await page.mouse.down();
  await page.mouse.move(c1To.x, c1To.y, { steps: 12 });
  await page.mouse.up();
  await waitFor(
    page,
    (text) => text.includes("setup place C1") && text.includes("Focused · C1"),
    6_000,
    "C1 combat start authored"
  );
  await setup.click();

  const stagedStatus = await combatStatus(page);
  invariant(stagedStatus.includes("HP 3/3"), "Setup placement changed hostile HP without explicit action.");
  invariant(stagedStatus.includes("history none"), "Setup placement invented combat contribution.");

  // Capture identical A/B starts. The situation itself must be ordinary Field Lab
  // setup state, not a bespoke unrepeatable browser choreography.
  for (const slot of ["A", "B"]) {
    await page.locator(`[data-experiment-capture="${slot}"]`).click();
    const label = page.locator(`[data-experiment-slot="${slot}"] .squad-lab-experiment-label`);
    await label.fill(slot === "A" ? "combat baseline no action" : "manual C1 strike");
    await label.blur();
  }
  const setupDiff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(setupDiff.includes("identical setup state"), `A/B combat setup drifted: ${setupDiff}`);

  // A: same initial condition, no authored combat action.
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("recording A"), 7_000, "trace A starts");
  await stepTicks(page, 8);
  const aStatus = await combatStatus(page);
  invariant(aStatus.includes("HP 3/3"), `Passive C1 staging counted as help in baseline A: ${aStatus}`);
  invariant(aStatus.includes("history none"), `Baseline A invented strike history: ${aStatus}`);
  await page.locator('[data-trial-toggle="A"]').click();

  // B: restore the exact same captured start, then author one explicit C1 action.
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("recording B"), 7_000, "trace B starts");
  invariant((await combatStatus(page)).includes("HP 3/3"), "Trace B did not restore the captured combat start.");

  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  const bStatus = await combatStatus(page);
  invariant(bStatus.includes("HP 2/3"), `C1 STRIKE did not materially change World HP: ${bStatus}`);
  invariant(bStatus.includes("pressure target C1"), `C1 STRIKE did not transfer responsibility: ${bStatus}`);
  invariant(bStatus.includes("history C1"), `C1 causal strike history not visible: ${bStatus}`);
  await stepTicks(page, 4);
  await page.locator('[data-trial-toggle="B"]').click();

  const comparison = await waitFor(
    page,
    (text) =>
      text.includes("Trial / Trace A/B") &&
      text.includes("authored interventions") &&
      text.includes("ACTION") &&
      text.includes("STRIKE") &&
      text.includes("STRIKE outcome") &&
      text.includes("SUCCEEDED"),
    6_000,
    "combat action provenance survives Trial"
  );
  invariant(
    comparison.includes("queued@hostile"),
    "Trial lost the authored C1 STRIKE attempt."
  );

  await page.screenshot({
    path: `${ROOT}/01-c1-strike-ab-provenance.png`,
    type: "png",
    fullPage: true
  });

  // Scope guard: a larger roster may coexist in the Lab, but it must not silently
  // acquire combat semantics. C2 remains a movement/formation authoring body.
  await page.locator('[data-squad-size="2"]').click();
  await waitFor(page, (text) => text.includes("real squad bodies 2 · C1, C2"), 7_000, "C2 added");
  await page.locator('[data-member-id="squad-2"]').click();
  await waitFor(page, (text) => text.includes("Focused · C2"), 3_000, "C2 focused");
  const hpBeforeC2 = await combatStatus(page);
  await page.locator('[data-combat-action="focused"]').click();
  await page.waitForTimeout(80);
  const c2Guard = await waitFor(
    page,
    (text) =>
      text.includes("STRIKE ignored") &&
      text.includes("C2") &&
      text.includes("combat semantics remain C1-scoped"),
    3_000,
    "C2 strike scope guard"
  );
  invariant(
    (await combatStatus(page)) === hpBeforeC2,
    "Rejected C2 STRIKE changed combat World state."
  );
  invariant(c2Guard.includes("movement/formation authoring only"), "C2 scope refusal is not explicit.");

  await page.screenshot({
    path: `${ROOT}/02-c2-combat-scope-guard.png`,
    type: "png",
    fullPage: true
  });

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Request failures: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-field-lab-combat-authoring-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    observations: {
      combatMicroIsCapturableFieldLabSituation: true,
      identicalInitialAB: true,
      passivePlacementDoesNotCountAsContribution: true,
      manualC1StrikeChangesWorldState: true,
      manualC1StrikeTransfersPressure: true,
      strikeAttemptAndOutcomeSurviveTrialProvenance: true,
      largerRosterCanCoexistWithoutCombatSemanticExpansion: true,
      c2StrikeAuthorityExplicitlyRejected: true,
      noCompanionCognitionAuthorityAdded: true
    },
    interpretationBoundary:
      "This qualifies Combat Micro as a one-companion manual Field Lab authoring situation. It does not qualify combat quality, autonomous STRIKE, multi-companion combat semantics, or Owner-facing teammate behavior.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_COMBAT_AUTHORING]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
