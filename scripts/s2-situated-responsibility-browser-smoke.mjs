import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/s2-situated-responsibility-browser";

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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 3600))}`);
}

function s2Baseline(text) {
  return (
    text.includes("scenario Shared danger apparatus") &&
    text.includes("mode MANUAL") &&
    text.includes("A1 OFF") &&
    text.includes("S2 zero authority") &&
    text.includes("S2 ZERO AUTHORITY")
  );
}

async function resetDanger(page) {
  await page.locator('[data-action="scenario-shared-danger"]').evaluate((button) => button.click());
  return waitForPanel(
    page,
    (text) =>
      s2Baseline(text) &&
      text.includes("attention TRACKING") &&
      text.includes("responsibility NONE") &&
      text.includes("basis APPROACHING_MONITOR_ONLY") &&
      text.includes("latest attempts none"),
    8_000,
    "fresh S2 shared-danger state"
  );
}

async function waitWindup(page, extra = () => true, label = "S2 WINDUP") {
  return waitForPanel(
    page,
    (text) =>
      s2Baseline(text) &&
      text.includes("phase WINDUP") &&
      extra(text),
    10_000,
    label
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

  const approaching = await waitForPanel(
    page,
    (text) =>
      s2Baseline(text) &&
      text.includes("focus hostile") &&
      text.includes("attention TRACKING") &&
      text.includes("responsibility NONE") &&
      text.includes("basis APPROACHING_MONITOR_ONLY"),
    8_000,
    "S2 approaching monitor"
  );
  invariant(approaching.includes("latest attempts none"), "S2 emitted an action while only monitoring.");
  await shot(page, "01-approaching-monitor.png");

  const owned = await waitWindup(
    page,
    (text) =>
      text.includes("player risk YES") &&
      text.includes("responsibility OWNED") &&
      text.includes("basis INTERVENTION_REACHABLE_BEFORE_CONSEQUENCE") &&
      text.includes("latest attempts none"),
    "reachable S2 responsibility"
  );
  invariant(owned.includes("latest attempts none"), "OWNED responsibility emitted an unauthorized action.");
  await shot(page, "02-owned-zero-authority.png");

  const hit = await waitForPanel(
    page,
    (text) =>
      s2Baseline(text) &&
      text.includes("last world outcome PLAYER_HIT") &&
      text.includes("phase RECOVERING") &&
      text.includes("responsibility NONE") &&
      text.includes("basis EPISODE_RESOLVING") &&
      text.includes("latest attempts none"),
    6_000,
    "OWNED-but-no-authority unopposed consequence"
  );
  await shot(page, "03-owned-does-not-act.png");

  await resetDanger(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");

  const unreachable = await waitWindup(
    page,
    (text) =>
      text.includes("player risk YES") &&
      text.includes("responsibility NONE") &&
      text.includes("basis INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE"),
    "same WINDUP with unreachable companion"
  );
  await shot(page, "04-same-windup-unreachable.png");

  await resetDanger(page);
  await waitWindup(
    page,
    (text) => text.includes("responsibility OWNED"),
    "pre-dodge owned responsibility"
  );
  await page.keyboard.down("a");
  const playerSafe = await waitForPanel(
    page,
    (text) =>
      s2Baseline(text) &&
      text.includes("phase WINDUP") &&
      text.includes("player risk no") &&
      text.includes("responsibility NONE") &&
      text.includes("basis PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE"),
    4_000,
    "player movement withdraws S2 responsibility"
  );
  await page.keyboard.up("a");
  await shot(page, "05-player-safe-withdrawal.png");

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "S2 runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-s2-situated-responsibility-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      approachingTracksWithoutOwnership: approaching.includes("APPROACHING_MONITOR_ONLY"),
      reachableWindupOwnsResponsibility: owned.includes("responsibility OWNED"),
      ownedStateHasZeroActionAuthority:
        owned.includes("latest attempts none") &&
        hit.includes("PLAYER_HIT") &&
        hit.includes("latest attempts none"),
      sameWindupCanBeUnreachable:
        unreachable.includes("INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE"),
      playerStateCanWithdrawResponsibility:
        playerSafe.includes("PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[S2_SITUATED_RESPONSIBILITY_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
