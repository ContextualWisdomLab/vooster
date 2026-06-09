import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import type { SyncPushFile, SyncPushResponse } from "./sync.js";

export type SyncFileWarning = {
  message: string;
  path: string;
  type: "UNMANAGED_SYNC_FILE_SKIPPED";
};

export type LocalSyncFiles = {
  files: SyncPushFile[];
  warnings: SyncFileWarning[];
};

export class SyncFileError extends Error {
  readonly code = "SYNC_FILE_MISSING_REVISION";
  readonly suggested_next_actions = [
    {
      command: "vspec pull",
      reason: "Regenerate managed spec files with revision frontmatter."
    },
    {
      command: "mv <file> ../",
      reason: "Move unmanaged markdown out of specs/ before pushing."
    }
  ];

  constructor(readonly path: string) {
    super(`Sync file ${path} is missing revision frontmatter.`);
    this.name = "SyncFileError";
  }
}

export function isSyncFileError(error: unknown): error is SyncFileError {
  return error instanceof SyncFileError;
}

export async function writeSyncFile(
  root: string,
  path: string,
  content: string
): Promise<void> {
  const absolutePath = resolve(root, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

export async function localSyncFiles(root: string): Promise<SyncPushFile[]> {
  return (await collectLocalSyncFiles(root)).files;
}

export async function collectLocalSyncFiles(root: string): Promise<LocalSyncFiles> {
  const specsRoot = join(root, "specs");
  const paths = await markdownFiles(specsRoot);
  const collected = await Promise.all(paths.map((path) => localSyncFile(root, path)));
  return {
    files: collected.flatMap((item) => (item.file === undefined ? [] : [item.file])),
    warnings: collected.flatMap((item) =>
      item.warning === undefined ? [] : [item.warning]
    )
  };
}

export async function applySyncResults(
  root: string,
  files: SyncPushFile[],
  results: SyncPushResponse["results"],
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    return;
  }
  await Promise.all(results.map((result) => applySyncResult(root, files, result)));
}

async function markdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => markdownEntry(dir, entry)));
    return nested.flat();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function markdownEntry(dir: string, entry: Dirent): Promise<string[]> {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) {
    return markdownFiles(path);
  }

  return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
}

async function localSyncFile(
  root: string,
  absolutePath: string
): Promise<{ file?: SyncPushFile; warning?: SyncFileWarning }> {
  const content = await readFile(absolutePath, "utf8");
  const path = relative(root, absolutePath).split(sep).join("/");
  const baseRevision = baseRevisionFrom(content, path);
  if (baseRevision === undefined) {
    return {
      warning: {
        message: `Skipped unmanaged markdown file ${path}.`,
        path,
        type: "UNMANAGED_SYNC_FILE_SKIPPED"
      }
    };
  }

  return {
    file: {
      base_revision: baseRevision,
      content,
      path
    }
  };
}

function baseRevisionFrom(content: string, path: string): string | undefined {
  const frontmatter = frontmatterFrom(content);
  if (frontmatter === undefined) {
    return undefined;
  }
  const match = /^revision:\s*(?<revision>\S+)\s*$/m.exec(frontmatter);
  if (match?.groups?.revision === undefined) {
    throw new SyncFileError(path);
  }

  return match.groups.revision;
}

function frontmatterFrom(content: string): string | undefined {
  return /^---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.groups
    ?.frontmatter;
}

async function applySyncResult(
  root: string,
  files: SyncPushFile[],
  result: SyncPushResponse["results"][number]
): Promise<void> {
  if (result.conflict_content !== undefined) {
    await writeSyncFile(root, result.path, result.conflict_content);
    return;
  }
  const file = files.find((candidate) => candidate.path === result.path);
  if (file !== undefined && result.status === "OK") {
    await writeSyncFile(
      root,
      result.path,
      syncFileContentWithRevision(file.content, result.current_revision)
    );
  }
}

export function syncFileContentWithRevision(content: string, revision: string): string {
  return content.replace(/^revision:\s*\S+\s*$/m, `revision: ${revision}`);
}
