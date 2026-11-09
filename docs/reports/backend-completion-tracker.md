# Backend completion tracker

Last updated: 2026-11-09 (America/Sao_Paulo)

## Working state

- Completion branch: `integration/backend-completion-2026-11`
- Starting point: `integration/presentation-2026-10-26` at `8eaf51e6a5d3c00c24c00fa4437b8a5ac3fcfbe3`
- Remote `main`: `be0e90539aaddeef6c1a103459ee082f45a7b796`
- Consolidation check: all six delivery branches behind PRs #80, #81, #83, #84, #85 and #86 are ancestors of the starting point.
- GitHub audit: 73 open issues and 7 open PRs (#80, #81, #83, #84, #85, #86 and #87).
- `main...integration/presentation-2026-10-26`: 0 commits behind, 16 commits ahead at the start of this work.
- External issue #82 remains owned by Infra; no Railway environment was changed.

## Reproducible baseline

| Check | Result |
| --- | --- |
| `npm ci` | Passed on Node 24.16.0 / npm 11.13.0 |
| `npm run format:check` | Passed after normalizing the local checkout's line endings; no Git content diff |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm test -- --runInBand` | 17 suites / 112 tests passed |
| `npm run docs:dbml` | 23 tables, 11 enums, 55 indexes/PKs, 29 FKs and 50 checks matched the baseline contract |
| `npm audit --omit=dev --audit-level=high` | 0 production vulnerabilities |
| PostgreSQL 15 real | Not run locally: Docker Desktop daemon unavailable. Must run in GitHub Actions before technical readiness can be declared. |

## Backlog reconciliation

GitHub issue numbers are intentionally kept separate from BE task codes.

| Scope | GitHub issues / BE codes | Current state | Required evidence |
| --- | --- | --- | --- |
| Foundation and identity | #4–#17 and #20 / BE-004–BE-018 | Existing implementation is mostly complete. #14/BE-013 lacks versioned terms acceptance and #17/BE-018 still requires real frontend approval. | Unit/E2E, migration evidence, OpenAPI examples and external approval noted separately. |
| Food providers and catalog | #18, #19, #21, #22, #24, #26 / BE-019–BE-024 | Implemented: OFF/USDA adapters, TBCA safe-disabled, fallback, cache, normalization, busca/detalhe/barcode/manual and fixtures. Live USDA/TBCA remain external. | Focused provider/unit/E2E tests pass locally; live provider validation is not claimed. |
| Consumed meals and diet plans | #23, #25, #27–#30 / BE-025–BE-030 | Implemented: transactional manual/check-in, snapshots, idempotency, ownership, history, soft deletion and planned local time. | Meal/progress E2E includes rollback, retry, ownership, timezone and check-in. |
| Nutrition progress | #31–#36 / BE-031–BE-036 | Implemented with separate daily snapshots, IANA timezone, history and idempotent reprocessing. | Boundary and recalculation E2E pass locally. |
| Gamification | #37–#42 / BE-037–BE-042 | Implemented with outbox, versioned scoring, antifarming, immutable ledger, streak, missions and achievements. Values await Product ratification. | Gamification E2E verifies exact ledger and zero duplicate effects. |
| Social | #43–#48 / BE-043–BE-048 | Implemented: private groups, invitations, membership roles, feed, automatic meal posts, reactions and ranking from real balance. | Social E2E verifies isolation, roles, feed integration and ranking. |
| Rewards | #49–#54 / BE-049–BE-054 | Implemented: catalog, balance, inventory, atomic/idempotent purchase and exclusive equipment by type. | E2E covers retries and insufficient balance; PostgreSQL CI covers concurrent purchases. |
| Quality, security and release | #55–#72 / BE-055–BE-072 | CI, PostgreSQL 15 job, coverage, dependency audit, rate limiting, security docs and regression suites implemented. External staging/load/frontend approvals remain. | A successful remote CI run is still required before readiness status. |
| Presentation support | #73–#75 / BE-073–BE-075 | Human support activities; no code implementation can prove completion. | Checklists/contingency scripts only; do not claim that a duty shift happened. |
| Infrastructure | #82 | External Railway preview investigation. | Infra-owned logs/configuration evidence; no production changes from this branch. |

## Corrected dependency notes

- #45/BE-045 must depend on the meal/progress event flow and the social feed/ranking implementation, not on itself.
- #50/BE-052 must depend on BE-049, BE-050, BE-051, BE-053 and BE-054, not on a range that includes itself.
- `user_stats` remains gamification state. Nutrition snapshots will use a separate additive table.

## Conservative decisions pending ratification

- Terms acceptance will be append-only, versioned and timestamped. Existing users receive no fabricated consent row.
- Planned meal time will be an optional local wall-clock `time`; interpretation uses the user's IANA timezone.
- The default food-day timezone will be configurable and recorded on every daily snapshot. A user-specific timezone will be persisted explicitly.
- Scoring values and anti-farming limits will be versioned configuration and documented as a product proposal.
- Rate limits will be environment-configurable, with a stricter login policy.

## Execution log

1. Re-audited GitHub and remote refs; the known starting state remains current.
2. Proved that all six earlier feature branches are present in the consolidation branch.
3. Created the local completion branch from the consolidated commit.
4. Installed dependencies and ran the complete consolidated baseline successfully, except real PostgreSQL because the Docker daemon is unavailable locally.
5. Added the audit-safe terms model, initial profile, IANA timezone, planned meal time, meal idempotency/soft deletion, nutrition snapshots, outbox and immutable point ledger in one additive migration.
6. Implemented deterministic food adapters/fallback and public catalog queries; live credentials were not invented.
7. Implemented and tested consumed meals, planned check-in, progress, gamification, social groups/feed/ranking and rewards/store.
8. Added security headers, configurable login/API rate limits, 26-table DBML contract, documentation and GitHub Actions with PostgreSQL 15.
9. Fixed the two legacy-suite regressions found by the first full gate: minimal Nest test apps now receive safe setup defaults, and the database-options contract expects 26 entities/two reviewed migrations.
10. Added deterministic PostgreSQL performance evidence (2,000 snapshots plus 5,000 meals, posts, ledger entries and foods), hot-path `EXPLAIN ANALYZE`, index assertions and an opt-in read-only staging smoke harness.
11. Complete local gate passed: format, lint, typecheck, build, DBML, audit and `23 suites / 127 tests`; coverage was 81.81% statements, 68.45% branches, 75.67% functions and 82.54% lines.
12. Next: commit/push, inspect real PostgreSQL CI evidence, fix any platform-specific drift, then prepare the final delivery report and PR.
13. Opened final PR #88 against `main`; GitHub reports it mergeable.
14. First PR CI iteration: `quality` passed; `postgres-15` exposed an unterminated PL/pgSQL dollar quote before schema creation. Fixed the migration delimiter in `5faab65`; no test was mocked or relaxed.
15. Second PR CI iteration: migrations, SQL integrity, performance and concurrent purchases passed on PostgreSQL 15. The remaining failures exposed preflight semantics after both known migrations and four physical CHECKs absent from entity metadata; both verifiers were corrected without dropping constraints.

## External blockers (do not misreport as completed)

- Frontend approval of the identity contract.
- Live USDA use requires a valid API key; live TBCA use requires an official suitable API/contract. Adapters and fixtures can still be implemented and tested.
- Railway preview diagnosis (#82), staging smoke tests, production/deployment approval and human presentation duties.
- A successful GitHub Actions run with PostgreSQL 15 is required before `TECHNICALLY READY FOR MAIN`.
