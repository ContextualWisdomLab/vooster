# Learnings

_Append-only. One bullet per learning. Keep it terse — the cumulative file is
read every iteration._

- **colima `--disk` 가 재시작만으로는 안 늘어남** (v0.10.1 기준). `colima delete -f` 도 `~/.colima/_lima/_disks/<profile>/datadisk` 파일을 지우지 않아서 기존 사이즈가 재사용됨. 사이즈 변경 순서: `colima stop` → `rm -rf ~/.colima/_lima/_disks/<profile>` → `colima delete -f` → `colima start --disk <N>`. 호스트 디스크는 멀쩡한데 postgres 가 `pg_wal` 에 "No space left on device" 를 띄우면 의심 1순위는 VM 데이터디스크 풀.
- **gate fixture race**: ESLint boundary fixtures written under `apps/*/src` can race `_meta` typecheck; if a gate must write such fixtures, make them typecheck-safe or move the check to an API that does not touch the tree.
