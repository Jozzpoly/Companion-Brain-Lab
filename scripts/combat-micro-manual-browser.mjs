import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/combat-micro-manual";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function tapKey(page, key, holdMs = 45) {
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
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 7000))}`);
}

function geometry(text) {
  const match = text.match(
    /hostile (-?\d+\.\d+), (-?\d+\.\d+) · player (-?\d+\.\d+), (-?\d+\.\d+) · companion (-?\d+\.\d+), (-?\d+\.\d+)/
  );
  if (!match) return null;
  return {
    hostile: { x: Number(match[1]), y: Number(match[2]) },
    player: { x: Number(match[3]), y: Number(match[4]) },
    companion: { x: Number(match[5]), y: Number(match[6]) }
  };
}

function movementKeys(actor, dx, dy) {
  const keys = [];
  const threshold = 0.12;
  if (actor === "player") {
    if (dx > threshold) keys.push("d");
    else if (dx < -threshold) keys.push("a");
    if (dy > threshold) keys.push("s");
    else if (dy < -threshold) keys.push("w");
  } else {
    if (dx > threshold) keys.push("ArrowRight");
    else if (dx < -threshold) keys.push("ArrowLeft");
    if (dy > threshold) keys.push("ArrowDown");
    else if (dy < -threshold) keys.push("ArrowUp");
  }
  return keys;
}

async function pulseMove(page, keys, holdMs = 105) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

async function approachAndStrike(page, actor, expectedHealth, timeout = 12_000) {
  const actionKey = actor === "player" ? "e" : "Enter";
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page);
    if (
      latest.includes(`hostile HP ${expectedHealth}/3`) &&
      (expectedHealth === 0 || latest.includes(`pressure target ${actor}`))
    ) {
      return latest;
    }

    const g = geometry(latest);
    if (!g) {
      await page.waitForTimeout(40);
      continue;
    }
    const source = g[actor];
    const keys = movementKeys(actor, g.hostile.x - source.x, g.hostile.y - source.y);
    if (keys.length > 0) await pulseMove(page, keys);
    await tapKey(page, actionKey);
    await page.waitForTimeout(65);
  }
  throw new Error(
    `${actor} failed to produce combat-micro strike to HP ${expectedHealth}. Latest panel: ${JSON.stringify(latest.slice(0, 7000))}`
  );
}

async function moveCurrentTargetAway(page, actor, timeout = 4_000) {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page);
    if (
      latest.includes("phase APPROACHING") &&
      latest.includes(`pressure target ${actor}`) &&
      !latest.includes(`hit actor ${actor}`)
    ) {
      return latest;
    }
    const g = geometry(latest);
    if (!g) {
      await page.waitForTimeout(40);
      continue;
    }
    const source = g[actor];
    const dx = source.x - g.hostile.x;
    const dy = source.y - g.hostile.y;
    let keys = movementKeys(actor, dx, dy);
    if (keys.length === 0) keys = actor === "player" ? ["a"] : ["ArrowLeft"];
    await pulseMove(page, keys, 130);
  }
  throw new Error(
    `${actor} did not break pressure by movement. Latest panel: ${JSON.stringify(latest.slice(0, 7000))}`
  );
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
  await tapKey(page, "7");

  const initial = await waitForPanel(
    page,
    (text) =>
      text.includes("Combat micro · manual responsibility spike") &&
      text.includes("phase APPROACHING") &&
      text.includes("hostile HP 3/3") &&
      text.includes("pressure target player") &&
      text.includes("MANUAL SPIKE ONLY"),
    8_000,
    "combat micro manual spike loads"
  );
  invariant(initial.includes("no companion cognition authority"), "Combat micro accidentally exposed cognition authority.");
  await shot(page, "00-initial-approach.png");

  // Companion explicitly enters the problem. Passive proximity cannot change HP.
  const companionStrike = await approachAndStrike(page, "companion", 2);
  invariant(companionStrike.includes("successful strike history companion"), "Companion strike provenance missing.");
  invariant(companionStrike.includes("pressure target companion"), "Companion intervention did not carry responsibility.");
  await shot(page, "01-companion-takes-pressure.png");

  // The hostile must later pressure the companion, and ordinary movement must be
  // able to break that pressure without another action.
  await waitForPanel(
    page,
    (text) => text.includes("phase PRESSURING") && text.includes("pressure target companion"),
    8_000,
    "hostile pressures companion after intervention"
  );
  const companionEvade = await moveCurrentTargetAway(page, "companion");
  invariant(companionEvade.includes("hostile HP 2/3"), "Movement-only evasion changed hostile HP.");
  await shot(page, "02-companion-breaks-pressure-by-movement.png");

  // Player explicitly takes the same persistent problem back.
  const playerStrike = await approachAndStrike(page, "player", 1);
  invariant(playerStrike.includes("pressure target player"), "Player action did not take pressure back.");
  invariant(
    playerStrike.includes("successful strike history companion → player"),
    "Split responsibility history missing companion -> player."
  );
  await shot(page, "03-player-takeover.png");

  // Companion can re-enter and finish the encounter; this is still manual
  // authorship, not an earned autonomous behavior.
  const companionFinish = await approachAndStrike(page, "companion", 0);
  invariant(companionFinish.includes("phase DEFEATED"), "Persistent encounter did not reach DEFEATED.");
  invariant(
    companionFinish.includes("successful strike history companion → player → companion"),
    "Final split-responsibility provenance is wrong."
  );
  await shot(page, "04-companion-finishes.png");

  // Independent negative counterfactual: reset and do nothing. The world must
  // eventually impose a player consequence without a fake contributor.
  await tapKey(page, "r");
  await waitForPanel(
    page,
    (text) =>
      text.includes("phase APPROACHING") &&
      text.includes("hostile HP 3/3") &&
      text.includes("pressure target player") &&
      text.includes("successful strike history none"),
    8_000,
    "combat micro reset"
  );
  const noActionHit = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome ACTOR_HIT") &&
      text.includes("hit actor player") &&
      text.includes("hits player 1 / companion 0") &&
      text.includes("latest attempts none"),
    12_000,
    "no-action player consequence"
  );
  invariant(noActionHit.includes("hostile HP 3/3"), "No-action consequence incorrectly damaged hostile.");
  await shot(page, "05-no-action-player-hit.png");

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-combat-micro-manual-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      manualOnly: initial.includes("MANUAL SPIKE ONLY"),
      passivePlacementNotUsedAsContribution: initial.includes("hostile HP 3/3"),
      companionCanTakePressure:
        companionStrike.includes("hostile HP 2/3") &&
        companionStrike.includes("pressure target companion"),
      companionCanBreakPressureByMovement:
        companionEvade.includes("phase APPROACHING") &&
        companionEvade.includes("hostile HP 2/3"),
      playerCanTakeResponsibilityBack:
        playerStrike.includes("hostile HP 1/3") &&
        playerStrike.includes("pressure target player"),
      responsibilityCanTransferAgainAndResolve:
        companionFinish.includes("phase DEFEATED") &&
        companionFinish.includes("companion → player → companion"),
      noActionHasMaterialConsequence:
        noActionHit.includes("ACTOR_HIT") &&
        noActionHit.includes("hit actor player")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[COMBAT_MICRO_MANUAL]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
