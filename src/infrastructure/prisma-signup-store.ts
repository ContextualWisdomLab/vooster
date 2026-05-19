import { PrismaClient } from "@prisma/client";
import type { SignupEntities, SignupStore, WorkspaceSummary } from "../ports/signup-store.js";
import type {
  StoredActor,
  StoredMembership,
  StoredProject,
  StoredSpecBranch,
  StoredUser
} from "../http/signup-types.js";

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

  async archiveActor(
    projectId: string,
    actorId: string,
    archivedAt: string
  ): Promise<boolean> {
    const result = await this.prisma.actor.updateMany({
      data: { archived_at: new Date(archivedAt) },
      where: { id: actorId, project_id: projectId }
    });

    return result.count > 0;
  }

  async findActorById(
    projectId: string,
    actorId: string
  ): Promise<StoredActor | undefined> {
    const actor = await this.prisma.actor.findFirst({
      where: { id: actorId, project_id: projectId }
    });

    return actor === null ? undefined : storedActor(actor);
  }

  async findActorByName(
    projectId: string,
    name: string
  ): Promise<StoredActor | undefined> {
    const actor = await this.prisma.actor.findUnique({
      where: { project_id_name: { name, project_id: projectId } }
    });

    return actor === null ? undefined : storedActor(actor);
  }

  async listActors(projectId: string): Promise<StoredActor[]> {
    const actors = await this.prisma.actor.findMany({
      orderBy: { created_at: "asc" },
      where: { project_id: projectId }
    });

    return actors.map(storedActor);
  }

  async membershipForProject(
    projectId: string,
    userId: string
  ): Promise<StoredMembership | undefined> {
    const project = await this.prisma.project.findUnique({
      select: { workspace_id: true },
      where: { id: projectId }
    });
    if (project === null) {
      return undefined;
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: project.workspace_id
        }
      }
    });

    return membership === null ? undefined : storedMembership(membership);
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

  async saveActor(actor: StoredActor): Promise<void> {
    await this.prisma.actor.create({
      data: {
        ...actor,
        aliases: JSON.stringify(actor.aliases),
        archived_at: dateOrNull(actor.archived_at)
      }
    });
  }

  async saveProjectWithDefaultBranch(
    project: StoredProject,
    branch: StoredSpecBranch
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.project.create({
        data: {
          id: project.id,
          key: project.key,
          name: project.name,
          visibility: project.visibility,
          workspace_id: project.workspace_id
        }
      }),
      this.prisma.specBranch.create({
        data: {
          base_branch_id: branch.base_branch_id,
          id: branch.id,
          name: branch.name,
          owner_id: branch.owner_id,
          owner_type: branch.owner_type,
          project_id: branch.project_id
        }
      }),
      this.prisma.project.update({
        data: { default_branch_id: branch.id },
        where: { id: project.id }
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

function storedActor(actor: {
  aliases: string;
  archived_at: Date | null;
  description: null | string;
  id: string;
  is_human: boolean;
  name: string;
  project_id: string;
  type: string;
}): StoredActor {
  return {
    aliases: parseAliases(actor.aliases),
    archived_at: actor.archived_at?.toISOString() ?? null,
    description: actor.description ?? "",
    id: actor.id,
    is_human: actor.is_human,
    name: actor.name,
    project_id: actor.project_id,
    type: storedActorType(actor.type)
  };
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

function dateOrNull(value: null | string): Date | null {
  return value === null ? null : new Date(value);
}

function parseAliases(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")
    ? parsed
    : [];
}

function storedActorType(type: string): StoredActor["type"] {
  return type === "OFFSTAGE" || type === "SUPPORTING" ? type : "PRIMARY";
}
