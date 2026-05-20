export type JsonResponse = {
  body: unknown;
  cookie: string;
};

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
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
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "PATCH"
  });
}

export async function deleteJson(
  url: string,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    headers,
    method: "DELETE"
  });
}

export async function fetchJson(url: URL | string, init: RequestInit): Promise<JsonResponse> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}.`);
  }

  return {
    body,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

type TextResponse = {
  body: string;
};

export async function postText(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<TextResponse> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "POST"
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}.`);
  }

  return { body: responseBody };
}
