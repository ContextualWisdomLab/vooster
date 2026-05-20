import type { PrismaClient } from "@prisma/client";

import type { StoredUser } from "../domain/entities/index.js";
import type { UserStore } from "../ports/user-store.js";
import { storedUser } from "./prisma-signup-mappers.js";

export function createPrismaUserStore(prisma: PrismaClient): UserStore {
  return new PrismaUserStore(prisma);
}

class PrismaUserStore implements UserStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    return user === null ? undefined : storedUser(user);
  }

  async findUserByGithubId(githubId: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { github_id: githubId }
    });

    return user === null ? undefined : storedUser(user);
  }

  async saveUser(user: StoredUser): Promise<void> {
    await this.prisma.user.create({ data: user });
  }

  async updateLastLoginAt(userId: string, lastLoginAt: string): Promise<void> {
    await this.prisma.user.update({
      data: { last_login_at: new Date(lastLoginAt) },
      where: { id: userId }
    });
  }
}
