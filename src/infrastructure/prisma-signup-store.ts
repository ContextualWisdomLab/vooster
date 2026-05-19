import { PrismaClient } from "@prisma/client";
import type { SignupEntities, SignupStore, WorkspaceSummary } from "../ports/signup-store.js";
import type { StoredMembership, StoredUser } from "../http/signup-types.js";

export function createPrismaSignupStore(databaseUrl: string): SignupStore {
  return new PrismaSignupStore(
    new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    })
  );
}

class PrismaSignupStore implements SignupStore {
  constructor(private readonly prisma: PrismaClient) {}

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async findUserByGithubId(githubId: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { github_id: githubId }
    });

    return user === null ? undefined : storedUser(user);
  }

  async saveSignup(entities: SignupEntities): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.create({
        data: entities.user
      }),
      this.prisma.workspace.create({
        data: entities.workspace
      }),
      this.prisma.membership.create({
        data: entities.membership
      })
    ]);
  }

  async updateLastLoginAt(userId: string, lastLoginAt: string): Promise<void> {
    await this.prisma.user.update({
      data: { last_login_at: new Date(lastLoginAt) },
      where: { id: userId }
    });
  }

  async workspaceSlugExists(slug: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      select: { id: true },
      where: { slug }
    });

    return workspace !== null;
  }

  async workspaceSummariesForUser(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      include: {
        workspace: true
      },
      where: { user_id: userId }
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      role: storedMembership(membership).role,
      slug: membership.workspace.slug
    }));
  }
}

function storedUser(user: {
  avatar_url: null | string;
  email: string;
  github_id: string;
  id: string;
  last_login_at: Date | null;
  name: null | string;
}): StoredUser {
  return {
    avatar_url: user.avatar_url ?? "",
    email: user.email,
    github_id: user.github_id,
    id: user.id,
    last_login_at: user.last_login_at?.toISOString(),
    name: user.name ?? ""
  };
}

function storedMembership(membership: {
  id: string;
  role: string;
  user_id: string;
  workspace_id: string;
}): StoredMembership {
  return {
    id: membership.id,
    role: membership.role === "OWNER" ? "OWNER" : "EDITOR",
    user_id: membership.user_id,
    workspace_id: membership.workspace_id
  };
}
