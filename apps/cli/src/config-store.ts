import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type VspecConfig = {
  api_url?: string;
  session_token?: string;
  current_workspace_id?: string;
  profile?: string;
  current_project_id?: string;
  current_project_key?: string;
  current_workspace_slug?: string;
};

export function configPath(): string {
  return process.env.VSPEC_CONFIG_PATH ?? join(homedir(), ".vspec", "config.json");
}

export function readConfig(): VspecConfig {
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath(), "utf8"));
    return isRecord(parsed) ? configFrom(parsed) : {};
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }

    throw error;
  }
}

export function writeConfig(partial: Partial<VspecConfig>): void {
  const next = {
    ...readConfig(),
    ...partial
  };
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
}

function configFrom(raw: Record<string, unknown>): VspecConfig {
  return {
    api_url: stringField(raw.api_url),
    current_project_id: stringField(raw.current_project_id),
    current_project_key: stringField(raw.current_project_key),
    current_workspace_id: stringField(raw.current_workspace_id),
    current_workspace_slug: stringField(raw.current_workspace_slug),
    profile: stringField(raw.profile),
    session_token: stringField(raw.session_token)
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
