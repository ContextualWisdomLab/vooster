import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import type { SyncPushFile, SyncPushResponse } from "./sync.js";

export async function writeSyncFile(root: string, path: string, content: string): Promise<void> {
  const absolutePath = resolve(root, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

export async function localSyncFiles(root: string): Promise<SyncPushFile[]> {
  const specsRoot = join(root, "specs");
  const paths = await markdownFiles(specsRoot);
  return Promise.all(paths.map((path) => localSyncFile(root, path)));
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

async function localSyncFile(root: string, absolutePath: string): Promise<SyncPushFile> {
  const content = await readFile(absolutePath, "utf8");
  return {
    base_revision: baseRevisionFrom(content),
    content,
    path: relative(root, absolutePath).split(sep).join("/")
  };
}

function baseRevisionFrom(content: string): string {
  const match = /^revision:\s*(?<revision>\S+)\s*$/m.exec(content);
  if (match?.groups?.revision === undefined) {
    throw new Error("Sync file is missing revision frontmatter.");
  }

  return match.groups.revision;
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
    await writeSyncFile(root, result.path, replaceRevision(file.content, result.current_revision));
  }
}

function replaceRevision(content: string, revision: string): string {
  return content.replace(/^revision:\s*\S+\s*$/m, `revision: ${revision}`);
}
