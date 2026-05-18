import { createServer } from "../../src/http/server.js";

type TestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type TestRequest = {
  method?: TestMethod;
  headers?: Record<string, string>;
  body?: string;
};

export type TestServer = {
  fetch: (path: string, init?: TestRequest) => Promise<Response>;
  stop: () => Promise<void>;
};

export async function startServer(): Promise<TestServer> {
  const app = await createServer({ authStub: true });

  return {
    fetch: async (path, init) => {
      const url = new URL(path, "http://vspec.test");
      const response = await app.inject({
        method: init?.method ?? "GET",
        url: `${url.pathname}${url.search}`,
        headers: init?.headers,
        payload: init?.body
      });

      return new Response(response.payload, {
        status: response.statusCode,
        headers: responseHeaders(response.headers)
      });
    },
    stop: async () => {
      await app.close();
    }
  };
}

function responseHeaders(headers: Record<string, number | string | string[] | undefined>): Headers {
  const result = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        result.append(key, entry);
      }
    } else if (value !== undefined) {
      result.set(key, String(value));
    }
  }

  return result;
}
