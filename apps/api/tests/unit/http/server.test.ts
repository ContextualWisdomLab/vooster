import { afterEach, describe, expect, test, vi } from "vitest";
import { createServer } from "../../../src/http/server.js";
import type { StoredUser } from "../../../src/domain/entities/index.js";
import type { SignupStore } from "../../../src/ports/signup-store.js";

describe("server startup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("does not reseed the stub user when it already exists", async () => {
    const saveUser = vi.fn<SignupStore["saveUser"]>();
    const app = await createServer({
      authStub: true,
      signupStore: signupStore({
        findUserByGithubId: () => Promise.resolve(stubUser()),
        saveUser
      })
    });

    await app.close();

    expect(saveUser).not.toHaveBeenCalled();
  });

  test("continues when stub user lookup sees an uncreated database table", async () => {
    const saveUser = vi.fn<SignupStore["saveUser"]>();
    const app = await createServer({
      authStub: true,
      signupStore: signupStore({
        findUserByGithubId: () =>
          Promise.reject(Object.assign(new Error("missing table"), { code: "P2021" })),
        saveUser
      })
    });

    await app.close();

    expect(saveUser).not.toHaveBeenCalled();
  });

  test("fails startup when stub user lookup fails for another reason", async () => {
    await expect(
      createServer({
        authStub: true,
        signupStore: signupStore({
          findUserByGithubId: () => Promise.reject(new Error("lookup failed"))
        })
      })
    ).rejects.toThrow("lookup failed");
  });

  test("adds default security headers to health responses", async () => {
    const app = await createServer({ authStub: true });

    try {
      const response = await app.inject({ method: "GET", url: "/healthz" });

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    } finally {
      await app.close();
    }
  });

  test("does not allow cross-origin requests without an allow-list", async () => {
    const app = await createServer({ authStub: true });

    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/healthz",
        headers: {
          "access-control-request-method": "GET",
          origin: "https://evil.example"
        }
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  test("allows configured CORS origins and trims list entries", async () => {
    vi.stubEnv(
      "VSPEC_ALLOWED_ORIGINS",
      "https://app.example.com, https://admin.example.com"
    );
    const app = await createServer({ authStub: true });

    try {
      const allowed = await app.inject({
        method: "OPTIONS",
        url: "/healthz",
        headers: {
          "access-control-request-method": "GET",
          origin: "https://admin.example.com"
        }
      });
      const blocked = await app.inject({
        method: "OPTIONS",
        url: "/healthz",
        headers: {
          "access-control-request-method": "GET",
          origin: "https://evil.example"
        }
      });

      expect(allowed.headers["access-control-allow-origin"]).toBe(
        "https://admin.example.com"
      );
      expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

function signupStore(overrides: Partial<SignupStore>): SignupStore {
  return {
    close: () => Promise.resolve(),
    findUserByGithubId: () => Promise.resolve(undefined),
    saveUser: () => Promise.resolve(),
    ...overrides
  } as SignupStore;
}

function stubUser(): StoredUser {
  return {
    id: "stub-zero-workspace-user-id",
    github_id: "stub-zero-workspace-user",
    email: "stub-zero-workspace-user@users.noreply.github.com",
    name: "Stub Zero Workspace User",
    avatar_url: "https://github.com/identicons/stub-zero-workspace-user.png"
  };
}
