import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/teammate-participant-browser";

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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 5200))}`);
}

async function reset(page) {
  await page.keyboard.press("r");
  return waitForPanel(
    page,
    (text) =>
      text.includes("scenario Shared danger apparatus") &&
      text.includes("authority ON") &&
      text.includes("correction NONE") &&
      text.includes("basis APPROACHING_MONITOR_ONLY") &&
      text.includes("latest attempts none"),
    8_000,
    "fresh participant specimen"
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

  await page.goto("http://127.0.0.1:4173/?teammate=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator('[data-shared-danger-hud="true"]').waitFor({ state: "visible", timeout: 10_000 });

  invariant(
    (await page.title()) === "Companion Brain Lab — Teammate Specimen",
    `Unexpected participant title: ${await page.title()}`
  );
  invariant(
    await page.locator("#debug-panel").evaluate((node) => node.classList.contains("is-collapsed")),
    "Teammate specimen must begin participant-first with the full workbench collapsed."
  );
  invariant(
    !(await page.locator("#debug-panel").evaluate((node) => node.classList.contains("is-owner-sandbox"))),
    "Teammate specimen must not reuse the stripped historical owner sandbox."
  );
  await shot(page, "00-participant-bootstrap.png");
  invariant(
    await page.locator('[data-shared-danger-hud="true"]').getByRole("button", { name: "Companion intervene", includeHidden: true }).isHidden(),
    "Manual companion intervention must be hidden in teammate specimen."
  );
  invariant(
    await page.getByText("WASD move · E intervene · hold Q to withhold intervention").isVisible(),
    "Participant-facing teammate controls are not visible."
  );

  const initial = await waitForPanel(
    page,
    (text) =>
      text.includes("scenario Shared danger apparatus") &&
      text.includes("authority ON") &&
      text.includes("S4 corrigibility") &&
      text.includes("correction NONE"),
    8_000,
    "participant specimen auto-arm"
  );
  await shot(page, "01-participant-first-start.png");

  // Full causal workbench must remain available in the same runtime.
  await page.locator(".debug-collapse").click();
  invariant(
    !(await page.locator("#debug-panel").evaluate((node) => node.classList.contains("is-collapsed"))),
    "Teammate specimen workbench could not be expanded."
  );
  invariant(
    (await panelText(page)).includes("S2 zero authority") &&
      (await panelText(page)).includes("S3 bounded material contribution") &&
      (await panelText(page)).includes("S4 corrigibility"),
    "Expanded teammate workbench is missing S2/S3/S4 causal evidence."
  );
  await shot(page, "02-same-runtime-workbench-expanded.png");
  await page.locator(".debug-collapse").click();

  // A: no correction -> autonomy contributes without debug interaction.
  const autonomous = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion") &&
      text.includes("latest attempts companion:SUCCEEDED"),
    12_000,
    "participant autonomy changes World"
  );

  // B: Q is a held correction; cognition/raw proposal survive and Enter cannot fake manual help.
  await reset(page);
  await page.keyboard.down("q");
  const held = await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("responsibility OWNED") &&
      text.includes("correction WITHHOLD_CURRENT_CONTRIBUTION") &&
      (text.includes("raw S3 APPROACH_INTERVENTION") || text.includes("raw S3 INTERVENE")) &&
      text.includes("blocked YES") &&
      text.includes("effective world action none") &&
      text.includes("latest attempts none"),
    10_000,
    "participant Q correction blocks effective contribution"
  );
  invariant(
    await page.getByText("Q HELD · companion intervention withheld").isVisible(),
    "Held correction has no participant-facing acknowledgement."
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  invariant(
    (await panelText(page)).includes("latest attempts none"),
    "Enter manually controlled the companion in teammate specimen."
  );
  await shot(page, "03-q-held-companion-withheld.png");

  await page.keyboard.press("e");
  const playerOwned = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by player") &&
      text.includes("latest attempts player:SUCCEEDED") &&
      !text.includes("companion:SUCCEEDED"),
    4_000,
    "participant owns outcome while Q holds"
  );
  await page.keyboard.up("q");

  // C: hold is reversible; releasing Q restores still-valid autonomy.
  await reset(page);
  await page.keyboard.down("q");
  const blockedBeforeRelease = await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("responsibility OWNED") &&
      text.includes("blocked YES"),
    10_000,
    "participant holds contribution before release"
  );
  await page.keyboard.up("q");
  const resumed = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion") &&
      text.includes("latest attempts companion:SUCCEEDED"),
    8_000,
    "autonomy resumes after participant releases Q"
  );
  await shot(page, "04-q-release-autonomy-resumes.png");

  invariant(initial.includes("authority ON"), "Teammate specimen did not auto-enable bounded autonomy.");
  invariant(autonomous.includes("interrupted by companion"), "Autonomy did not materially help from participant path.");
  invariant(
    held.includes("responsibility OWNED") && held.includes("blocked YES"),
    "Participant correction erased judgement instead of constraining execution."
  );
  invariant(
    playerOwned.includes("interrupted by player") && !playerOwned.includes("companion:SUCCEEDED"),
    "Participant correction failed to preserve player-owned resolution."
  );
  invariant(
    blockedBeforeRelease.includes("blocked YES") &&
      resumed.includes("interrupted by companion"),
    "Hold-to-correct input did not reversibly constrain autonomy."
  );
  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Participant specimen runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-teammate-participant-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      startsInSharedSituationWithAutonomy: initial.includes("authority ON"),
      sameRuntimeWorkbenchAvailable: true,
      manualCompanionPathHiddenAndDisabled: true,
      autonomousContributionVisibleFromParticipantPath: autonomous.includes("interrupted by companion"),
      holdCorrectionPreservesJudgement:
        held.includes("responsibility OWNED") && held.includes("blocked YES"),
      playerCanOwnOutcomeWhileHoldingCorrection:
        playerOwned.includes("interrupted by player") && !playerOwned.includes("companion:SUCCEEDED"),
      releaseRestoresAutonomy:
        blockedBeforeRelease.includes("blocked YES") && resumed.includes("interrupted by companion")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[TEAMMATE_PARTICIPANT_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
