import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/cooperative-episode-choreography";

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

async function holdKey(page, key, holdMs) {
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

async function participantFirst(page) {
  const layerToggles = page.locator(".debug-layer-toggle input");
  for (let index = 0; index < await layerToggles.count(); index += 1) {
    const toggle = layerToggles.nth(index);
    if (await toggle.isChecked()) await toggle.uncheck();
  }
  if (!(await page.locator("#debug-panel").evaluate((node) => node.classList.contains("is-collapsed")))) {
    await page.locator(".debug-collapse").click();
  }
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
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: {
      dir: `${ROOT}/video`,
      size: { width: 1200, height: 750 }
    }
  });
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
  await participantFirst(page);
  await tapKey(page, "6");

  await waitForPanel(
    page,
    (text) =>
      text.includes("phase CALM") &&
      text.includes("cycle 1") &&
      text.includes("MANUAL BASELINE ONLY"),
    8_000,
    "cycle 1 calm"
  );

  // Gold-standard manual relationship start: bring companion closer to the player
  // during CALM before any threat demands attention.
  await holdKey(page, "ArrowLeft", 220);
  await shot(page, "00-regrouped-before-threat.png");

  // Cycle 1: human-puppeted candidate teammate arc.
  // Prepare off-axis before contact, then use the shared material affordance.
  await waitForPanel(
    page,
    (text) => text.includes("phase APPROACHING") && text.includes("cycle 1"),
    5_000,
    "cycle 1 approaching"
  );
  await holdKey(page, "ArrowUp", 230);
  await shot(page, "01-manual-pre-contact-flank.png");

  const companionRepel = await repeatTapUntil(
    page,
    "Enter",
    (text) =>
      text.includes("last world outcome REPELLED") &&
      text.includes("repelled by companion") &&
      text.includes("phase DRIVEN_BACK"),
    8_000,
    "companion material contribution"
  );
  invariant(companionRepel.includes("repelled by companion"), "Companion failed the manual contribution.");
  await shot(page, "02-manual-companion-contribution.png");

  // Regroup after the situation changes instead of leaving the companion in its
  // tactical pose forever.
  await waitForPanel(
    page,
    (text) => text.includes("phase CALM") && text.includes("cycle 2"),
    8_000,
    "cycle 2 calm"
  );
  await holdKey(page, "ArrowDown", 230);
  await shot(page, "03-manual-regroup-after-contribution.png");

  // Cycle 2: player commits first. Companion remains available but does not steal
  // the outcome. This is still manual baseline, not cognition.
  await waitForPanel(
    page,
    (text) => text.includes("phase APPROACHING") && text.includes("cycle 2"),
    5_000,
    "cycle 2 approaching"
  );
  await holdKey(page, "d", 420);
  const playerRepel = await repeatTapUntil(
    page,
    "e",
    (text) =>
      text.includes("last world outcome REPELLED") &&
      text.includes("repelled by player") &&
      text.includes("phase DRIVEN_BACK"),
    8_000,
    "player takeover"
  );
  invariant(playerRepel.includes("repelled by player"), "Player failed to own cycle 2 outcome.");
  await shot(page, "04-player-takes-over.png");

  // Return player toward the ordinary relationship before the next cycle.
  await waitForPanel(
    page,
    (text) => text.includes("phase CALM") && text.includes("cycle 3"),
    8_000,
    "cycle 3 calm"
  );
  await holdKey(page, "a", 420);

  // Cycle 3: movement itself remains a first-class way to change the situation.
  // Let pressure begin, then retreat enough to break it. No action key is used.
  await waitForPanel(
    page,
    (text) => text.includes("phase PRESSURING") && text.includes("cycle 3"),
    10_000,
    "cycle 3 pressure"
  );
  await holdKey(page, "a", 520);
  const evaded = await waitForPanel(
    page,
    (text) =>
      text.includes("phase APPROACHING") &&
      text.includes("cycle 3") &&
      !text.includes("last world outcome PLAYER_HIT"),
    2_000,
    "player movement breaks pressure"
  );
  invariant(evaded.includes("phase APPROACHING"), "Player retreat did not reopen the encounter.");
  await shot(page, "05-player-movement-breaks-pressure.png");

  // Finish the reopened cycle through the same explicit player affordance.
  const postEvadeRepel = await repeatTapUntil(
    page,
    "e",
    (text) =>
      text.includes("last world outcome REPELLED") &&
      text.includes("repelled by player") &&
      text.includes("phase DRIVEN_BACK"),
    8_000,
    "player resolves after evasion"
  );
  invariant(postEvadeRepel.includes("repelled by player"), "Reopened cycle could not be resolved.");
  await shot(page, "06-post-evasion-resolution.png");

  // Cycle 4: do nothing. The situation must have a readable consequence and
  // recover into another calm beat without reload/reset ceremony.
  await waitForPanel(
    page,
    (text) => text.includes("phase APPROACHING") && text.includes("cycle 4"),
    12_000,
    "cycle 4 approaching"
  );
  const hit = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome PLAYER_HIT") &&
      text.includes("phase DRIVEN_BACK") &&
      text.includes("latest attempts none"),
    10_000,
    "cycle 4 no-action consequence"
  );
  invariant(hit.includes("repelled by none"), "No-action consequence claims a false contributor.");
  await shot(page, "07-no-action-consequence.png");

  const finalCalm = await waitForPanel(
    page,
    (text) =>
      text.includes("phase CALM") &&
      text.includes("cycle 5") &&
      text.includes("last world outcome PLAYER_HIT"),
    10_000,
    "cycle 5 calm"
  );
  await shot(page, "08-continuity-after-consequence.png");

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-cooperative-episode-choreography-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      manualRelationshipStart: true,
      manualPreContactPreparation: true,
      manualCompanionMaterialContribution: companionRepel.includes("repelled by companion"),
      manualRegroupAfterContribution: true,
      playerCanTakeOverOutcome: playerRepel.includes("repelled by player"),
      playerMovementCanChangeSituationWithoutAction: evaded.includes("phase APPROACHING"),
      reopenedSituationStillResolvable: postEvadeRepel.includes("repelled by player"),
      noActionHasConsequence: hit.includes("PLAYER_HIT"),
      episodeReturnsToCalmWithoutReset: finalCalm.includes("cycle 5")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[COOPERATIVE_EPISODE_CHOREOGRAPHY]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
