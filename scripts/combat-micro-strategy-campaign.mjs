import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/combat-micro-strategies";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function tap(page, key, holdMs = 45) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

async function hold(page, keys, holdMs) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
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

function actorMoveKeys(actor, dx, dy) {
  const threshold = 0.12;
  const keys = [];
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

async function participantFirst(page) {
  const toggles = page.locator(".debug-layer-toggle input");
  for (let index = 0; index < await toggles.count(); index += 1) {
    const toggle = toggles.nth(index);
    if (await toggle.isChecked()) await toggle.uncheck();
  }
  if (!(await page.locator("#debug-panel").evaluate((node) => node.classList.contains("is-collapsed")))) {
    await page.locator(".debug-collapse").click();
  }
}

async function resetCombat(page) {
  await tap(page, "r");
  return waitForPanel(
    page,
    (text) =>
      text.includes("Combat micro · manual responsibility spike") &&
      text.includes("phase APPROACHING") &&
      text.includes("hostile HP 3/3") &&
      text.includes("hits player 0 / companion 0") &&
      text.includes("successful strike history none"),
    8_000,
    "combat micro reset"
  );
}

async function waitForApproach(page, expectedHealth) {
  return waitForPanel(
    page,
    (text) =>
      text.includes("phase APPROACHING") &&
      text.includes(`hostile HP ${expectedHealth}/3`),
    8_000,
    `approach resumes at HP ${expectedHealth}`
  );
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
      await page.waitForTimeout(35);
      continue;
    }

    const source = g[actor];
    const keys = actorMoveKeys(actor, g.hostile.x - source.x, g.hostile.y - source.y);
    if (keys.length > 0) await hold(page, keys, 95);
    await tap(page, actionKey);
    await page.waitForTimeout(55);
  }

  throw new Error(
    `${actor} failed to reduce hostile to HP ${expectedHealth}. Latest panel: ${JSON.stringify(latest.slice(0, 7000))}`
  );
}

async function threeBeat(page, sequence) {
  let latest = "";
  for (let index = 0; index < sequence.length; index += 1) {
    const expectedHealth = 2 - index;
    latest = await approachAndStrike(page, sequence[index], expectedHealth);
    if (expectedHealth > 0) await waitForApproach(page, expectedHealth);
  }
  return latest;
}

function snapshot(text) {
  const hp = text.match(/hostile HP (\d+)\/3/)?.[1] ?? null;
  const hits = text.match(/hits player (\d+) \/ companion (\d+)/);
  const history = text.match(/successful strike history ([\\s\\S]*?)(?=latest attempts)/)?.[1]?.trim() ?? "none";
  const target = text.match(/pressure target (player|companion)/)?.[1] ?? null;
  const phase = text.match(/phase (APPROACHING|PRESSURING|RECOVERING|DEFEATED)/)?.[1] ?? null;
  return {
    phase,
    hostileHealth: hp === null ? null : Number(hp),
    target,
    playerHits: hits ? Number(hits[1]) : null,
    companionHits: hits ? Number(hits[2]) : null,
    history
  };
}

async function shot(page, name) {
  await page.screenshot({ path: `${ROOT}/${name}.png`, type: "png", fullPage: true });
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4176, strictPort: true }
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

  await page.goto("http://127.0.0.1:4176/", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await tap(page, "7");
  await waitForPanel(
    page,
    (text) => text.includes("Combat micro · manual responsibility spike"),
    8_000,
    "combat micro loads"
  );
  await participantFirst(page);

  const results = [];

  await resetCombat(page);
  const playerOnly = await threeBeat(page, ["player", "player", "player"]);
  invariant(playerOnly.includes("phase DEFEATED"), "Player-only strategy did not resolve.");
  invariant(
    playerOnly.includes("successful strike history player → player → player"),
    "Player-only provenance was not preserved."
  );
  results.push({ id: "player-only", ...snapshot(playerOnly) });
  await shot(page, "01-player-only.png");

  await resetCombat(page);
  const companionOnly = await threeBeat(page, ["companion", "companion", "companion"]);
  invariant(companionOnly.includes("phase DEFEATED"), "Companion-only strategy did not resolve.");
  invariant(
    companionOnly.includes("successful strike history companion → companion → companion"),
    "Companion-only provenance was not preserved."
  );
  results.push({ id: "companion-only", ...snapshot(companionOnly) });
  await shot(page, "02-companion-only.png");

  await resetCombat(page);
  const alternating = await threeBeat(page, ["companion", "player", "companion"]);
  invariant(alternating.includes("phase DEFEATED"), "Alternating strategy did not resolve.");
  invariant(
    alternating.includes("successful strike history companion → player → companion"),
    "Alternating responsibility provenance was not preserved."
  );
  results.push({ id: "alternating", ...snapshot(alternating) });
  await shot(page, "03-alternating.png");

  await resetCombat(page);
  const playerHit = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome ACTOR_HIT") &&
      text.includes("hit actor player") &&
      text.includes("hits player 1 / companion 0") &&
      text.includes("hostile HP 3/3"),
    12_000,
    "player receives factual consequence"
  );
  invariant(playerHit.includes("successful strike history none"), "No-action consequence invented a contributor.");
  await waitForApproach(page, 3);
  const postHitTakeover = await threeBeat(page, ["companion", "companion", "companion"]);
  invariant(postHitTakeover.includes("phase DEFEATED"), "Post-hit companion takeover did not resolve.");
  invariant(
    postHitTakeover.includes("hits player 1 / companion 0"),
    "Post-hit strategy lost the factual player consequence."
  );
  results.push({ id: "post-hit-companion-takeover", ...snapshot(postHitTakeover) });
  await shot(page, "04-post-hit-companion-takeover.png");

  await resetCombat(page);
  await hold(page, ["a"], 2400);
  await page.waitForTimeout(650);
  const disengaged = await panelText(page);
  const disengagedState = snapshot(disengaged);
  invariant(
    disengagedState.hostileHealth === 3 &&
      disengagedState.playerHits === 0 &&
      disengagedState.companionHits === 0 &&
      disengagedState.history === "none",
    `Player disengagement unexpectedly required/produced combat: ${JSON.stringify(disengagedState)}`
  );
  results.push({ id: "player-disengages", ...disengagedState });
  await shot(page, "05-player-disengages.png");

  invariant(
    new Set(results.map((entry) =>
      [entry.phase, entry.hostileHealth, entry.playerHits, entry.companionHits, entry.history].join("|")
    )).size === results.length,
    "Strategy campaign collapsed to duplicate outcome signatures."
  );
  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-combat-micro-strategy-campaign-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    question:
      "Does combat-micro admit several materially distinct manual responsibility allocations, or collapse to one magic choreography?",
    variants: results,
    fixedFacts: {
      sameScenario: true,
      sameHostileHealth: 3,
      sameStrikeRange: true,
      noCompanionCognitionAuthority: true,
      passivePlacementNeverCountsAsStrike: true
    },
    interpretationBoundary:
      "This only establishes manual responsibility-allocation diversity inside one deliberately tiny strike/pressure loop. It does not qualify combat quality, teammate feel, autonomy, tactics, or the pressure-transfer rule as product semantics.",
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[COMBAT_MICRO_STRATEGIES]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
