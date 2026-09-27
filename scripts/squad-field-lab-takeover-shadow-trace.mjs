import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-takeover-shadow-trace";
const KEY_A = "companion-brain-lab.field-lab.experiment.A.v1";
const KEY_B = "companion-brain-lab.field-lab.experiment.B.v1";
const TOTAL_TICKS = 110;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function shadowText(page) {
  return (await page.locator('[data-combat-takeover-shadow="true"]').textContent()) ?? "";
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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 12000))}`);
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

async function dragBody(page, box, from, to) {
  const a = internalCanvasPoint(box, from);
  const b = internalCanvasPoint(box, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

function normalized(value) {
  return value.replace(/\s+/g, " ").trim();
}

function shadowTraceCount(text, slot) {
  const match = normalized(text).match(
    new RegExp(`${slot} shadow · TAKE_OVER (\\d+)\\/(\\d+)t`)
  );
  if (!match) throw new Error(`Missing ${slot} shadow trace summary in: ${normalized(text)}`);
  return {
    takeOverTicks: Number(match[1]),
    samples: Number(match[2])
  };
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4186, strictPort: true }
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

  await page.goto("http://127.0.0.1:4186/?fieldlab=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  const canvas = page.locator("#game-root canvas");
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await waitFor(page, (text) => text.includes("scenario squad-field-lab"), 8_000, "Field Lab ready");

  await tap(page, "p");
  await waitFor(page, (text) => text.includes("PAUSED"), 3_000, "fixed-step mode");
  await page.locator('[data-situation="COMBAT_MICRO"]').click();
  await page.locator('[data-layout="OPEN"]').click();
  await page.locator('[data-squad-size="1"]').click();
  await waitFor(
    page,
    (text) =>
      text.includes("scenario squad-field-lab-combat-micro") &&
      text.includes("real squad bodies 1 · C1"),
    8_000,
    "Combat Micro one-companion fixture"
  );

  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  await dragBody(page, box, { x: 4.6, y: 5.0 }, { x: 10.8, y: 5.0 });
  await dragBody(page, box, { x: 3.0, y: 5.0 }, { x: 11.35, y: 4.45 });
  await setup.click();

  await page.locator('[data-order-mode="HOLD"]').click();
  await waitFor(page, (text) => text.includes("C1 HOLD"), 4_000, "prepared HOLD");

  for (const slot of ["A", "B"]) {
    await page.locator(`[data-experiment-capture="${slot}"]`).click();
    const label = page.locator(`[data-experiment-slot="${slot}"] .squad-lab-experiment-label`);
    await label.fill(
      slot === "A"
        ? "shadow opportunity remains open without takeover"
        : "manual C1 takeover closes shadow opportunity"
    );
    await label.blur();
  }
  const setupDiff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(setupDiff.includes("identical setup state"), `A/B setup drifted: ${setupDiff}`);

  // A: same prepared start, YOU engages, C1 never acts. The observer may
  // recommend takeover but must not execute it.
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("recording A"), 6_000, "trace A start");
  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  let aTicks = 1;
  let aFirstPositiveTick = null;
  while (aTicks < TOTAL_TICKS) {
    await tap(page, "o");
    aTicks += 1;
    if (aFirstPositiveTick === null && (await shadowText(page)).includes("TAKE_OVER")) {
      aFirstPositiveTick = aTicks;
    }
  }
  invariant(aFirstPositiveTick !== null, "Trace A never exposed a TAKE_OVER opportunity.");
  const aFinalStatus = await combatStatus(page);
  invariant(aFinalStatus.includes("history YOU"), `Trace A lost manual-only history: ${aFinalStatus}`);
  invariant(!aFinalStatus.includes("YOU → C1"), "Trace A shadow executed a hidden takeover.");
  invariant((await shadowText(page)).includes("TAKE_OVER"), "Trace A opportunity did not remain open at the bounded endpoint.");
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("not recording"), 4_000, "trace A stop");

  // B: identical restore. The harness observes the first positive shadow window,
  // then authors the already-qualified manual C1 STRIKE. The shadow must close;
  // the observer still never performs the action itself.
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("recording B"), 6_000, "trace B start");
  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  let bTicks = 1;
  let bFirstPositiveTick = null;
  while (bTicks < TOTAL_TICKS) {
    await tap(page, "o");
    bTicks += 1;
    if ((await shadowText(page)).includes("TAKE_OVER")) {
      bFirstPositiveTick = bTicks;
      break;
    }
  }
  invariant(bFirstPositiveTick !== null, "Trace B never exposed the expected TAKE_OVER window.");

  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  bTicks += 1;
  const postManualTakeover = await combatStatus(page);
  invariant(postManualTakeover.includes("history YOU → C1"), `Manual takeover missing in B: ${postManualTakeover}`);
  invariant(postManualTakeover.includes("pressure target C1"), `Manual takeover did not transfer responsibility in B: ${postManualTakeover}`);
  invariant(
    (await shadowText(page)).includes("DO_NOT_TAKE_OVER"),
    "Shadow window did not close after the explicit manual takeover."
  );

  while (bTicks < TOTAL_TICKS) {
    await tap(page, "o");
    bTicks += 1;
  }
  invariant(bTicks === TOTAL_TICKS, `Trace B tick bound drifted: ${bTicks}`);
  const bFinalStatus = await combatStatus(page);
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("not recording"), 4_000, "trace B stop");

  const comparison = await waitFor(
    page,
    (text) =>
      text.includes("A shadow") &&
      text.includes("B shadow") &&
      text.includes("Shadow Δ B−A") &&
      text.includes("A shadow reasons") &&
      text.includes("B shadow reasons") &&
      text.includes("TAKEOVER_CONDITIONS_PRESENT"),
    6_000,
    "temporal shadow A/B comparison"
  );

  const aTrace = shadowTraceCount(comparison, "A");
  const bTrace = shadowTraceCount(comparison, "B");
  invariant(aTrace.samples === TOTAL_TICKS, `Trace A samples ${aTrace.samples} != ${TOTAL_TICKS}`);
  invariant(bTrace.samples === TOTAL_TICKS, `Trace B samples ${bTrace.samples} != ${TOTAL_TICKS}`);
  invariant(aTrace.takeOverTicks > bTrace.takeOverTicks, `Manual takeover did not shorten shadow window: A ${aTrace.takeOverTicks}, B ${bTrace.takeOverTicks}`);
  invariant(bTrace.takeOverTicks >= 1, "Trace B failed to preserve the observed pre-action TAKE_OVER frame.");

  const flat = normalized(comparison);
  invariant(
    /A shadow .* final TAKE_OVER\/TAKEOVER_CONDITIONS_PRESENT/.test(flat),
    `Trace A final shadow state unexpected: ${flat}`
  );
  invariant(
    /B shadow .* final DO_NOT_TAKE_OVER\//.test(flat),
    `Trace B final shadow state did not remain closed: ${flat}`
  );
  const deltaMatch = flat.match(/Shadow Δ B−A · TAKE_OVER ([+-]?\d+)t/);
  invariant(deltaMatch, `Missing TAKE_OVER delta: ${flat}`);
  const takeOverDelta = Number(deltaMatch[1]);
  invariant(
    takeOverDelta === bTrace.takeOverTicks - aTrace.takeOverTicks && takeOverDelta < 0,
    `Unexpected shadow duration delta ${takeOverDelta}; A ${aTrace.takeOverTicks}, B ${bTrace.takeOverTicks}`
  );

  await page.screenshot({
    path: `${ROOT}/01-temporal-shadow-trace-ab.png`,
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
    schema: "companion-brain-lab-field-lab-takeover-shadow-trace-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    equalTraceBoundTicks: TOTAL_TICKS,
    patterns: {
      a: {
        firstPositiveShadowTick: aFirstPositiveTick,
        takeOverTicks: aTrace.takeOverTicks,
        finalCombatStatus: aFinalStatus
      },
      b: {
        firstPositiveShadowTick: bFirstPositiveTick,
        takeOverTicks: bTrace.takeOverTicks,
        finalCombatStatus: bFinalStatus
      }
    },
    takeOverTicksDeltaBMinusA: takeOverDelta,
    observations: {
      identicalInitialAB: true,
      equalTemporalBounds: true,
      shadowDecisionPersistedPerTrialFrame: true,
      shadowSummaryVisibleInABComparison: true,
      reasonOccupancyVisibleInABComparison: true,
      noTakeoverPatternRetainsLongerOpportunityWindow: true,
      manualTakeoverShortensOpportunityWindow: true,
      positivePreActionFrameSurvivesInTraceB: true,
      traceARecommendationNeverExecutesItself: true,
      onlyExplicitManualC1StrikeChangesResponsibilityInTraceB: true,
      noNewRuntimeAuthorityAdded: true
    },
    interpretationBoundary:
      "This qualifies temporal persistence and A/B comparison of the already-qualified zero-authority takeover shadow. It shows that manual causal intervention changes the later shadow opportunity timeline while the observer itself remains non-executing. It does not qualify autonomous STRIKE, policy optimality, combat quality or Owner-facing teammate behavior.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_TAKEOVER_SHADOW_TRACE]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
