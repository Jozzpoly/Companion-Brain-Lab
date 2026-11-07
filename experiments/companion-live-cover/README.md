# C1 Cover — first bounded lived authority (GPT-6, 2026-11-07)

**ISOLATED RESEARCH. NOT A GENERAL COMPANION BRAIN. NOT OWNER QUALIFIED.**
Stacked on [PR #65, Jaskinia lived moment and world-first workspace](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/65); this own experiment is [PR #66](https://github.com/Jozzpoly/Companion-Brain-Lab/pull/66). Neither is intended for automatic merge.

## Why

Our preceding Companion × Jaskinia work honestly fixed a critical visibility failure (430px native window used to shrink the World to 0×0) and gave Owner notes causal tick context. But it did not change **what the companion itself can do**. This lab has already spent too long proving machinery smarter than the lived teammate.

This experiment promotes **one carefully bounded real action**: explicit Owner instruction `C` / **C1 Cover**, then a local controller *can* prepare near a threat, move its own Rapier body, and autonomously STRIKE while the player is actively pressured. The ordinary World physics and Combat Micro rules — not the controller — decide success, damage, target reassignment and who bears subsequent danger.

Neither C1 nor the Jaskinia bridge receives World authority by default.

## Verified changes to the World

The actual browser A/B (identical authored player + C1 + hostile positions, OPEN layout, same physics; no manual STRIKE) showed:

| Source result | Cover OFF | Cover explicitly armed |
| --- | ---: | ---: |
| hostile HP | 3/3 | 2/3 |
| player hit count | 1 | 0 |
| successful C1 STRIKE | no | yes |
| retaliation target | player | C1 |

Evidence: [Chrome/Playwright run 42312840114](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42312840114) with screenshots, plus [real-World Vitest 42312840053](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42312840053). The latter was 194 test files / 790 tests PASS.

This is an *A/B of distinct behavior and material outcomes*, not proof that the teammate is pleasant, robust, intelligent across the world, or has a meaningful relationship to the player. **Important methodological limitation:** the browser baseline stops on the first PLAYER hit, while the Cover variant stops on the first C1 strike. Those outcomes are real but are **not matched-horizon measures of benefit**. The successful strike changes *which actor is targeted*; C1 had **zero received hits** at the recorded endpoint, so calling this an actual paid sacrifice would be false. See [research station / source-of-truth audit](../GPT6_COMPANION_STATION_2026-11-07.md).

## Authority semantics

- **OFF by default**. C / contextual C1 Cover button explicitly grants permission. C again or button immediately revokes permission.
- **Very narrow domain:** one canonical C1, Combat Micro OPEN; no line-of-sight proof through walls, no second hostile, no continuous world editing.
- **Observed facts only:** actual World positions, attack phase, who currently bears pressure, observed physical proximity across >=12 consecutive ticks. No hidden attack-clock peek, no arbitrary future trajectory oracle or scripted “win at tick N.”
- **Consequential action:** strike is submitted to real `stepSituation()`; an internal recommendation alone cannot damage an opponent.
- **Owner veto:** DIRECT C1, explicit FOLLOW/HOLD/MOVE, and new World reconstruction cancel the permission when they take over. The pure controller also yields when DIRECT/HOLD already in force.
- **Legacy A/B setup cannot encode this policy.** Attempting capture or trial while Cover is armed is blocked explicitly, so snapshots with the same saved config cannot claim false equivalence. The independent World/browser A/B is the valid evidence instead.
- **Jaskinia note** may record opt-in C1 Cover authority, preparation and source tick in the same bounded source-reported moment. It is not a solver checkpoint, and Jaskinia cannot issue World actions.

## Experimental preview

The compiled specimen is frozen at source `3b954c10...`, preview commit `2c24ff8940...` ([exact manifest and CI](https://github.com/Jozzpoly/Companion-Brain-Lab/actions/runs/42314058393)). An ordinary source push now **does not automatically overwrite it**. A future agent requests an intentional replacement by updating `PREVIEW_PUBLISH_REQUEST.md`; only that file triggers the gated publish workflow. It neither changes `main` nor the historical `jozzpoly.github.io/Companion-Brain-Lab/` R1. The external raw.githack click-through in Owner's Opera remains unverified due to its confirmation interstitial, even though local browser/compiled-source provenance checks passed.

## Strongest falsifiers / what remains unresolved

1. **Risk and meaning:** Will a player experience C1 as a teammate taking responsibility, rather than one automated button? The above does not answer this.
2. **Arbitration:** Does C1 understand and consistently honor Owner intention under multiple simultaneous threats and movement choices, without unpleasant surprise?
3. **Spatial truth:** OPEN-only awareness is a deliberate limitation; obstacles, perception, occlusion and visibility are not solved.
4. **Material causal continuity:** Real live object/world edits would currently require unsafe reconstruction or independent new World mutation rules. This experiment does **not** solve continuous world authoring.
5. **Data continuity:** Cover readiness and policy are deliberately not part of older A/B persistence, and a source report cannot restore an exact simulation. A future legitimate record needs environment, version, command provenance, body/source state, and causal outcomes — not a generic JSON snapshot presented as replay.
6. **Agent collaboration:** Another agent's donor insight is welcome but does not become a shared superorganism API by default. Native Jaskinia and its future generation remain independently developed. Every experiment must be allowed to reject this path.

## Owner-friendly first question

Not “does a panel turn green?” but: **Did C1 help at the right moment, create additional agency for the player rather than steal it, and expose itself to a meaningful physical risk — with clear ability for the Owner to correct its actions?** The existing fixture proves none of those experiential qualities; it only shows a bounded policy causing a factual World strike and reassignment of hostile pressure.

Do not turn this into another Owner gate until a non-historical, actually playable URL and a meaningful experience are available. Green machine tests are evidence of a narrow mechanism only.
