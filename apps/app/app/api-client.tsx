import { cookies } from "next/headers";

function apiUrl(): string {
  return process.env.VSPEC_API_URL ?? "http://127.0.0.1:3000";
}

async function sessionCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const session = cookieStore.get("vspec_session")?.value;
  return session === undefined ? "" : `vspec_session=${session}`;
}

export async function readApi<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    headers: { Cookie: await sessionCookieHeader() },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}`);
  }

  return response.json() as Promise<T>;
}

export type MutateOptions = {
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export type MutateResult = { ok: true; body: unknown } | { ok: false; error: string };

export async function mutateApi(
  path: string,
  options: MutateOptions
): Promise<MutateResult> {
  const headers: Record<string, string> = {
    Cookie: await sessionCookieHeader()
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${apiUrl()}${path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: extractError(text, response.status) };
  }

  if (response.status === 204) {
    return { ok: true, body: null };
  }
  return { ok: true, body: (await response.json()) as unknown };
}

function extractError(text: string, status: number): string {
  try {
    const parsed = JSON.parse(text) as { title?: string };
    if (typeof parsed.title === "string" && parsed.title.length > 0) {
      return parsed.title;
    }
  } catch {
    // fall through
  }
  return `Request failed (${String(status)})`;
}
