import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  collectLocalSyncFiles,
  isSyncFileError
} from "../../src/commands/sync-files.js";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop() ?? "", { force: true, recursive: true });
  }
});

describe("sync file classification", () => {
  test("skips unmanaged markdown while collecting managed files", async () => {
    const root = tempRoot();
    writeMarkdown(root, "specs/PAY-1.md", "---\nrevision: rev-1\n---\n# Pays\n");
    writeMarkdown(root, "specs/SEED_NOTES.md", "# Seed notes\n");

    const result = await collectLocalSyncFiles(root);

    expect(result.files).toEqual([
      {
        base_revision: "rev-1",
        content: "---\nrevision: rev-1\n---\n# Pays\n",
        path: "specs/PAY-1.md"
      }
    ]);
    expect(result.warnings).toEqual([
      {
        message: "Skipped unmanaged markdown file specs/SEED_NOTES.md.",
        path: "specs/SEED_NOTES.md",
        type: "UNMANAGED_SYNC_FILE_SKIPPED"
      }
    ]);
  });

  test("raises a typed error for vspec frontmatter without revision", async () => {
    const root = tempRoot();
    writeMarkdown(root, "specs/BROKEN.md", "---\ntitle: Broken\n---\n# Broken\n");

    await expect(collectLocalSyncFiles(root)).rejects.toSatisfy((error: unknown) => {
      expect(isSyncFileError(error)).toBe(true);
      if (!isSyncFileError(error)) {
        return false;
      }
      expect(error.code).toBe("SYNC_FILE_MISSING_REVISION");
      expect(error.path).toBe("specs/BROKEN.md");
      expect(error.message).toContain("specs/BROKEN.md");
      expect(error.suggested_next_actions.length).toBeGreaterThan(0);
      return true;
    });
  });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "vspec-sync-files-"));
  tempRoots.push(root);
  return root;
}

function writeMarkdown(root: string, path: string, content: string): void {
  const fullPath = join(root, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}
