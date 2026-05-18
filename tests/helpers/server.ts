import { createServer } from "../../src/http/server.js";

export type TestServer = {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  stop: () => Promise<void>;
};

export async function startServer(): Promise<TestServer> {
  const app = await createServer({ authStub: true });
  await app.listen({ host: "127.0.0.1", port: 0 });

  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    fetch: (path, init) => fetch(new URL(path, baseUrl), init),
    stop: () => app.close()
  };
}
