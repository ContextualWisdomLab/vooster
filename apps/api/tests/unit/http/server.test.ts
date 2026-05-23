import { describe, expect, test, vi } from "vitest";
import { createServer } from "../../../src/http/server.js";
import type { StoredUser } from "../../../src/domain/entities/index.js";
import type { SignupStore } from "../../../src/ports/signup-store.js";

describe("server startup", () => {
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
