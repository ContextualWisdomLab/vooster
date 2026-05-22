import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const STATE_FILE = ".vspec/sync-state.json";

export type SyncState = {
  cursor: string | null;
};

export async function readSyncState(root: string): Promise<SyncState> {
  try {
    const text = await readFile(join(root, STATE_FILE), "utf8");
    const parsed = JSON.parse(text) as Partial<SyncState>;
    return { cursor: typeof parsed.cursor === "string" ? parsed.cursor : null };
  } catch {
    return { cursor: null };
  }
}

export async function writeSyncState(root: string, state: SyncState): Promise<void> {
  const path = join(root, STATE_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
