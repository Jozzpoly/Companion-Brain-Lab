import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-chromium";
import { preview } from "vite";

const ARTIFACT_DIR = "artifacts/a1-2p2";
const HORIZON_SECONDS = 1;

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

async function p2(page) {
  return page.evaluate(() => window.__authorityA12p2BrowserBridge?.snapshot() ?? null);
}

async function singleStep(page, label) {
  const before = await page.evaluate(() => window.__authorityA11fBrowserBridge?.snapshot() ?? null);
  invariant(before, `${label}: A1.1f bridge missing.`);
  const expectedCount = before.frameCount + 1;
  await page.locator('[data-action="single-step"]').click();
  await page.waitForFunction(
    (count) => (window.__authorityA11fBrowserBridge?.snapshot().frameCount ?? 0) >= count,
    expectedCount,
    { timeout: 15_000 }
  );
}

async function assertNoFault(page, errors) {
  invariant(await page.locator("#runtime-fault-sentinel").count() === 0, "Runtime fault sentinel became visible during P2 specimen.");
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

  await page.goto("http://127.0.0.1:4173/?a1debug=1&a1p2=1", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await page.locator("#game-root canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => window.__authorityA12p2BrowserBridge?.enabled === true, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__authorityA11fBrowserBridge?.enabled === true, null, { timeout: 10_000 });

  const initial = await p2(page);
  invariant(initial.schema === "companion-brain-lab-authority-a1-2p2-manual-direct-v1", "P2 bridge schema mismatch.");
  invariant(initial.authority === "EXPLICIT_MANUAL_ONE_STEP_DIRECT_ONLY_P2", "P2 authority label mismatch.");
  invariant(initial.previewCount === 0 && initial.armCount === 0 && initial.applicationCount === 0, "P2 leaked activity before explicit use.");

  await page.locator('[data-action="toggle-pause"]').click();
  await waitForPanel(page, (text) => text.includes("PAUSED"), 10_000, "initial pause");
  await page.locator('[data-action="scenario-head-on"]').click();
  await waitForPanel(
    page,
    (text) => text.includes("scenario Head-on contact") && text.includes("PAUSED") && text.includes("A1 OFF"),
    15_000,
    "paused head-on reset"
  );
  await page.locator('[data-action="cycle-a1-authority"]').click();
  await waitForPanel(
    page,
    (text) =>
      text.includes("PAUSED") &&
      text.includes("A1 DIRECT") &&
      text.includes("waiting for first SPATIAL decision"),
    10_000,
    "paused A1 DIRECT pre-decision"
  );

  await page.keyboard.down("d");
  await page.waitForTimeout(50);

  await page.locator('[data-action="p2-preview"]').click();
  await page.waitForFunction(
    () => window.__authorityA12p2BrowserBridge?.snapshot().latestPreview?.sourceTick === 0,
    null,
    { timeout: 15_000 }
  );
  const previewEvidence = (await p2(page)).latestPreview;
  invariant(previewEvidence.sourceTick === 0, `P2 preview expected tick 0, got ${previewEvidence.sourceTick}.`);
  invariant(previewEvidence.playerMove.x === 1 && previewEvidence.playerMove.y === 0, "P2 preview did not capture Owner +X.");
  invariant(previewEvidence.authorityClaim === "NONE_PREVIEW_ONLY_P2", "P2 preview claimed authority.");
  invariant(previewEvidence.projection.frontierState === "SINGLETON_H1_FRONTIER", `P2 tick-0 expected singleton H1 frontier, got ${previewEvidence.projection.frontierState}.`);
  invariant(previewEvidence.projection.candidates.length === 1, "P2 tick-0 expected one explicit candidate.");
  const candidate = previewEvidence.projection.candidates[0];
  invariant(candidate.originFamilies.includes("RELATIVE_TANGENT_NEGATIVE"), "P2 preview lost qualified negative-tangent provenance.");
  invariant(candidate.runtimeAuthorityClaim === "NONE_P1", "P2 preview candidate itself unexpectedly claimed movement authority.");

  await page.waitForTimeout(50);
  const previewImage = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  await writeFile(`${ARTIFACT_DIR}/tick-0-preview.jpg`, previewImage);

  await page.locator('[data-action="p2-arm-singleton"]').click();
  await page.waitForFunction(
    (proposalId) => window.__authorityA12p2BrowserBridge?.snapshot().armed?.proposalId === proposalId,
    candidate.proposalId,
    { timeout: 15_000 }
  );
  const armed = (await p2(page)).armed;
  invariant(armed.sourceTick === 0, "P2 arm changed source tick.");
  invariant(armed.proposalId === candidate.proposalId, "P2 arm changed explicit proposal id.");
  invariant(
    armed.authorityClaim === "EXPLICIT_ONE_STEP_ARMED_NOT_YET_APPLIED_P2",
    "P2 arm claimed application before the World step."
  );

  await singleStep(page, "explicit P2 application");
  await page.waitForFunction(
    () => window.__authorityA12p2BrowserBridge?.snapshot().latestApplication?.status === "APPLIED_OUTCOME_CONFIRMED",
    null,
    { timeout: 15_000 }
  );
  const afterApply = await p2(page);
  invariant(afterApply.previewCount === 1, "P2 preview count changed unexpectedly.");
  invariant(afterApply.armCount === 1, "P2 arm count changed unexpectedly.");
  invariant(afterApply.applicationCount === 1, "P2 did not apply exactly one explicit command.");
  invariant(afterApply.armed === null, "P2 did not auto-disarm after one step.");
  invariant(afterApply.lastError === null, `P2 application error: ${afterApply.lastError}`);
  const application = afterApply.latestApplication;
  invariant(application.sourceTick === 0 && application.outcomeTick === 1, "P2 application tick closure mismatch.");
  invariant(application.proposalId === candidate.proposalId, "P2 executed a different proposal.");
  invariant(application.status === "APPLIED_OUTCOME_CONFIRMED", "P2 outcome was not confirmed.");
  invariant(application.a0CommandVelocityError <= 1e-9, `P2 A0 command mismatch: ${application.a0CommandVelocityError}`);
  invariant(
    application.command.automaticSelectionClaim === "NONE_P2" &&
    application.command.horizonPolicyClaim === "EXPLICIT_CALLER_SUPPLIED_HORIZON_P2" &&
    application.command.authorityScopeClaim === "SOURCE_TICK_TO_NEXT_WORLD_STEP_ONLY_P2",
    "P2 command smuggled automatic selection or broader authority."
  );

  const appliedImage = await page.locator("#game-root canvas").screenshot({ type: "jpeg", quality: 75 });
  await writeFile(`${ARTIFACT_DIR}/tick-1-applied.jpg`, appliedImage);

  // A second World step without a new arm must fall back to the normal live path.
  await singleStep(page, "post-P2 unarmed baseline step");
  const afterUnarmed = await p2(page);
  invariant(afterUnarmed.applicationCount === 1, "P2 repeated authority without a second explicit arm.");
  invariant(afterUnarmed.armed === null, "P2 unexpectedly re-armed itself.");

  const staleArmError = await page.evaluate(async (proposalId) => {
    try {
      window.__authorityA12p2BrowserBridge.arm(proposalId);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, candidate.proposalId);
  invariant(staleArmError?.includes("preview is stale"), `P2 stale preview was not rejected: ${staleArmError}`);

  await page.keyboard.up("d");
  await assertNoFault(page, errors);

  const summary = {
    schema: "companion-brain-lab-authority-a1-2p2-browser-specimen-v1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    scenario: "head-on",
    horizonSeconds: HORIZON_SECONDS,
    scheduler: "PAUSED_PREVIEW_EXPLICIT_ARM_SINGLE_STEP_AUTO_DISARM",
    preview: {
      requestId: previewEvidence.requestId,
      sourceTick: previewEvidence.sourceTick,
      frontierState: previewEvidence.projection.frontierState,
      frontierProposalIds: previewEvidence.projection.frontierProposalIds,
      proposalId: candidate.proposalId,
      originFamilies: candidate.originFamilies,
      commandVelocity: candidate.commandVelocity
    },
    application: {
      sourceTick: application.sourceTick,
      outcomeTick: application.outcomeTick,
      proposalId: application.proposalId,
      baselineCompanionIntent: application.baselineCompanionIntent,
      selectedCompanionIntent: application.selectedCompanionIntent,
      commandVelocity: application.command.commandVelocity,
      a0CommandVelocity: application.a0CommandVelocity,
      a0CommandVelocityError: application.a0CommandVelocityError,
      status: application.status
    },
    noRepeatWithoutRearm: afterUnarmed.applicationCount === 1,
    stalePreviewRejected: true,
    semantics: {
      previewAuthority: "NONE",
      selection: "EXPLICIT_CALLER_PROPOSAL_ID_ONLY",
      automaticSelector: "NONE",
      horizonPolicy: "EXPLICIT_CALLER_SUPPLIED",
      authorityScope: "ONE_WORLD_STEP",
      automaticRepeat: "NONE"
    },
    errors
  };
  await writeFile(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`[AUTHORITY_A1_2P2_MANUAL_DIRECT_BROWSER] ${JSON.stringify(summary)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
