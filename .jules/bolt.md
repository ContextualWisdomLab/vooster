## 2025-02-12 - [Parallelize DB queries in use cases]
**Learning:** [When compiling complex use-case models with active locks, sessions, and PRs, sequentially `await`ing individual stores blocks unnecessarily]
**Action:** [Bundle independent Prisma/Store queries using `Promise.all` wherever aggregation endpoints merge multiple data domains]
