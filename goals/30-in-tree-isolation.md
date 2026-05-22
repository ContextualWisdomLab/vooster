# Goal 30 — In-tree isolation for parallel gates

## Mission

Parallel goal workers must not mutate shared working-tree or fixed temp
paths in ways that make two completion checks race each other.

## Completion Conditions

1. Every non-meta gate/check script that participates in the goal chain
   consumes existing build artifacts instead of invoking a shared `dist/`
   build.
2. Every gate/check script that writes diagnostic or HTTP cookie state
   uses a per-invocation temp path, not a fixed `/tmp/<name>` or
   `.state/<name>.log` path.
3. Goal 30's own gate remains a small negative-universal grep and passes
   `scripts/check-gate-rigor.sh`.

## Sources Of Truth

- `goals/*.gates.sh`
- `scripts/check-*.sh`
- `scripts/dogfood-test.sh`

## Verification

```
bash goals/30-in-tree-isolation.gates.sh
bash scripts/completion-check.sh
```
