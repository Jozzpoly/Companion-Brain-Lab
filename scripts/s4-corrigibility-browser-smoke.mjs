import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/s4-corrigibility-browser";

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
    await page.waitForTimeout(15);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 5000))}`);
}

async function loadDanger(page) {
  await page.locator('[data-action="scenario-shared-danger"]').evaluate((button) => button.click());
  return waitForPanel(
    page,
    (text) =>
      text.includes("scenario Shared danger apparatus") &&
      text.includes("mode MANUAL") &&
      text.includes("S3 bounded material contribution") &&
      text.includes("authority OFF") &&
      text.includes("S4 corrigibility") &&
      text.includes("correction NONE") &&
      text.includes("basis APPROACHING_MONITOR_ONLY") &&
      text.includes("latest attempts none"),
    8_000,
    "fresh S4 baseline"
  );
}

async function enableS3(page) {
  await page.locator('[data-action="toggle-s3-authority"]').click();
  return waitForPanel(
    page,
    (text) => text.includes("authority ON") && text.includes("S3 bounded authority ON"),
    4_000,
    "S3 enabled"
  );
}

async function armWithhold(page) {
  await page.locator('[data-action="toggle-s4-withhold"]').click();
  return waitForPanel(
    page,
    (text) => text.includes("correction WITHHOLD_CURRENT_CONTRIBUTION"),
    4_000,
    "S4 withhold armed"
  );
}

async function waitForBlockedOwned(page) {
  return waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("responsibility OWNED") &&
      text.includes("correction WITHHOLD_CURRENT_CONTRIBUTION") &&
      (text.includes("raw S3 APPROACH_INTERVENTION") || text.includes("raw S3 INTERVENE")) &&
      text.includes("blocked YES") &&
      text.includes("effective move 0.000, 0.000") &&
      text.includes("effective world action none") &&
      text.includes("latest attempts none"),
    10_000,
    "S4 blocks an earned S3 proposal without erasing it"
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

  // A — baseline: without correction, bounded S3 autonomy still changes World.
  await loadDanger(page);
  await enableS3(page);
  const baselineHelp = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion") &&
      text.includes("latest attempts companion:SUCCEEDED"),
    12_000,
    "S4 baseline autonomous help"
  );
  await shot(page, "01-no-correction-companion-helps.png");

  // B — player correction blocks execution while S2/raw S3 remain live.
  await loadDanger(page);
  await enableS3(page);
  await armWithhold(page);
  const blocked = await waitForBlockedOwned(page);
  await shot(page, "02-owned-proposal-withheld.png");

  await page.locator('[data-action="s1-player-intervene"]').click();
  const playerOwned = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by player") &&
      text.includes("latest attempts player:SUCCEEDED") &&
      !text.includes("companion:SUCCEEDED"),
    4_000,
    "player resolves problem while companion is withheld"
  );
  await shot(page, "03-player-intervenes-under-correction.png");

  // C — correction is reversible; release lets still-valid autonomy resume.
  await loadDanger(page);
  await enableS3(page);
  await armWithhold(page);
  const beforeRelease = await waitForBlockedOwned(page);
  await page.locator('[data-action="toggle-s4-withhold"]').click();

  const released = await waitForPanel(
    page,
    (text) =>
      text.includes("correction NONE") &&
      text.includes("responsibility OWNED") &&
      text.includes("blocked no"),
    2_000,
    "S4 correction released while responsibility remains owned"
  );

  const resumed = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion") &&
      text.includes("latest attempts companion:SUCCEEDED"),
    8_000,
    "autonomy resumes after correction release"
  );
  await shot(page, "04-release-autonomy-resumes.png");

  invariant(
    blocked.includes("responsibility OWNED") &&
      blocked.includes("blocked YES") &&
      (blocked.includes("raw S3 APPROACH_INTERVENTION") || blocked.includes("raw S3 INTERVENE")),
    "S4 failed to preserve an inspectable owned/raw proposal while blocking execution."
  );
  invariant(
    playerOwned.includes("interrupted by player") && !playerOwned.includes("companion:SUCCEEDED"),
    "S4 correction failed to preserve player-owned resolution."
  );
  invariant(
    beforeRelease.includes("correction WITHHOLD_CURRENT_CONTRIBUTION") &&
      released.includes("correction NONE") &&
      resumed.includes("interrupted by companion"),
    "S4 correction was not reversibly constraining the existing autonomy."
  );
  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "S4 runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-s4-corrigibility-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      baselineAutonomyStillUseful: baselineHelp.includes("interrupted by companion"),
      correctionPreservesOwnedJudgement:
        blocked.includes("responsibility OWNED") &&
        blocked.includes("blocked YES"),
      correctionPreservesRawProposal:
        blocked.includes("raw S3 APPROACH_INTERVENTION") ||
        blocked.includes("raw S3 INTERVENE"),
      playerCanOwnOutcomeWhileCorrectionHolds:
        playerOwned.includes("interrupted by player") &&
        !playerOwned.includes("companion:SUCCEEDED"),
      releaseRestoresAutonomousContribution:
        released.includes("correction NONE") &&
        resumed.includes("interrupted by companion")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[S4_CORRIGIBILITY_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
