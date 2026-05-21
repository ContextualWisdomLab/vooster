import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../../../..");

describe("Goal 2 README", () => {
  test("is user-facing and links the build harness documentation", async () => {
    const readme = await readFile(path.join(root, "README.md"), "utf8");
    const harness = await readFile(path.join(root, "docs/build-harness.md"), "utf8");

    expect(readme).toMatch(/^# vspec$/m);
    expect(readme).toMatch(/^## Install$/m);
    expect(readme).toMatch(/^## Run$/m);
    expect(readme).toMatch(/^## Deploy$/m);
    expect(readme).toMatch(/^## Documentation$/m);
    expect(readme).toContain("npm install");
    expect(readme).toContain("npx vspec --help");
    expect(readme).toContain("docker compose up -d db");
    expect(readme).toContain("docker compose -f docker-compose.prod.yml up -d");
    expect(readme).toContain("docs/build-harness.md");
    expect(readme).not.toContain("This is the **autonomous-build harness**");

    expect(harness).toContain("autonomous-build harness");
    expect(harness).toContain("codex goal");
    expect(harness).toContain("bash scripts/diagnose.sh");
    expect(harness).toContain("bash scripts/completion-check.sh");
  });
});
