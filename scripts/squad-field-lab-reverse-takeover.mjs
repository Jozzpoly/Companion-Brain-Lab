import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-reverse-takeover";
const KEY_A = "companion-brain-lab.field-lab.experiment.A.v1";
const KEY_B = "companion-brain-lab.field-lab.experiment.B.v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function combatStatus(page) {
  return (await page.locator('[data-combat-micro-status="true"]').textContent()) ?? "";
}

async function waitFor(page, predicate, timeout = 10_000, label = "condition") {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 9000))}`);
}

async function tap(page, key, holdMs = 18) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(12);
}

async function stepUntil(page, predicate, maxTicks, label) {
  let latest = "";
  for (let index = 0; index < maxTicks; index += 1) {
    await tap(page, "o");
    latest = await combatStatus(page);
    if (predicate(latest)) {
      return { ticks: index + 1, status: latest };
    }
  }
  throw new Error(`${label} not reached within ${maxTicks} ticks. Latest combat status: ${latest}`);
}

function internalCanvasPoint(box, world) {
  const internalX = world.x * 75;
  const internalY = 25 + world.y * 75;
  return {
    x: box.x + (internalX / 1200) * box.width,
    y: box.y + (internalY / 800) * box.height
  };
}

async function dragBody(page, box, from, to) {
  const a = internalCanvasPoint(box, from);
  const b = internalCanvasPoint(box, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4183, strictPort: true }
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

  await page.goto("http://127.0.0.1:4183/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (text) => text.includes("scenario squad-field-lab"), 8_000, "Field Lab ready");

  await tap(page, "p");
  await waitFor(page, (text) => text.includes("PAUSED"), 3_000, "fixed-step authoring mode");
  await page.locator('[data-situation="COMBAT_MICRO"]').click();
  await waitFor(
    page,
    (text) =>
      text.includes("scenario squad-field-lab-combat-micro") &&
      text.includes("situation COMBAT_MICRO"),
    8_000,
    "combat micro situation"
  );
  await page.locator('[data-layout="OPEN"]').click();
  await page.locator('[data-squad-size="1"]').click();
  await waitFor(
    page,
    (text) =>
      text.includes("layout OPEN · obstacles 0") &&
      text.includes("real squad bodies 1 · C1"),
    7_000,
    "one-companion open fixture"
  );

  // Preserve the same explicit preparation logic that the forward takeover
  // campaign discovered. Both YOU and C1 start with a material opportunity
  // to intervene; C1 is then explicitly HOLDed so readiness does not dissolve
  // under ordinary formation authority.
  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  await dragBody(page, box, { x: 4.6, y: 5.0 }, { x: 10.8, y: 5.0 });
  await waitFor(page, (text) => text.includes("setup place C1"), 5_000, "C1 staged");
  await dragBody(page, box, { x: 3.0, y: 5.0 }, { x: 11.35, y: 4.45 });
  await waitFor(page, (text) => text.includes("setup place YOU"), 5_000, "player staged");
  await setup.click();

  await page.locator('[data-order-mode="HOLD"]').click();
  await waitFor(page, (text) => text.includes("C1 HOLD"), 4_000, "prepared C1 hold");

  const initial = await combatStatus(page);
  invariant(initial.includes("HP 3/3"), `prepared setup changed HP: ${initial}`);
  invariant(initial.includes("pressure target YOU"), `unexpected initial pressure target: ${initial}`);
  invariant(initial.includes("history none"), `prepared setup invented history: ${initial}`);

  for (const slot of ["A", "B"]) {
    await page.locator(`[data-experiment-capture="${slot}"]`).click();
    const label = page.locator(`[data-experiment-slot="${slot}"] .squad-lab-experiment-label`);
    await label.fill(
      slot === "A"
        ? "YOU bears responsibility to consequence"
        : "prepared C1 takes over from pressured YOU"
    );
    await label.blur();
  }
  const setupDiff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(setupDiff.includes("identical setup state"), `reverse A/B setup drifted: ${setupDiff}`);

  // Pattern A: YOU explicitly engages and remains the responsibility bearer.
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("recording A"), 7_000, "reverse pattern A starts");
  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  invariant(
    (await combatStatus(page)).includes("history YOU"),
    "Pattern A did not record the initial player engagement."
  );

  const aConsequence = await stepUntil(
    page,
    (status) =>
      status.includes("hits YOU 1 / C1 0") &&
      status.includes("history YOU"),
    260,
    "player consequence"
  );
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("not recording"), 4_000, "reverse pattern A stops");

  // Pattern B: identical player engagement. C1 acts only after the visible
  // participant-level PRESSURING YOU condition exists and before any hit.
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("recording B"), 7_000, "reverse pattern B starts");
  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  invariant(
    (await combatStatus(page)).includes("history YOU"),
    "Pattern B did not preserve the same initial player engagement."
  );

  const playerPressured = await stepUntil(
    page,
    (status) =>
      status.includes("PRESSURING") &&
      status.includes("pressure target YOU") &&
      status.includes("hits YOU 0 / C1 0"),
    220,
    "visible player pressure cue"
  );

  await page.screenshot({
    path: `${ROOT}/00-visible-player-pressure-before-c1-takeover.png`,
    type: "png",
    fullPage: true
  });

  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  const takeover = await combatStatus(page);
  invariant(takeover.includes("HP 1/3"), `C1 takeover did not add material damage: ${takeover}`);
  invariant(takeover.includes("pressure target C1"), `C1 did not take responsibility: ${takeover}`);
  invariant(takeover.includes("history YOU → C1"), `reverse causal history missing: ${takeover}`);
  invariant(takeover.includes("hits YOU 0 / C1 0"), `Player consequence arrived before takeover: ${takeover}`);

  const bConsequence = await stepUntil(
    page,
    (status) =>
      status.includes("hits YOU 0 / C1 1") &&
      status.includes("history YOU → C1"),
    260,
    "C1 consequence after takeover"
  );
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("not recording"), 4_000, "reverse pattern B stops");

  const comparison = await waitFor(
    page,
    (text) =>
      text.includes("Trial / Trace A/B") &&
      text.includes("A combat") &&
      text.includes("B combat") &&
      text.includes("Combat Δ B−A") &&
      text.includes("A t0 · ACTION · YOU · STRIKE") &&
      text.includes("B t0 · ACTION · YOU · STRIKE") &&
      text.includes("strikes YOU") &&
      text.includes("strikes YOU → C1") &&
      text.includes("hits YOU +1 / C1 +0") &&
      text.includes("hits YOU +0 / C1 +1") &&
      text.includes("target transfers 0") &&
      text.includes("target transfers 1"),
    6_000,
    "reverse responsibility histories remain distinguishable"
  );

  invariant(
    comparison.includes("HOSTILE_STRUCK×1") &&
      comparison.includes("HOSTILE_STRUCK×2") &&
      comparison.includes("ACTOR_HIT×1"),
    "Reverse World outcome histories do not distinguish the authored patterns."
  );

  await page.screenshot({
    path: `${ROOT}/01-player-bears-vs-c1-takeover.png`,
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
    schema: "companion-brain-lab-field-lab-reverse-takeover-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Does the prepared takeover pattern survive in the reverse direction: YOU bears visible pressure and C1 explicitly takes responsibility before consequence?",
    patterns: {
      a: {
        label: "YOU engages and bears responsibility to consequence",
        firstConsequenceAfterTicks: aConsequence.ticks,
        finalStatus: aConsequence.status
      },
      b: {
        label: "YOU engages; prepared C1 takes over when YOU is visibly pressured, then C1 bears consequence",
        visiblePressureCueAfterTicks: playerPressured.ticks,
        c1ConsequenceAfterTakeoverTicks: bConsequence.ticks,
        finalStatus: bConsequence.status
      }
    },
    observations: {
      identicalInitialAB: true,
      preparedHoldPreservesC1InterventionReadiness: true,
      sameInitialPlayerEngagement: true,
      c1TakeoverTriggeredByVisiblePressureStateNotHiddenTick: true,
      patternAEndsWithPlayerConsequence: true,
      patternBTransfersResponsibilityToC1BeforeConsequence: true,
      patternBEndsWithCompanionConsequence: true,
      temporalTraceDistinguishesTargetTransfers: true,
      temporalTraceDistinguishesActorHitConsequences: true,
      temporalTraceDistinguishesStrikeHistory: true,
      noNewActionVerbRequired: true,
      noCompanionCognitionAuthorityAdded: true
    },
    interpretationBoundary:
      "This tests reverse-direction manual responsibility transfer under the same bounded Combat Micro rules and explicit preparation. It does not establish autonomous takeover, combat quality, teammate feel, optimal policy, or Owner qualification.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_REVERSE_TAKEOVER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
