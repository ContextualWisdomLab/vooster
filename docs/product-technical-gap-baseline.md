# Product and technical gap baseline

Status date: 2026-09-07

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

## Gap and action register

| Gap                                                          | Evidence                                                                                                                                                                                | Action / closure evidence                                                                                                                                          | Status                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Public installation was overstated                           | The root workspace and `@vooster/cli@0.0.0` are private, and the repository has no GitHub Release.                                                                                      | Keep source-checkout installation as the only advertised path until a repository-owned immutable release exists and is verified.                                   | Proposed in PR #42                               |
| README verification encoded the unrelated public npm package | `apps/api/tests/integration/readme.test.ts` and Goal 2 previously required `npm install -g vspec` / `npx vspec`.                                                                        | Bind the test and Goal 2 gate to the source-checkout commands and exact repository/product title; require RED then GREEN evidence.                                 | Repaired on PR #42 branch; exact-head CI pending |
| SAST baseline is not clean                                   | Exact head `9987e031e65c790a412a4280ed5b0754290094d0` reported 18 Semgrep WARNING/ERROR findings across Python skill helpers, API routes, CLI process execution, and Compose hardening. | Repair each finding at its owning module with regression evidence; do not suppress the merge gate or represent this documentation PR as security-clean.            | Merge blocker                                    |
| Dependency vulnerability baseline is not clean               | The same exact head's Trivy filesystem job reported 40 fixable MEDIUM/HIGH findings in `pnpm-lock.yaml`.                                                                                | Upgrade or replace each owning dependency, run contract/regression tests, regenerate the lockfile and SBOM, and obtain terminal exact-head Security Scan evidence. | Merge blocker                                    |
| Public documentation publication is unverified               | `docs/index.md` is a Pages-ready source, but no live Pages URL or deployment evidence is recorded.                                                                                      | Publish through governed repository settings and verify the live HTTPS artifact before advertising GitHub Pages.                                                   | Not published                                    |
| Architecture views are incomplete                            | No separately governed PRD, TRD, UML, ERD, or Context Map artifact exists.                                                                                                              | Introduce only the views needed to reconstruct product decisions, bind them to the existing overview/architecture/data model, and add drift checks.                | Open documentation gap                           |

## Licensing boundary

The repository preserves the upstream MIT grant and
`Copyright (c) 2026 vibemafiaclub`. ContextualWisdomLab must retain that notice
and must not present upstream-derived source as an exclusive organization
grant. Third-party packages, container images, services, and assets retain
their own terms; dependency licenses neither replace nor extend the
repository's MIT grant.
