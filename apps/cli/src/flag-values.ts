import { readConfig, type VspecConfig } from "./config-store.js";

export function optionalFlag<T extends object>(values: T, name: keyof T): string | undefined {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value;
}

export function requiredFlag<T extends object>(values: T, name: keyof T): string {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing --${String(name)}.`);
  }

  return value;
}

export function resolveContextFlag(
  flags: Record<string, unknown>,
  key: "api-url" | "session-cookie" | "workspace-id"
): string {
  const fromFlag = optionalFlag(flags, key);
  if (fromFlag !== undefined) {
    return sessionCookieValue(key, fromFlag);
  }

  const fromConfig = configValueFor(readConfig(), key);
  if (fromConfig !== undefined) {
    return sessionCookieValue(key, fromConfig);
  }

  if (key === "api-url") {
    const apiUrl = process.env.VSPEC_API_URL;
    if (apiUrl !== undefined && apiUrl.trim() !== "") {
      return apiUrl;
    }
  }

  throw new Error(`Missing ${key}. Run 'vspec login' or pass --${key}.`);
}

export function requiredArgument(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function configValueFor(
  config: VspecConfig,
  key: "api-url" | "session-cookie" | "workspace-id"
): string | undefined {
  switch (key) {
    case "api-url":
      return config.api_url;
    case "session-cookie":
      return config.session_token;
    case "workspace-id":
      return config.current_workspace_id;
  }
}

function sessionCookieValue(key: "api-url" | "session-cookie" | "workspace-id", value: string): string {
  if (key !== "session-cookie" || value.includes("vspec_session=")) {
    return value;
  }

  return `vspec_session=${value}`;
}
