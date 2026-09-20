import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ROOT = "artifacts/readiness-browser";

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
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 5600))}`);
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

  // A — awareness must become embodied preparation before material responsibility exists.
  const guarding = await waitForPanel(
    page,
    (text) =>
      text.includes("phase APPROACHING") &&
      text.includes("attention TRACKING") &&
      text.includes("responsibility NONE") &&
      text.includes("state GUARDING") &&
      text.includes("basis INTERCEPT_FLANK_AVAILABLE") &&
      text.includes("guard target") &&
      text.includes("READINESS MOVEMENT ONLY") &&
      text.includes("latest attempts none"),
    8_000,
    "pre-contact guarding readiness"
  );
  invariant(
    !guarding.includes("latest attempts companion:"),
    "Readiness emitted a companion World action before hostile commitment."
  );
  await shot(page, "01-readiness-guarding-participant.png");

  // Freeze the exact preparation state and prove the full causal microscope remains in the same runtime.
  await page.keyboard.press("p");
  await page.locator(".debug-collapse").click();
  const expanded = await panelText(page);
  invariant(
    expanded.includes("Pre-contact readiness · player-local guard") &&
      expanded.includes("state GUARDING") &&
      expanded.includes("S2 zero authority") &&
      expanded.includes("S3 bounded material contribution") &&
      expanded.includes("S4 corrigibility"),
    "Expanded workbench does not expose the readiness -> responsibility -> contribution -> correction chain."
  );
  await shot(page, "02-readiness-workbench-expanded.png");
  await page.locator(".debug-collapse").click();
  await page.keyboard.press("p");

  // Q is intentionally narrower than readiness: it withholds intervention, not preparatory movement.
  await page.keyboard.down("q");
  const qDuringApproach = await waitForPanel(
    page,
    (text) =>
      text.includes("phase APPROACHING") &&
      text.includes("correction WITHHOLD_CURRENT_CONTRIBUTION") &&
      (text.includes("state GUARDING") || text.includes("state HOLDING_READY")) &&
      text.includes("latest attempts none"),
    3_000,
    "Q does not erase pre-contact readiness"
  );
  invariant(
    await page.getByText("Q HELD · companion intervention withheld").isVisible(),
    "Participant surface does not acknowledge the intervention-only correction."
  );

  // B — preparation must settle once the player-local intercept flank is reached.
  const holding = await waitForPanel(
    page,
    (text) =>
      text.includes("phase APPROACHING") &&
      text.includes("attention TRACKING") &&
      text.includes("responsibility NONE") &&
      text.includes("state HOLDING_READY") &&
      text.includes("basis INTERCEPT_FLANK_REACHED") &&
      text.includes("latest attempts none"),
    8_000,
    "reached pre-contact intercept flank"
  );
  invariant(
    holding.includes("READINESS MOVEMENT ONLY"),
    "Reached readiness flank lost its movement-only contract."
  );
  await shot(page, "03-readiness-holds-before-commitment.png");

  // C — once commitment occurs, readiness must yield to existing S2/S3/S4 authority.
  const committedBlocked = await waitForPanel(
    page,
    (text) =>
      text.includes("phase WINDUP") &&
      text.includes("state NONE") &&
      text.includes("responsibility OWNED") &&
      text.includes("correction WITHHOLD_CURRENT_CONTRIBUTION") &&
      (text.includes("raw S3 APPROACH_INTERVENTION") || text.includes("raw S3 INTERVENE")) &&
      text.includes("blocked YES") &&
      text.includes("effective world action none") &&
      text.includes("latest attempts none"),
    6_000,
    "readiness yields at hostile commitment"
  );
  await shot(page, "04-windup-handed-to-s3-but-withheld.png");

  // D — release the correction; the existing material autonomy must finish the handoff.
  await page.keyboard.up("q");
  const interrupted = await waitForPanel(
    page,
    (text) =>
      text.includes("last world outcome INTERRUPTED") &&
      text.includes("interrupted by companion") &&
      text.includes("latest attempts companion:SUCCEEDED"),
    5_000,
    "post-readiness material companion intervention"
  );
  await shot(page, "05-readiness-to-material-interrupt.png");

  invariant(
    guarding.includes("responsibility NONE") &&
      guarding.includes("state GUARDING") &&
      guarding.includes("latest attempts none"),
    "Readiness did not remain pre-responsibility and action-free."
  );
  invariant(
    qDuringApproach.includes("phase APPROACHING") &&
      (qDuringApproach.includes("state GUARDING") || qDuringApproach.includes("state HOLDING_READY")),
    "Q incorrectly acted as a global companion freeze instead of an intervention correction."
  );
  invariant(
    holding.includes("state HOLDING_READY") &&
      holding.includes("responsibility NONE") &&
      holding.includes("latest attempts none"),
    "Readiness failed to settle at the intercept flank before commitment."
  );
  invariant(
    committedBlocked.includes("state NONE") &&
      committedBlocked.includes("responsibility OWNED") &&
      committedBlocked.includes("blocked YES"),
    "Authority did not hand off cleanly from readiness to situated material contribution."
  );
  invariant(
    interrupted.includes("interrupted by companion"),
    "Existing S3 material contribution did not resume after readiness/correction handoff."
  );
  invariant(
    await page.locator("#runtime-fault-sentinel").count() === 0,
    "Readiness runtime fault sentinel is visible."
  );
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);

  const summary = {
    schema: "companion-brain-lab-readiness-browser-v1",
    sourceSha: process.env.GITHUB_SHA ?? process.env.VITE_SOURCE_SHA ?? null,
    outcomes: {
      trackingBecomesGuardingBeforeResponsibility:
        guarding.includes("state GUARDING") && guarding.includes("responsibility NONE"),
      readinessProducesNoPrematureWorldAction: guarding.includes("latest attempts none"),
      sameRuntimeCausalMicroscopeAvailable:
        expanded.includes("Pre-contact readiness") && expanded.includes("S4 corrigibility"),
      qScopesToInterventionRatherThanReadiness:
        qDuringApproach.includes("phase APPROACHING") &&
        !qDuringApproach.includes("state NONE"),
      reachedInterceptFlankStopsAdvance:
        holding.includes("state HOLDING_READY") && holding.includes("latest attempts none"),
      windupHandsAuthorityToS2S3S4:
        committedBlocked.includes("state NONE") &&
        committedBlocked.includes("responsibility OWNED") &&
        committedBlocked.includes("blocked YES"),
      releaseCompletesMaterialContribution:
        interrupted.includes("interrupted by companion")
    },
    errors
  };

  await writeFile(`${ROOT}/summary.json`, JSON.stringify(summary, null, 2), "utf8");
  console.log("[READINESS_BROWSER]", JSON.stringify(summary));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
