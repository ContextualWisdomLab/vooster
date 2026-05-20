import type { StoredUser } from "../domain/entities/index.js";
import type { UserStore } from "../ports/user-store.js";

export function createMemoryUserStore(): UserStore {
  const usersByGithubId = new Map<string, StoredUser>();

  return {
    findUserByEmail(email) {
      return Promise.resolve(
        [...usersByGithubId.values()].find((user) => user.email === email)
      );
    },

    findUserByGithubId(githubId) {
      return Promise.resolve(usersByGithubId.get(githubId));
    },

    saveUser(user) {
      usersByGithubId.set(user.github_id, user);
      return Promise.resolve();
    },

    updateLastLoginAt(userId, lastLoginAt) {
      for (const user of usersByGithubId.values()) {
        if (user.id === userId) {
          user.last_login_at = lastLoginAt;
          break;
        }
      }
      return Promise.resolve();
    }
  };
}
