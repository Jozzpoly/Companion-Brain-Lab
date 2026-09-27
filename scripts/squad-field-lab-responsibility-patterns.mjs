import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/squad-field-lab-responsibility-patterns";
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
  preview: { host: "127.0.0.1", port: 4182, strictPort: true }
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

  await page.goto("http://127.0.0.1:4182/?fieldlab=1", {
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

  // Both actors are materially able to intervene, but do not overlap.
  // The second action will be triggered from the visible PRESSURING state,
  // not from a hidden tick count.
  const setup = page.locator('[data-setup-placement="true"]');
  await setup.click();
  const box = await canvas.boundingBox();
  invariant(box, "canvas unavailable");
  await dragBody(page, box, { x: 4.6, y: 5.0 }, { x: 10.9, y: 5.0 });
  await waitFor(page, (text) => text.includes("setup place C1"), 5_000, "C1 staged");
  await dragBody(page, box, { x: 3.0, y: 5.0 }, { x: 11.2, y: 4.2 });
  await waitFor(page, (text) => text.includes("setup place YOU"), 5_000, "player staged");
  await setup.click();

  const initial = await combatStatus(page);
  invariant(initial.includes("HP 3/3"), `authored setup changed HP: ${initial}`);
  invariant(initial.includes("pressure target YOU"), `unexpected initial pressure target: ${initial}`);
  invariant(initial.includes("history none"), `authored setup invented history: ${initial}`);

  for (const slot of ["A", "B"]) {
    await page.locator(`[data-experiment-capture="${slot}"]`).click();
    const label = page.locator(`[data-experiment-slot="${slot}"] .squad-lab-experiment-label`);
    await label.fill(
      slot === "A"
        ? "C1 bears responsibility to consequence"
        : "player takes over from pressured C1"
    );
    await label.blur();
  }
  const setupDiff = (await page.locator('[data-experiment-diff="true"]').textContent()) ?? "";
  invariant(setupDiff.includes("identical setup state"), `pattern A/B setup drifted: ${setupDiff}`);

  // Pattern A: C1 explicitly engages and remains the pressure bearer.
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("recording A"), 7_000, "pattern A trace starts");
  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  invariant(
    (await combatStatus(page)).includes("history C1"),
    "Pattern A did not record the initial C1 engagement."
  );

  const aConsequence = await stepUntil(
    page,
    (status) =>
      status.includes("hits YOU 0 / C1 1") &&
      status.includes("history C1"),
    260,
    "C1 consequence"
  );
  await page.locator('[data-trial-toggle="A"]').click();
  await waitFor(page, (text) => text.includes("not recording"), 4_000, "pattern A trace stops");

  // Pattern B: same C1 engagement. Player waits for a participant-visible state
  // transition, then takes responsibility before C1's pressure clock resolves.
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("recording B"), 7_000, "pattern B trace starts");
  await page.locator('[data-combat-action="focused"]').click();
  await tap(page, "o");
  invariant(
    (await combatStatus(page)).includes("history C1"),
    "Pattern B did not preserve the same initial C1 engagement."
  );

  const c1Pressured = await stepUntil(
    page,
    (status) =>
      status.includes("PRESSURING") &&
      status.includes("pressure target C1") &&
      status.includes("hits YOU 0 / C1 0"),
    220,
    "visible C1 pressure cue"
  );

  await page.locator('[data-combat-action="player"]').click();
  await tap(page, "o");
  const takeover = await combatStatus(page);
  invariant(takeover.includes("HP 1/3"), `Player takeover did not add material damage: ${takeover}`);
  invariant(takeover.includes("pressure target YOU"), `Player did not take pressure responsibility: ${takeover}`);
  invariant(takeover.includes("history C1 → YOU"), `Takeover causal history missing: ${takeover}`);
  invariant(takeover.includes("hits YOU 0 / C1 0"), `C1 consequence arrived before takeover: ${takeover}`);

  const bConsequence = await stepUntil(
    page,
    (status) =>
      status.includes("hits YOU 1 / C1 0") &&
      status.includes("history C1 → YOU"),
    260,
    "player consequence after takeover"
  );
  await page.locator('[data-trial-toggle="B"]').click();
  await waitFor(page, (text) => text.includes("not recording"), 4_000, "pattern B trace stops");

  const comparison = await waitFor(
    page,
    (text) =>
      text.includes("Trial / Trace A/B") &&
      text.includes("A combat") &&
      text.includes("B combat") &&
      text.includes("Combat Δ B−A") &&
      text.includes("A t0 · ACTION · C1 · STRIKE") &&
      text.includes("B t0 · ACTION · C1 · STRIKE") &&
      text.includes("strikes C1") &&
      text.includes("strikes C1 → YOU") &&
      text.includes("hits YOU +0 / C1 +1") &&
      text.includes("hits YOU +1 / C1 +0") &&
      text.includes("target transfers 1") &&
      text.includes("target transfers 2"),
    6_000,
    "multi-beat responsibility patterns remain distinguishable"
  );

  invariant(
    comparison.includes("HOSTILE_STRUCK×1") &&
      comparison.includes("HOSTILE_STRUCK×2") &&
      comparison.includes("ACTOR_HIT×1"),
    "World outcome histories do not distinguish the authored patterns."
  );

  await page.screenshot({
    path: `${ROOT}/01-c1-bears-vs-player-takeover.png`,
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
    schema: "companion-brain-lab-field-lab-responsibility-patterns-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Can identical starts produce materially distinct multi-beat responsibility histories based on a visible world-state cue, rather than a hidden timing choreography?",
    patterns: {
      a: {
        label: "C1 engages and bears responsibility to consequence",
        firstConsequenceAfterTicks: aConsequence.ticks,
        finalStatus: aConsequence.status
      },
      b: {
        label: "C1 engages, player takes over when C1 is visibly pressured, player bears consequence",
        visiblePressureCueAfterTicks: c1Pressured.ticks,
        playerConsequenceAfterTakeoverTicks: bConsequence.ticks,
        finalStatus: bConsequence.status
      }
    },
    observations: {
      identicalInitialAB: true,
      sameInitialC1Engagement: true,
      takeoverTriggeredByVisiblePressureStateNotHiddenTick: true,
      patternAEndsWithCompanionConsequence: true,
      patternBTransfersResponsibilityToPlayerBeforeConsequence: true,
      patternBEndsWithPlayerConsequence: true,
      temporalTraceDistinguishesTargetTransfers: true,
      temporalTraceDistinguishesActorHitConsequences: true,
      temporalTraceDistinguishesStrikeHistory: true,
      noNewActionVerbRequired: true,
      noCompanionCognitionAuthorityAdded: true
    },
    interpretationBoundary:
      "This demonstrates two materially different manually authored responsibility patterns in the bounded Combat Micro Field Lab. It does not establish autonomous behavior semantics, good combat, teammate feel, optimal policy, or Owner qualification.",
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[FIELD_LAB_RESPONSIBILITY_PATTERNS]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
