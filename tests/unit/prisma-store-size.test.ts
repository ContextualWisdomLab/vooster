import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("Prisma store decomposition", () => {
  test("keeps the signup adapter below the Goal 4 file-size ceiling", async () => {
    const source = await readFile(
      path.join(root, "src/infrastructure/prisma-signup-store.ts"),
      "utf8"
    );
    const lines = source.trimEnd().split("\n");

    expect(lines.length).toBeLessThanOrEqual(1000);
  });
});
