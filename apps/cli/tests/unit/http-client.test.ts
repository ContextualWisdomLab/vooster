import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ApiError,
  deleteJson,
  fetchJson,
  isApiError,
  patchJson,
  postJson,
  postText
} from "../../src/http-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CLI HTTP client", () => {
  test("sends JSON requests and returns body plus set-cookie", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ project: { id: "project-1" } }, { "set-cookie": "session=1" })
    );

    await expect(
      postJson("https://api.example.test/v1/projects", { key: "PAY" }, { Cookie: "c" })
    ).resolves.toEqual({
      body: { project: { id: "project-1" } },
      cookie: "session=1"
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/projects", {
      body: JSON.stringify({ key: "PAY" }),
      headers: { "Content-Type": "application/json", Cookie: "c" },
      method: "POST"
    });
  });

  test("supports patch, delete, explicit fetch, and text responses", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ ok: "patch" }),
      jsonResponse({ ok: "delete" }),
      jsonResponse({ ok: "fetch" }),
      new Response("Feature: Checkout")
    );

    await expect(
      patchJson("https://api.example.test/item", { name: "New" })
    ).resolves.toMatchObject({ body: { ok: "patch" } });
    await expect(deleteJson("https://api.example.test/item")).resolves.toMatchObject({
      body: { ok: "delete" }
    });
    await expect(
      fetchJson(new URL("https://api.example.test/item"), { method: "GET" })
    ).resolves.toMatchObject({ body: { ok: "fetch" } });
    await expect(
      postText("https://api.example.test/export", { id: "UC-1" })
    ).resolves.toEqual({ body: "Feature: Checkout" });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("throws ApiError with parsed JSON error body", async () => {
    mockFetch(jsonResponse({ title: "No access" }, undefined, 403));

    await expect(
      fetchJson("https://api.example.test/private", { method: "GET" })
    ).rejects.toMatchObject({
      body: { title: "No access" },
      message: "API request failed with 403.",
      name: "ApiError",
      status: 403
    });
  });

  test("throws ApiError with null body when error response is not JSON", async () => {
    mockFetch(new Response("not json", { status: 502 }));

    try {
      await postText("https://api.example.test/export", {});
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (!isApiError(error)) {
        throw error;
      }
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(502);
      expect(error.body).toBeNull();
      return;
    }
    throw new Error("expected ApiError");
  });
});

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(
  body: unknown,
  headers?: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
    status
  });
}
