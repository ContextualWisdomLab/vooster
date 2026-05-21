import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

type ConfigStoreOptions = {
  path?: string;
};

type WriteConfigOptions = ConfigStoreOptions & {
  merge?: boolean;
};

export function configPath(options: ConfigStoreOptions = {}): string {
  return options.path ?? process.env.VSPEC_CONFIG_PATH ?? join(homedir(), ".vspec", "config.json");
}

export function localConfigPath(cwd = process.cwd()): string {
  return join(cwd, ".vspec", "config.json");
}

export function configExists(options: ConfigStoreOptions = {}): boolean {
  return existsSync(configPath(options));
}

export function readConfig(options: ConfigStoreOptions = {}): VspecConfig {
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath(options), "utf8"));
    return isRecord(parsed) ? configFrom(parsed) : {};
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }

    throw error;
  }
}

export function writeConfig(
  partial: Partial<VspecConfig>,
  options: WriteConfigOptions = {}
): void {
  const next =
    options.merge === false
      ? partial
      : {
          ...readConfig(options),
          ...partial
        };
  const path = configPath(options);
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
