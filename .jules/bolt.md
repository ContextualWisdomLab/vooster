## 2026-06-19 - E2E tests and DB dependency
**Learning:** Local e2e tests fail in the sandbox because they require a Postgres database on 127.0.0.1:5433 that isn't running. Also, domain-entities.test.ts fails due to npm outputting warnings to stderr.
**Action:** Ignore e2e test failures that fail with database connection errors (P1001) or expected test failures documented in memory, focusing verification on the relevant components changed.
