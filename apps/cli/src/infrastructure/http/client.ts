import { ApiError } from "./api-error.js";

export type JsonResponse = {
  body: unknown;
  cookie: string;
};

export type TextResponse = {
  body: string;
};

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST"
  });
}

export async function patchJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
    method: "PATCH"
  });
}

export async function deleteJson(
  url: string,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, { headers, method: "DELETE" });
}

export async function fetchJson(
  url: URL | string,
  init: RequestInit
): Promise<JsonResponse> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorBody(response));
  }
  const body: unknown = await response.json();
  return {
    body,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

export async function postText(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<TextResponse> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST"
  });
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorBody(response));
  }
  return { body: await response.text() };
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
