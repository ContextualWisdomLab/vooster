# Product and technical gap baseline

Status date: 2026-10-03

This baseline records buyer-visible product and integration gaps against the
current repository evidence. A pull request is proposed evidence until its
unchanged head passes the repository's protected checks and is merged.

## Current authority

| Concern                               | Current source                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Product boundary and MVP              | [`00-overview.md`](00-overview.md)                                                                   |
| Architecture and integration boundary | [`01-architecture.md`](01-architecture.md)                                                           |
| Technical choices                     | [`02-tech-stack.md`](02-tech-stack.md) and [`decisions/`](decisions/)                                |
| Domain and persistence model          | [`05-data-model.md`](05-data-model.md)                                                               |
| HTTP and CLI contracts                | [`06-api-contract.md`](06-api-contract.md) and [`07-cli-spec.md`](07-cli-spec.md)                    |
| Source distribution and provenance    | [`../README.md`](../README.md), [`../package.json`](../package.json), and [`../LICENSE`](../LICENSE) |

The repository does not yet contain separately governed PRD, TRD, UML, ERD,
or Context Map artifacts. The sources above remain authoritative until those
views are introduced and checked for drift; this document does not promote an
open documentation change to accepted architecture.

## Proposed integration stack

| Order | Proposed change                                     | Exact head                                 | Evidence state                                                    |
| ----- | --------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| 1     | PR #48 source-security and dependency prerequisite  | `712063eeffa1ded28a11918a6439231e8a4ed11c` | Draft; local source checks are GREEN, hosted jobs did not start   |
| 2     | PR #42 product-first README and provenance contract | This branch is stacked on PR #48           | Draft; documentation tests must be repeated at its new exact head |

Both PRs remain Proposed until the prerequisite is integrated and the
successor's unchanged head passes its own checks. Earlier PR #42 results do not
transfer across this restack.

## Gap and action register

| Gap                                                          | Evidence                                                                                                                                                                                                                                           | Action / closure evidence                                                                                                                                        | Status                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Public installation was overstated                           | The root workspace and `@vooster/cli@0.0.0` are private, and the repository has no GitHub Release.                                                                                                                                                 | Keep source-checkout installation as the only advertised path until a repository-owned immutable release exists and is verified.                                 | Proposed in PR #42                                 |
| README verification encoded the unrelated public npm package | `apps/api/tests/integration/readme.test.ts` and Goal 2 previously required `npm install -g vspec` / `npx vspec`.                                                                                                                                   | Bind the test and Goal 2 gate to the source-checkout commands and exact repository/product title; require RED then GREEN evidence.                               | Repaired on PR #42 branch; exact-head CI pending   |
| SAST baseline is not clean                                   | PR #48 head `712063eeffa1ded28a11918a6439231e8a4ed11c` repairs the 18 historical findings. The central-equivalent local scan ran 480 rules over 946 files with 0 findings, but CI/Verify jobs ended before checkout with `steps=null` and no logs. | Obtain terminal hosted SAST and integration evidence on the unchanged head; do not substitute local or predecessor results.                                      | Source-repaired in PR #48; hosted gate pending     |
| Dependency vulnerability baseline is not clean               | PR #48 reduces a fresh 106-finding audit to two HIGH findings. The advisories require `braces>=3.0.4` and `http-cache-semantics>=4.2.1`, while npm currently publishes only 3.0.3 and 4.2.0 respectively.                                          | Pin the supplier releases when they exist or remove the canonical dependency paths, then regenerate audit, SBOM, license, build, and exact-head hosted evidence. | Supplier-blocked in PR #48; Issue #47 remains open |
| Public documentation publication is unverified               | `docs/index.md` is a Pages-ready source, but no live Pages URL or deployment evidence is recorded.                                                                                                                                                 | Publish through governed repository settings and verify the live HTTPS artifact before advertising GitHub Pages.                                                 | Not published                                      |
| Architecture views are incomplete                            | No separately governed PRD, TRD, UML, ERD, or Context Map artifact exists.                                                                                                                                                                         | Introduce only the views needed to reconstruct product decisions, bind them to the existing overview/architecture/data model, and add drift checks.              | Open documentation gap                             |

## Licensing boundary

The repository preserves the upstream MIT grant and
`Copyright (c) 2026 vibemafiaclub`. ContextualWisdomLab must retain that notice
and must not present upstream-derived source as an exclusive organization
grant. Third-party packages, container images, services, and assets retain
their own terms; dependency licenses neither replace nor extend the
repository's MIT grant.

PR #48's lockfile-only evidence contains 1,066 CycloneDX components and 1,067
SPDX packages. The inventory contains no GPL, AGPL, or SSPL package. The
optional `@img/sharp-libvips-linux-x64` prebuilt reports
LGPL-3.0-or-later, so redistribution and notice obligations must remain visible
instead of being relabeled under the repository's first-party MIT boundary.
