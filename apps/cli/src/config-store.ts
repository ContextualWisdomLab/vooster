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
  cwd?: string;
  path?: string;
};

type WriteConfigOptions = ConfigStoreOptions & {
  merge?: boolean;
};

export function configPath(options: ConfigStoreOptions = {}): string {
  return options.path ?? process.env.VSPEC_CONFIG_PATH ?? globalConfigPath();
}

export function globalConfigPath(): string {
  return (
    process.env.VSPEC_GLOBAL_CONFIG_PATH ?? join(homedir(), ".vspec", "config.json")
  );
}

export function localConfigPath(cwd = process.cwd()): string {
  return join(cwd, ".vspec", "config.json");
}

export function discoverLocalConfigPath(start: string = process.cwd()): string | null {
  let dir = start;
  let parent = dirname(dir);
  while (parent !== dir) {
    const candidate = join(dir, ".vspec", "config.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    if (existsSync(join(dir, ".git"))) {
      return null;
    }
    dir = parent;
    parent = dirname(dir);
  }
  const rootCandidate = join(dir, ".vspec", "config.json");
  return existsSync(rootCandidate) ? rootCandidate : null;
}

export function configExists(options: ConfigStoreOptions = {}): boolean {
  return existsSync(configPath(options));
}

export function readConfig(options: ConfigStoreOptions = {}): VspecConfig {
  if (options.path !== undefined || process.env.VSPEC_CONFIG_PATH !== undefined) {
    return readSingleConfig(configPath(options));
  }

  const base = readSingleConfig(globalConfigPath());
  const localPath = discoverLocalConfigPath(options.cwd ?? process.cwd());
  if (localPath === null) {
    return base;
  }

  const local = readSingleConfig(localPath);
  return { ...base, ...stripUndefined(local) };
}

function stripUndefined(config: VspecConfig): Partial<VspecConfig> {
  const result: Partial<VspecConfig> = {};
  for (const [key, value] of Object.entries(config) as Array<
    [keyof VspecConfig, string | undefined]
  >) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function readSingleConfig(path: string): VspecConfig {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
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
  assertWriteTargetIsExplicitInTests(options);
  const path = configPath(options);
  const next =
    options.merge === false
      ? partial
      : {
          ...readSingleConfig(path),
          ...partial
        };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
}

function assertWriteTargetIsExplicitInTests(options: WriteConfigOptions): void {
  if (
    process.env.NODE_ENV === "test" &&
    options.path === undefined &&
    process.env.VSPEC_CONFIG_PATH === undefined &&
    process.env.VSPEC_GLOBAL_CONFIG_PATH === undefined
  ) {
    throw new Error(
      "Refusing to write ~/.vspec/config.json during tests. Set VSPEC_CONFIG_PATH or VSPEC_GLOBAL_CONFIG_PATH."
    );
  }
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
