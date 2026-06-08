## 2024-06-08 - Promise.all Parallelization
**Learning:** Sequential async database calls inside application logic (`activeSessions`, `activeLocks`, `openMergeRequests`) create unnecessary performance bottlenecks where the total wait time is the sum of all queries.
**Action:** Use `Promise.all` to execute independent async operations concurrently. The total wait time becomes bounded by the single slowest operation rather than the sum, providing an easy and safe performance win.
