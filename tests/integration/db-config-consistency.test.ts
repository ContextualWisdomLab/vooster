import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");

describe("Goal 2 DB configuration consistency", () => {
  test("schema, env example, package scripts, and compose agree", async () => {
    const result = await execFileAsync("bash", ["scripts/check-db-consistency.sh"], {
      cwd: root
    });

    expect(result.stdout).toContain("check-db-consistency");
  });
});
