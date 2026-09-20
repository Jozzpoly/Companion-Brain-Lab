# OS-PREP-5 — Revised Movement-Review Public Deployment

Status: **PUBLIC OWNER REVIEW SURFACE DEPLOYED · OWNER JUDGEMENT NEXT**
Date: **2026-09-20**

Canonical qualified stimulus:

`510405960acf3cfce0a6985fe6f9da88ec95d0c2`

Public Pages deployment commit on `main`:

`508f9fbc365fb74da031b09672ae693e869ea9c1`

Deployment workflow:

- `deploy-pinned-research-preview`
- run id `35478499314`
- build — **PASS**
- deploy — **PASS**
- public smoke — **PASS**

Main validate on the same merge commit:

- run id `35478499293`
- install — **PASS** using the signature-specific Arborist fallback when required;
- `npm run check` — **PASS**;
- overall — **PASS**.

---

## 1. Public surface layout

The deployment preserves three independently pinned surfaces:

### Historical Foundation root

`b217943e027e66993f0010643b2933b01d4b1e6d`

### Historical CCC-0 shadow surface

`857620b758bdaafcbfbab48da06ff89e7fc238cd`

under `/ccc0/`.

### Revised Owner movement-review surface

`510405960acf3cfce0a6985fe6f9da88ec95d0c2`

under `/owner/`.

No gameplay/runtime source from the deployment branch was merged into `main`; the merge changed only operational workflows.

---

## 2. Public smoke result

The public smoke used real deployed GitHub Pages, not the local dry-run.

It deliberately requested the Owner surface with incompatible research flags:

`owner=1&a1debug=1&a1p2=1&semanticpush=1&foundationFaultProbe=1`

and attempted the historical research mutation keys:

`M / N / T / P / O`.

The deployed runtime still reported:

- source SHA exactly `510405960acf3cfce0a6985fe6f9da88ec95d0c2`;
- build state `PINNED_SOURCE_SHA`;
- mode `SPATIAL`;
- actuator `NATURAL`;
- A1 variant `OFF`;
- time scale `1`;
- paused `false`;
- P2 available `false`.

Public participant controls were present:

- Open;
- Pillar;
- Door;
- Head-on;
- Reset;
- Save.

Public smoke passed on attempt 1.

---

## 3. What deployment does and does not mean

Deployment means:

> the technically qualified movement-substrate stimulus is now available to the Owner through a stable public participant surface with exact provenance and defended experimental boundaries.

Deployment does **not** mean:

- movement substrate accepted;
- teammate quality PASS;
- OS-PREP complete;
- PH-02/PH-07 judged important or unimportant;
- A1/S5 promotion authorized;
- Stage B minimum-useful-partner design selected.

The next evidence class is human Owner judgement.

---

## 4. Owner-review question

The first Owner encounter should remain deliberately unscripted.

The product question is:

> **Is the current embodied movement/relationship substrate good enough — and sufficiently worth preserving — that Companion Brain Lab should stop treating locomotion as its main research frontier and begin the first true minimum-useful-partner experiment?**

Do not front-load known pathology labels before the first play impression.

Use Save only when a moment feels notably good, bad, fake, surprising or unreadable.

Detailed causal analysis follows the Owner impression, not before it.

---

## 5. Next boundary

The current engineering campaign should stop adding behavior until the Owner has interacted with the public movement-review surface.

After Owner evidence:

- if movement feels sufficiently trustworthy/present, close the movement-first era and design the first genuine shared-responsibility experiment;
- if movement still undermines the experience, localize the smallest salient cause from saved incidents and Owner description before considering any broader Stage B addition.

No automatic post-deployment feature work is authorized by this document.
