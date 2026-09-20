import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/a1-commitment-live";
const SCHEMA = "companion-brain-lab-a1-commitment-live-v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function panelText(page) {
  return page.locator("#debug-panel").innerText();
}

async function waitForPanel(page, predicate, timeout = 15_000, label = "panel condition") {
  const startedAt = Date.now();
  let latest = "";
  while (Date.now() - startedAt < timeout) {
    latest = await panelText(page).catch(() => "");
    if (predicate(latest)) return latest;
    await page.waitForTimeout(50);
  }
  throw new Error(`${label} timed out. Latest panel: ${JSON.stringify(latest.slice(0, 2500))}`);
}

async function shadow(page) {
  return page.evaluate(() => window.__relationshipCommitmentShadowBridge?.snapshot() ?? null);
}

async function latest(page) {
  return page.evaluate(() => window.__relationshipCommitmentShadowBridge?.latest() ?? null);
}

async function singleStep(page, label) {
  const before = await shadow(page);
  invariant(before, `${label}: commitment bridge missing.`);
  const expectedCount = before.frameCount + 1;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__relationshipCommitmentShadowBridge?.snapshot().frameCount ?? 0) >= count,
    expectedCount,
    { timeout: 15_000 }
  );
  const value = await latest(page);
  invariant(value, `${label}: no commitment frame after step.`);
  return value;
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible.");
  invariant(errors.page.length === 0, `Page errors: ${errors.page.join(" | ")}`);
  invariant(errors.console.length === 0, `Console errors: ${errors.console.join(" | ")}`);
  invariant(errors.requests.length === 0, `Failed requests: ${errors.requests.join(" | ")}`);
}

const server = await preview({
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true }
});

let browser;
try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = { page: [], console: [], requests: [] };
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.requests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.goto("http://127.0.0.1:4173/?commitmentshadow=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    () => window.__relationshipCommitmentShadowBridge?.enabled === true,
    null,
    { timeout: 10_000 }
  );

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "initial pause");
  await page.locator('[data-action="scenario-open"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Open field") && text.includes("PAUSED") && text.includes("A1 OFF"),
    15_000,
    "paused open reset"
  );
  await page.evaluate(() => window.__relationshipCommitmentShadowBridge?.clear());
  await page.evaluate(() => window.__relationshipCommitmentShadowBridge?.armNextFrame("PLAYER_RIGID"));

  await page.keyboard.down("d");
  const established = await singleStep(page, "establish +X commitment");
  await page.keyboard.up("d");

  invariant(established.tick === 0, `Expected declaration at tick 0, got ${established.tick}.`);
  invariant(established.a1Variant === "off", "A1 movement authority must remain OFF in commitment specimen.");
  invariant(established.canonicalOrientation.source === "SAME_STEP_OWNER", "Declaration lacks same-step Owner semantics.");
  invariant(established.referenceResolution.status === "RESOLVED", "Declaration reference did not resolve.");
  invariant(established.referenceResolution.currentBasisProvenance === "CANONICAL_SEMANTIC_ORIENTATION", "Declaration reference provenance is not canonical.");
  invariant(established.fit.semanticStatus === "COMPARABLE", "Declaration fit is not semantically comparable.");
  invariant(established.fit.pressureStatus === "EXACT_ON_SAMPLED_MESH", "Declaration fit is not exact on sampled mesh.");
  invariant((established.fit.sampledPressureDistance ?? Infinity) < 1e-8, "Declaration pressure is not approximately zero.");

  await page.keyboard.down("d");
  await page.keyboard.down("s");
  const turn = await singleStep(page, "translate plus diagonal turn");
  await page.keyboard.up("d");
  await page.keyboard.up("s");

  invariant(turn.a1Variant === "off", "A1 movement authority changed during turn.");
  invariant(turn.canonicalOrientation.source === "SAME_STEP_OWNER", "Turn lacks fresh Owner semantics.");
  invariant(turn.referenceResolution.status === "RESOLVED", "Turn reference did not resolve.");
  invariant(turn.referenceResolution.currentBasisProvenance === "CANONICAL_SEMANTIC_ORIENTATION", "Turn did not use canonical basis.");
  invariant(turn.fit.semanticStatus === "COMPARABLE", "Turn fit lost semantic comparability.");
  invariant((turn.fit.sampledPressureDistance ?? Infinity) < 1e-8, "Rigid commitment did not stay on sampled opportunity through turn.");

  await page.evaluate(() => window.__relationshipCommitmentShadowBridge?.setRetainedReferenceEnabled(true));

  let retainedExpiry = null;
  for (let index = 0; index < 50; index += 1) {
    const frame = await singleStep(page, `silence-${index + 1}`);
    if (frame.canonicalOrientation.source === "NONE") {
      retainedExpiry = frame;
      break;
    }
  }
  invariant(retainedExpiry, "Canonical semantic orientation did not expire to NONE.");
  invariant(retainedExpiry.a1Variant === "off", "A1 movement authority changed at expiry.");
  invariant(retainedExpiry.canonicalOrientation.samplingBasisSource === "WORLD_AXIS_SAMPLING_ONLY", "NONE did not expose non-semantic sampling basis.");
  invariant(retainedExpiry.referenceResolution.status === "RESOLVED", "Explicit retained reference did not remain geometrically resolvable.");
  invariant(retainedExpiry.referenceResolution.currentBasisProvenance === "RETAINED_LAST_SEMANTIC_FRAME", "Expiry did not expose retained reference provenance.");
  invariant((retainedExpiry.referenceResolution.currentBasisAgeTicks ?? 0) > 0, "Retained reference did not expose positive age.");
  invariant(retainedExpiry.fit.semanticStatus === "ORIENTATION_REGIME_CHANGED", "Retained geometry incorrectly preserved live directional semantic comparability.");
  invariant(retainedExpiry.fit.pressureStatus === "NON_COMPARABLE", "Retained geometry incorrectly emitted spatial pressure against directionless semantics.");
  invariant(retainedExpiry.fit.sampledPressureDistance === null, "Retained expiry fabricated sampled pressure.");

  await page.evaluate(() => window.__relationshipCommitmentShadowBridge?.setRetainedReferenceEnabled(false));
  const unresolved = await singleStep(page, "expiry without retained reference");
  invariant(unresolved.canonicalOrientation.source === "NONE", "Canonical semantics unexpectedly returned before reversal.");
  invariant(unresolved.referenceResolution.status === "UNRESOLVED", "Reference should be unresolved after retained basis is disabled.");
  invariant(unresolved.referenceResolution.unresolvedReason === "CURRENT_BASIS_MISSING", "Unexpected unresolved reason.");
  invariant(unresolved.fit.pressureStatus === "NON_COMPARABLE", "Unresolved reference emitted pressure.");
  invariant(unresolved.fit.sampledPressureDistance === null, "Unresolved reference fabricated sampled pressure.");

  await page.keyboard.down("a");
  const reversal = await singleStep(page, "fresh -X reversal");
  await page.keyboard.up("a");

  invariant(reversal.a1Variant === "off", "A1 movement authority changed at reversal.");
  invariant(reversal.canonicalOrientation.source === "SAME_STEP_OWNER", "Fresh reversal did not immediately restore canonical Owner semantics.");
  invariant((reversal.canonicalOrientation.direction?.x ?? 0) < -0.9, "Fresh reversal canonical direction is not -X.");
  invariant(reversal.referenceResolution.status === "RESOLVED", "Fresh reversal did not restore reference resolution.");
  invariant(reversal.referenceResolution.currentBasisProvenance === "CANONICAL_SEMANTIC_ORIENTATION", "Fresh reversal did not restore canonical basis provenance.");
  invariant(reversal.fit.semanticStatus === "COMPARABLE", "Fresh reversal did not restore semantic comparability.");
  invariant(reversal.fit.pressureStatus === "EXACT_ON_SAMPLED_MESH", "Fresh reversal did not restore exact sampled fit.");
  invariant((reversal.fit.sampledPressureDistance ?? Infinity) < 1e-8, "Fresh reversal rigid commitment is not on sampled opportunity.");

  const snapshot = await shadow(page);
  invariant(snapshot?.lastError === null, `Commitment shadow recorded error: ${snapshot?.lastError}`);
  invariant(snapshot?.authority === "NONE_QUERY_ONLY_NO_INTENT_MUTATION", "Commitment shadow authority contract changed.");

  await assertNoFault(page, errors);

  const participant = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  const research = await page.screenshot({ type: "jpeg", quality: 65, fullPage: true });
  await writeFile(`${ARTIFACT_DIR}/participant.jpg`, participant);
  await writeFile(`${ARTIFACT_DIR}/research.jpg`, research);

  const summary = {
    schema: SCHEMA,
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "open",
    scheduler: "PAUSED_RESET_EXACT_SINGLE_STEP",
    authority: snapshot.authority,
    a1Variant: "off",
    declaration: snapshot.source,
    established,
    turn,
    retainedExpiry,
    unresolved,
    reversal,
    totalCapturedFrames: snapshot.frameCount,
    interpretation: "Live query-only commitment preserves body-relative geometry through translation/turn, distinguishes retained reference from retained semantics after canonical expiry, becomes explicitly unresolved when retention is removed, and returns to comparable canonical semantics on fresh Owner reversal without granting A1 movement authority."
  };
  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.info(`[A1_COMMITMENT_LIVE] ${JSON.stringify(summary)}`);
} finally {
  if (browser) await browser.close();
  await server.close();
}
