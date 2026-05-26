# Learnings

_Append-only. One bullet per learning. Keep it terse — the cumulative file is
read every iteration._

- **colima `--disk` 가 재시작만으로는 안 늘어남** (v0.10.1 기준). `colima delete -f` 도 `~/.colima/_lima/_disks/<profile>/datadisk` 파일을 지우지 않아서 기존 사이즈가 재사용됨. 사이즈 변경 순서: `colima stop` → `rm -rf ~/.colima/_lima/_disks/<profile>` → `colima delete -f` → `colima start --disk <N>`. 호스트 디스크는 멀쩡한데 postgres 가 `pg_wal` 에 "No space left on device" 를 띄우면 의심 1순위는 VM 데이터디스크 풀.
- **gate fixture race**: ESLint boundary fixtures written under `apps/*/src` can race `_meta` typecheck; if a gate must write such fixtures, make them typecheck-safe or move the check to an API that does not touch the tree.
- **ignored mirror docs need explicit handling**: when a required mirror file is gitignored, formatting tools may skip it and `git add` will reject it; format the tracked source, mechanically mirror it, then `git add -f` the ignored mirror.
- **overnight findings sweep closure**: F1/F2 activation goals, CLI help/lock-release gaps, gates-over-coupling goals 7-29, and harness docs are closed; remaining partials are scoped deferrals (merge-resolve public setup, A14 planned verbs, route-test Phase 2, HONEST_UC_SET derivation).
- **2026-05-27 findings+meta-audit sweep**: closed/advanced 6 findings (harness-spec-debt#3, CI shard, Gap B, invocation-links, shared-contracts package-shape domains, route-test Phase 2 partial). Ran recurring meta-audit checkpoints and landed audit-driven corrections; final shared-contracts status is partial with 22/21 ledgered slices because Doctor was counted beyond the original package list. Route-test Phase 2 remains 0/37.
