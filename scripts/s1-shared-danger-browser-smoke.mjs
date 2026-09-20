import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/s1-shared-danger-browser";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return (await page.locator("#debug-panel").textContent()) ?? "";
}

async function waitForPanel(page, predicate, timeout = 15_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(25);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 3200))}`);
}

function tickFromPanel(text) {
  const match = text.match(/tick\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

function apparatusBaseline(text) {
  return (
    text.includes("scenario Shared danger apparatus") &&
    text.includes("mode MANUAL") &&
    text.includes("A1 OFF") &&
    text.includes("S1 apparatus only · companion authority locked to MANUAL")
  );
}

async function resetDanger(page) {
  await page.getByRole("button", { name: "Danger", exact: true }).click();
  return waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("phase APPROACHING") &&
      text.includes("last world outcome NONE"),
    8_000,
    "fresh shared-danger apparatus"
  );
}

async function waitWindup(page) {
  return waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("phase WINDUP") &&
      text.includes("last world outcome NONE"),
    10_000,
    "shared-danger WINDUP"
  );
}

async function shot(page, name) {
  await page.screenshot({
    path: `${ROOT}/${name}.png`,
    type: "png",
    fullPage: true
  });
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

  await page.getByRole("button", { name: "Danger", exact: true }).click();
  const initial = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("phase APPROACHING") &&
      text.includes("last world outcome NONE"),
    8_000,
    "S1 apparatus initial state"
  );
  const initialTick = tickFromPanel(initial);
  invariant(initialTick !== null, "S1 apparatus exposed no world tick.");

  const commandHud = page.locator('[data-player-command-hud="true"]');
  invariant(!(await commandHud.isVisible()), "Experimental command HUD leaked into zero-brain S1 apparatus.");

  const apparatusHud = page.locator('[data-shared-danger-hud="true"]');
  invariant(await apparatusHud.isVisible(), "S1 manual apparatus HUD is missing.");
  invariant(
    !(await apparatusHud.textContent()).includes("APPROACHING") &&
    !(await apparatusHud.textContent()).includes("WINDUP") &&
    !(await apparatusHud.textContent()).includes("PLAYER_HIT") &&
    !(await apparatusHud.textContent()).includes("INTERRUPTED"),
    "Player-facing S1 HUD leaks semantic phase/outcome labels."
  );

  // Collapse the causal microscope for all visual evidence. Text assertions below
  // still read its hidden DOM, while screenshots remain participant-first.
  await page.locator(".debug-collapse").click();
  invariant(
    await page.locator("#debug-panel").evaluate((node) => node.classList.contains("is-collapsed")),
    "S1 browser evidence could not collapse causal panel."
  );
  await shot(page, "01-approaching-participant");

  // Explicit action during APPROACHING must fail; it cannot be rescued by later
  // state transition in the same tick.
  await apparatusHud.getByRole("button", { name: "Player intervene", exact: true }).click();
  const invalidPhase = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("latest attempts player:INVALID_PHASE"),
    4_000,
    "APPROACHING intervention rejection"
  );

  // No intervention: committed consequence must land.
  await resetDanger(page);
  const windup = await waitWindup(page);
  const windupTick = tickFromPanel(windup);
  invariant(windupTick !== null, "S1 WINDUP exposed no tick.");
  await shot(page, "02-windup-participant");

  const hit = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("last world outcome PLAYER_HIT") &&
      text.includes("phase RECOVERING"),
    6_000,
    "unopposed hostile consequence"
  );
  await shot(page, "03-player-hit-participant");

  // Player can materially affect the same problem.
  await resetDanger(page);
  await waitWindup(page);
  await apparatusHud.getByRole("button", { name: "Player intervene", exact: true }).click();
  const playerInterrupt = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("latest attempts player:SUCCEEDED") &&
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by player"),
    4_000,
    "player factual intervention"
  );
  await shot(page, "04-player-interrupt-participant");

  // Companion attempt from its authored start must be factually too far.
  await resetDanger(page);
  await waitWindup(page);
  await apparatusHud.getByRole("button", { name: "Companion intervene", exact: true }).click();
  const companionTooFar = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("latest attempts companion:OUT_OF_RANGE"),
    4_000,
    "manual companion out-of-range failure"
  );

  // Manual movement can create a real opportunity, then the exact same action
  // succeeds under the exact same World rule.
  await resetDanger(page);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(450);
  await page.keyboard.up("ArrowLeft");
  await waitWindup(page);
  await apparatusHud.getByRole("button", { name: "Companion intervene", exact: true }).click();
  const companionInterrupt = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("latest attempts companion:SUCCEEDED") &&
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion"),
    4_000,
    "manual companion factual intervention"
  );
  await shot(page, "05-companion-interrupt-participant");

  // Movement itself also matters: leave attack range during the telegraphed
  // commitment and let World classify the factual miss without an action attempt.
  await resetDanger(page);
  await waitWindup(page);
  await page.keyboard.down("a");
  const missed = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("last world outcome ATTACK_MISSED") &&
      text.includes("phase RECOVERING"),
    5_000,
    "player dodge factual miss"
  );
  await page.keyboard.up("a");
  await shot(page, "06-attack-missed-participant");

  // One-shot scope must remain visible in the live browser runtime.
  const complete = await waitForPanel(
    page,
    (text) =>
      apparatusBaseline(text) &&
      text.includes("phase COMPLETE") &&
      text.includes("last world outcome ATTACK_MISSED"),
    4_000,
    "one-shot encounter completion"
  );

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "S1 apparatus runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-s1-shared-danger-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    initialTick,
    windupTick,
    participantSurface: {
      causalPanelCollapsedForScreenshots: true,
      semanticStateHiddenFromManualHud: true,
      companionAuthority: "MANUAL"
    },
    outcomes: {
      approachingAttempt: invalidPhase.includes("player:INVALID_PHASE"),
      unopposed: hit.includes("PLAYER_HIT"),
      playerIntervention: playerInterrupt.includes("player:SUCCEEDED"),
      companionOutOfRange: companionTooFar.includes("companion:OUT_OF_RANGE"),
      manualCompanionIntervention: companionInterrupt.includes("companion:SUCCEEDED"),
      playerDodge: missed.includes("ATTACK_MISSED"),
      oneShotComplete: complete.includes("phase COMPLETE")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[S1_SHARED_DANGER_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
