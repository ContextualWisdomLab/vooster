## 2024-03-24 - Parallelize sequential I/O queries in map loops
**Learning:** Sequential `for...of` loops performing I/O queries (like DB reads) for each iteration cause O(N) latency, creating significant bottlenecks as data grows.
**Action:** Replace sequential loops with `Promise.all(array.map(async item => { ... }))` to run independent queries concurrently, reducing latency to O(1) bounded by the slowest query. Always ensure queries are truly independent and DB connection limits allow the concurrent load.
