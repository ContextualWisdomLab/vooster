# Next Task

_Auto-generated 2026-05-20T21:09:23Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Add scripts/check-honest-gates.sh (gate 4.D1).

  This meta-gate enumerates every test under tests/. It fails if a
  test file both:
    a) readFileSync's a known config file
       (eslint.config.js / tsconfig.json / package.json /
        prisma/schema.prisma / docker-compose*.yml / vitest.config.ts)
    b) asserts on the raw body via toMatch( or toContain(
  AND does not parse the body structurally (JSON.parse, yaml.safe_load,
  ESLint as a library, etc.).

  Outline:
      #!/usr/bin/env bash
      set -uo pipefail
      CONFIG_FILES=(eslint.config.js tsconfig.json …)
      OFFENDERS=()
      while IFS= read -r f; do
        reads=false
        for cfg in "${CONFIG_FILES[@]}"; do
          grep -q "readFileSync.*${cfg##*/}" "$f" && reads=true && break
        done
        $reads || continue
        grep -qE 'toMatch\(|toContain\(' "$f" || continue
        grep -qE 'JSON\.parse|yaml\.|safe_load|ESLint\(|new Linter' "$f" \
          && continue
        OFFENDERS+=("$f")
      done < <(find tests -name '*.test.ts')
      [ ${#OFFENDERS[@]} -eq 0 ] && exit 0
      printf 'dishonest test: %s\n' "${OFFENDERS[@]}"
      exit 1

  Make the script executable. Commit:
      green(honest-gates): meta script that bans config-grep tests
```
