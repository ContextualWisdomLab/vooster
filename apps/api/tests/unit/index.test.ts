import { describe, expect, test, vi } from "vitest";
import { startApi, type ApiRuntime } from "../../src/index.js";
import type { createServer } from "../../src/http/server.js";
import type { createPrismaSignupStore } from "../../src/infrastructure/prisma-signup-store.js";

describe("API entrypoint", () => {
  test("starts with default port and no optional adapters", async () => {
    const runtime = runtimeFor({});

    await startApi(runtime);

    expect(runtime.createServer).toHaveBeenCalledWith({
      authStub: false,
      githubOAuth: undefined,
      signupStore: undefined
    });
    expect(runtime.app.listen).toHaveBeenCalledWith({ host: "0.0.0.0", port: 8080 });
    expect(runtime.once.mock.calls.map(([signal]) => signal)).toEqual([
      "SIGINT",
      "SIGTERM"
    ]);

    runtime.once.mock.calls[0]?.[1]();
    runtime.once.mock.calls[1]?.[1]();
    expect(runtime.app.close).toHaveBeenCalledTimes(2);
  });

  test("wires auth stub, database store, and custom port from env", async () => {
    const runtime = runtimeFor({
      DATABASE_URL: "postgres://example",
      GITHUB_CLIENT_ID: "ignored-client",
      GITHUB_CLIENT_SECRET: "ignored-secret",
      PORT: "3001",
      VSPEC_AUTH_STUB: "1"
    });

    await startApi(runtime);

    expect(runtime.createSignupStore).toHaveBeenCalledWith("postgres://example");
    expect(runtime.createServer).toHaveBeenCalledWith({
      authStub: true,
      githubOAuth: undefined,
      signupStore: runtime.signupStore
    });
    expect(runtime.app.listen).toHaveBeenCalledWith({ host: "0.0.0.0", port: 3001 });
  });

  test("force-memory mode ignores ambient database URLs", async () => {
    const runtime = runtimeFor({
      DATABASE_URL: "postgres://example",
      PORT: "8799",
      VSPEC_AUTH_STUB: "1",
      VSPEC_FORCE_MEMORY_STORE: "1"
    });

    await startApi(runtime);

    expect(runtime.createSignupStore).not.toHaveBeenCalled();
    expect(runtime.createServer).toHaveBeenCalledWith({
      authStub: true,
      githubOAuth: undefined,
      signupStore: undefined
    });
    expect(runtime.app.listen).toHaveBeenCalledWith({ host: "0.0.0.0", port: 8799 });
  });

  test("wires GitHub OAuth when both credentials are present", async () => {
    const runtime = runtimeFor({
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret"
    });

    await startApi(runtime);

    expect(runtime.createServer).toHaveBeenCalledWith({
      authStub: false,
      githubOAuth: { clientId: "client-id", clientSecret: "client-secret" },
      signupStore: undefined
    });
  });

  test("rejects invalid ports before creating a server", async () => {
    const runtime = runtimeFor({ PORT: "70000" });

    await expect(startApi(runtime)).rejects.toThrow("Invalid PORT: 70000");
    expect(runtime.createServer).not.toHaveBeenCalled();
  });
});

function runtimeFor(env: Record<string, string | undefined>) {
  const app = {
    close: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    listen: vi.fn<() => Promise<void>>(() => Promise.resolve())
  };
  const fastifyApp = app as unknown as Awaited<ReturnType<typeof createServer>>;
  const signupStore = {} as ReturnType<typeof createPrismaSignupStore>;
  return {
    app,
    createServer: vi.fn<ApiRuntime["createServer"]>(() => Promise.resolve(fastifyApp)),
    createSignupStore: vi.fn<ApiRuntime["createSignupStore"]>(() => signupStore),
    env,
    once: vi.fn<ApiRuntime["once"]>(),
    signupStore
  };
}
