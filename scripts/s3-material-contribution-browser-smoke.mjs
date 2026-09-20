import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/s3-material-contribution-browser";

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
    await page.waitForTimeout(20);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 4200))}`);
}

async function loadDanger(page) {
  await page.locator('[data-action="scenario-shared-danger"]').evaluate((button) => button.click());
  return waitForPanel(
    page,
    (text) =>
      text.includes("scenario Shared danger apparatus") &&
      text.includes("mode MANUAL") &&
      text.includes("S2 zero authority") &&
      text.includes("S3 bounded material contribution") &&
      text.includes("authority OFF") &&
      text.includes("basis APPROACHING_MONITOR_ONLY") &&
      text.includes("latest attempts none"),
    8_000,
    "fresh S3 shared-danger baseline"
  );
}

async function enableS3(page) {
  await page.locator('[data-action="toggle-s3-authority"]').click();
  return waitForPanel(
    page,
    (text) =>
      text.includes("S3 bounded material contribution") &&
      text.includes("authority ON") &&
      text.includes("S3 bounded authority ON"),
    4_000,
    "S3 authority enabled"
  );
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
  await page.getByRole("button", { name: "Danger", exact: true }).click();

  // A: earned responsibility becomes one useful material contribution.
  await loadDanger(page);
  await enableS3(page);
  const owned = await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("responsibility OWNED") &&
      text.includes("authority ON"),
    10_000,
    "S3 earned responsibility"
  );
  await shot(page, "01-owned-before-contribution.png");

  const interrupted = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion") &&
      text.includes("latest attempts companion:SUCCEEDED") &&
      text.includes("phase RECOVERING"),
    6_000,
    "S3 autonomous companion intervention"
  );
  invariant(!interrupted.includes("player:SUCCEEDED"), "S3 success was confounded by a player intervention.");
  await shot(page, "02-autonomous-companion-interrupt.png");

  // B: same authority switch cannot bypass an unearned responsibility.
  await loadDanger(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  await enableS3(page);
  const unreachable = await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("basis INTERVENTION_NOT_REACHABLE_BEFORE_CONSEQUENCE") &&
      text.includes("responsibility NONE") &&
      text.includes("authority ON") &&
      text.includes("proposal NONE"),
    10_000,
    "S3 refuses unreachable responsibility"
  );
  await shot(page, "03-unreachable-no-contribution.png");

  const unreachableHit = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome PLAYER_HIT") &&
      text.includes("latest attempts none"),
    6_000,
    "unreachable S3 remains inert"
  );

  // C: player movement can remove the causal basis before S3 acts.
  await loadDanger(page);
  await enableS3(page);
  await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("responsibility OWNED"),
    10_000,
    "pre-dodge S3 responsibility"
  );
  await page.keyboard.down("a");
  const withdrawn = await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("basis PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE") &&
      text.includes("responsibility NONE") &&
      text.includes("proposal NONE") &&
      text.includes("authority ON"),
    4_000,
    "player removes S3 responsibility"
  );
  await page.keyboard.up("a");
  await shot(page, "04-player-removes-causal-basis.png");

  const missed = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome ATTACK_MISSED") &&
      text.includes("interrupted by none") &&
      !text.includes("latest attempts companion:SUCCEEDED"),
    6_000,
    "player dodge remains player-owned outcome"
  );
  await shot(page, "05-player-dodge-not-stolen.png");

  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "S3 runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-s3-material-contribution-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      ownedResponsibilityObserved: owned.includes("responsibility OWNED"),
      autonomousContributionInterruptedWorld:
        interrupted.includes("INTERRUPTED") &&
        interrupted.includes("interrupted by companion"),
      unearnedResponsibilityProducesNoContribution:
        unreachable.includes("proposal NONE") &&
        unreachableHit.includes("PLAYER_HIT") &&
        unreachableHit.includes("latest attempts none"),
      playerCanRemoveCausalBasis:
        withdrawn.includes("PLAYER_ALREADY_OUTSIDE_ATTACK_RANGE") &&
        withdrawn.includes("proposal NONE"),
      playerOwnedDodgeNotStolen:
        missed.includes("ATTACK_MISSED") &&
        missed.includes("interrupted by none")
    },
    errors
  };
  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[S3_MATERIAL_CONTRIBUTION_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
