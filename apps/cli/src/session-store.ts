import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type SessionFileBody = {
  pinned_revisions?: Record<string, string>;
  project_id?: string;
  session_id: string;
};

export function writeSessionFile(
  root: string,
  relativePath: string,
  body: SessionFileBody
): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
}

export function clearSessionFile(root: string, relativePath: string): void {
  rmSync(join(root, relativePath), { force: true });
}

export function readSessionFile(root: string): SessionFileBody | undefined {
  const path = join(root, ".vspec/session.json");
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SessionFileBody>;
  return typeof parsed.session_id === "string"
    ? { ...parsed, session_id: parsed.session_id }
    : undefined;
}
