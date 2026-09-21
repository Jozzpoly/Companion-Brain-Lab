import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/cooperative-episode-browser";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function tapKey(page, key, holdMs = 55) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

async function waitForPanel(page, predicate, timeout = 15_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(20);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 6000))}`);
}

async function repeatTapUntil(page, key, predicate, timeout, label) {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    await tapKey(page, key);
    await page.waitForTimeout(110);
    latest = await panelText(page);
    if (predicate(latest)) return latest;
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 6000))}`);
}

function geometry(text) {
  const match = text.match(
    /hostile (-?\d+\.\d+), (-?\d+\.\d+) · player distance (-?\d+\.\d+)m · companion distance (-?\d+\.\d+)m/
  );
  return match
    ? {
        x: Number(match[1]),
        y: Number(match[2]),
        playerDistance: Number(match[3]),
        companionDistance: Number(match[4])
      }
    : null;
}

async function shot(page, name) {
  await page.screenshot({ path: `${ROOT}/${name}.png`, type: "png", fullPage: true });
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ROOT, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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

  await page.goto("http://127.0.0.1:4173/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });

  await tapKey(page, "6");
  const initial = await waitForPanel(
    page,
    (text) =>
      text.includes("scenario Cooperative episode · manual baseline") &&
      text.includes("S5 manual baseline · continuous cooperative episode") &&
      text.includes("phase CALM") &&
      text.includes("MANUAL BASELINE ONLY"),
    8_000,
    "manual cooperative episode loads"
  );
  invariant(initial.includes("mode MANUAL"), "Cooperative episode did not lock companion to manual baseline.");
  await shot(page, "00-manual-episode-calm.png");

  // Cycle 1: companion acts manually. We deliberately do not wait for a hidden
  // action-validity phase: Enter is retried during the ordinary approach until
  // the body is materially in range.
  await waitForPanel(page, (text) => text.includes("phase APPROACHING"), 5_000, "cycle 1 approaching");
  const companionRepel = await repeatTapUntil(
    page,
    "Enter",
    (text) =>
      text.includes("last world outcome REPELLED") &&
      text.includes("repelled by companion") &&
      text.includes("phase DRIVEN_BACK"),
    8_000,
    "manual companion repel without phase oracle"
  );
  const companionImpact = geometry(companionRepel);
  invariant(companionImpact, "Companion repel frame has no world geometry evidence.");
  await shot(page, "01-companion-manual-repel.png");

  const drivenAway = await waitForPanel(
    page,
    (text) => {
      const g = geometry(text);
      return Boolean(
        g &&
        (text.includes("phase DRIVEN_BACK") || text.includes("phase RESETTING")) &&
        g.x > companionImpact.x + 0.2
      );
    },
    2_500,
    "hostile physically driven away after companion repel"
  );
  const companionAfter = geometry(drivenAway);
  invariant(companionAfter && companionAfter.x > companionImpact.x + 0.2,
    "Companion REPEL changed state but did not materially move hostile away.");

  // During the calm gap before cycle 2, move the manual companion away so the
  // player gets an independent opportunity through the same World affordance.
  await waitForPanel(
    page,
    (text) => text.includes("phase CALM") && text.includes("cycle 2"),
    8_000,
    "cycle 2 calm"
  );
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(850);
  await page.keyboard.up("ArrowUp");

  await waitForPanel(
    page,
    (text) => text.includes("phase APPROACHING") && text.includes("cycle 2"),
    5_000,
    "cycle 2 approaching"
  );

  const playerRepel = await repeatTapUntil(
    page,
    "e",
    (text) =>
      text.includes("last world outcome REPELLED") &&
      text.includes("repelled by player") &&
      text.includes("phase DRIVEN_BACK"),
    9_000,
    "manual player repel without phase oracle"
  );
  const playerImpact = geometry(playerRepel);
  invariant(playerImpact, "Player repel frame has no world geometry evidence.");
  await shot(page, "02-player-manual-repel.png");

  const playerDrivenAway = await waitForPanel(
    page,
    (text) => {
      const g = geometry(text);
      return Boolean(
        g &&
        (text.includes("phase DRIVEN_BACK") || text.includes("phase RESETTING")) &&
        g.x > playerImpact.x + 0.2
      );
    },
    2_500,
    "hostile physically driven away after player repel"
  );
  const playerAfter = geometry(playerDrivenAway);
  invariant(playerAfter && playerAfter.x > playerImpact.x + 0.2,
    "Player REPEL changed state but did not materially move hostile away.");

  // Cycle 3: no action. The same continuous episode must create a consequence
  // and then keep living rather than ending in COMPLETE/reset ceremony.
  await waitForPanel(
    page,
    (text) => text.includes("phase APPROACHING") && text.includes("cycle 3"),
    12_000,
    "cycle 3 approaching"
  );
  const hit = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome PLAYER_HIT") &&
      text.includes("phase DRIVEN_BACK"),
    8_000,
    "no-action consequence"
  );
  invariant(hit.includes("repelled by none"), "PLAYER_HIT incorrectly claims a repelling actor.");
  await shot(page, "03-no-action-player-hit.png");

  const nextCalm = await waitForPanel(
    page,
    (text) => text.includes("phase CALM") && text.includes("cycle 4"),
    10_000,
    "continuous episode returns to calm after consequence"
  );
  invariant(
    nextCalm.includes("last world outcome PLAYER_HIT"),
    "Factual consequence provenance did not survive into the next calm beat."
  );
  await shot(page, "04-cycle-4-calm-continuity.png");

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-cooperative-episode-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      manualBaselineOnly: initial.includes("MANUAL BASELINE ONLY") && initial.includes("mode MANUAL"),
      companionCanMateriallyRepelWithoutHiddenPhaseOracle:
        companionRepel.includes("repelled by companion") &&
        Boolean(companionAfter && companionImpact && companionAfter.x > companionImpact.x + 0.2),
      playerUsesSameMaterialAffordance:
        playerRepel.includes("repelled by player") &&
        Boolean(playerAfter && playerImpact && playerAfter.x > playerImpact.x + 0.2),
      noActionHasWorldConsequence: hit.includes("PLAYER_HIT"),
      episodeContinuesWithoutResetCeremony:
        nextCalm.includes("phase CALM") && nextCalm.includes("cycle 4")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[COOPERATIVE_EPISODE_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
