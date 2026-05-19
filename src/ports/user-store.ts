import type { StoredUser } from "../http/signup-types.js";

export type UserStore = {
  findUserByEmail: (email: string) => Promise<StoredUser | undefined>;
  findUserByGithubId: (githubId: string) => Promise<StoredUser | undefined>;
  saveUser: (user: StoredUser) => Promise<void>;
  updateLastLoginAt: (userId: string, lastLoginAt: string) => Promise<void>;
};
