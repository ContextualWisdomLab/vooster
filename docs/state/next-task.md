# Next Task

_Auto-generated 2026-05-20T09:58:02Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Tighten boundaries rules (gate 2.C4).

  In eslint.config.js, extend the boundaries/element-types rules array
  with:
      { from: "http", disallow: ["domain"] }
      { from: "cli",  disallow: ["infrastructure"] }

  Then:
      npx eslint .
  resolve violations by routing through src/application/ (for http) and
  through HTTP/CLI ports (for cli).
```
