import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/a1-commitment-future-review-live";
const SCHEMA = "companion-brain-lab-a1-commitment-future-review-live-v1";

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
  const value = await shadow(page);
  invariant(value, `${label}: missing commitment snapshot.`);
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

  await page.evaluate(() => {
    window.__relationshipCommitmentShadowBridge?.clear();
    window.__relationshipCommitmentShadowBridge?.armNextFrame("WORLD_FIXED");
  });

  await page.keyboard.down("d");
  const establishedSnapshot = await singleStep(page, "establish world-fixed commitment");
  await page.keyboard.up("d");
  const established = establishedSnapshot.frames.at(-1);
  invariant(established, "No established commitment frame.");
  invariant(established.tick === 0, `Expected declaration at tick 0, got ${established.tick}.`);
  invariant(established.a1Variant === "off", "A1 must remain OFF at declaration.");
  invariant(established.fit.semanticStatus === "COMPARABLE", "Declaration fit is not comparable.");
  invariant(established.referenceResolution.status === "RESOLVED", "WORLD_FIXED declaration did not resolve.");

  const requestId = await page.evaluate(() =>
    window.__relationshipCommitmentShadowBridge?.requestReview(0.5) ?? null
  );
  invariant(typeof requestId === "number", "Review request did not return an id.");

  await page.keyboard.down("a");
  await page.keyboard.down("s");
  const reviewedSnapshot = await singleStep(page, "diagonal reversal future review");
  await page.keyboard.up("a");
  await page.keyboard.up("s");

  const reversalFrame = reviewedSnapshot.frames.at(-1);
  const review = reviewedSnapshot.latestReview;
  invariant(reversalFrame, "Missing reversal commitment frame.");
  invariant(review, "One-shot commitment future review did not publish.");
  invariant(review.requestId === requestId, "Published review request id mismatch.");
  invariant(review.tick === reversalFrame.tick, "Published review tick does not align with reversal frame.");
  invariant(review.tick === 1, `Expected review at tick 1, got ${review.tick}.`);
  invariant(review.a1Variant === "off", "A1 movement authority changed during review.");
  invariant(review.authority === "NONE_QUERY_ONLY_NO_INTENT_MUTATION", "Review authority contract changed.");
  invariant(review.material.status === "STATIC_ROUTE_REACHABLE", `Expected static reachable anchor, got ${review.material.status}.`);
  invariant(review.actorOccupancy.status === "CURRENT_ACTOR_SPACE_CLEAR", `Expected current actor-clear anchor, got ${review.actorOccupancy.status}.`);
  invariant(review.playerFutureSet.futureCount === 3, `Expected H1/H2/H3, got ${review.playerFutureSet.futureCount}.`);
  invariant(review.playerFutureSet.causalUnresolvedCount === 0, "Reversal unexpectedly left a causal-unresolved player future.");

  const overlap = review.review.playerFutureOverlapIds;
  const sampledClear = review.review.playerFutureSampledClearIds;
  invariant(overlap.length === 1, `Expected exactly one overlapping future, got ${JSON.stringify(overlap)}.`);
  invariant(overlap[0] === "owner-request-continuation", `Expected fresh diagonal Owner future to cross anchor, got ${JSON.stringify(overlap)}.`);
  invariant(
    sampledClear.includes("body-response-continuation") &&
    sampledClear.includes("transition-hold"),
    `Expected H2/H3 sampled-clear, got ${JSON.stringify(sampledClear)}.`
  );
  invariant(review.review.playerFutureReferenceUnresolvedIds.length === 0, "Unexpected reference-unresolved future.");
  invariant(review.review.playerFutureCausalUnresolvedIds.length === 0, "Unexpected causal-unresolved future.");
  invariant(review.review.playerFutureAggregationClaim === "NONE", "Review aggregated player futures.");
  invariant(review.review.playerFutureProbabilityClaim === "NONE", "Review assigned future probability.");
  invariant(review.review.playerFutureBooleanCollapseClaim === "NONE", "Review collapsed futures into a boolean.");
  invariant(review.review.decisionClaim === "NONE_EVIDENCE_ONLY", "Review emitted a commitment decision.");
  invariant(review.review.selectionClaim === "NONE", "Review selected a player future.");
  invariant(review.review.runtimeAuthorityClaim === "NONE", "Review gained runtime authority.");
  invariant(reviewedSnapshot.lastError === null, `Commitment bridge recorded error: ${reviewedSnapshot.lastError}`);
  invariant(reviewedSnapshot.completedReviewCount === 1, `Expected one completed review, got ${reviewedSnapshot.completedReviewCount}.`);

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
    authority: reviewedSnapshot.authority,
    a1Variant: "off",
    source: reviewedSnapshot.source,
    established,
    reversalFrame,
    review,
    interpretation: "A live A1-OFF one-shot review preserves the same exact commitment anchor across a diagonal reversal and evaluates the complete same-physics player-future set without mutating intents. The fresh Owner-request future crosses the anchor while the prior owner-directed body-response and transition-hold futures remain sampled-clear; no probability, aggregate future-conflict boolean, selection, score or movement authority is introduced."
  };
  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.info(`[A1_COMMITMENT_FUTURE_REVIEW_LIVE] ${JSON.stringify(summary)}`);
} finally {
  if (browser) await browser.close();
  await server.close();
}
