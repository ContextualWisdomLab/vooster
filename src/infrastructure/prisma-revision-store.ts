import type { PrismaClient } from "@prisma/client";

import type { StoredRevision } from "../domain/entities/index.js";
import type { RevisionStore } from "../ports/revision-store.js";
import {
  revisionContentHash,
  revisionProjectId,
  storedRevision
} from "./prisma-signup-mappers.js";

export function createPrismaRevisionStore(prisma: PrismaClient): RevisionStore {
  return new PrismaRevisionStore(prisma);
}

class PrismaRevisionStore implements RevisionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findRevisionById(revisionId: string): Promise<StoredRevision | undefined> {
    const revision = await this.prisma.revision.findUnique({
      where: { id: revisionId }
    });

    return revision === null ? undefined : storedRevision(revision);
  }

  async latestRevision(entityId: string): Promise<StoredRevision | undefined> {
    const revision = await this.prisma.revision.findFirst({
      orderBy: { version_number: "desc" },
      where: { entity_id: entityId }
    });

    return revision === null ? undefined : storedRevision(revision);
  }

  async listRevisions(entityId: string): Promise<StoredRevision[]> {
    const revisions = await this.prisma.revision.findMany({
      orderBy: { version_number: "asc" },
      where: { entity_id: entityId }
    });

    return revisions.map(storedRevision);
  }

  async nextVersionNumber(entityId: string): Promise<number> {
    const latest = await this.latestRevision(entityId);
    return (latest?.version_number ?? 0) + 1;
  }

  async saveRevision(revision: StoredRevision): Promise<void> {
    const context = await this.revisionContext(revision);
    const parentRevisionId = await this.persistedParentRevisionId(revision);
    await this.prisma.revision.create({
      data: {
        author_id: context.authorId,
        branch_id: context.branchId,
        change_summary: revision.change_summary,
        content_hash: revisionContentHash(revision),
        entity_id: revision.entity_id,
        entity_type: revision.entity_type,
        id: revision.id,
        parent_revision_id: parentRevisionId,
        severity: revision.severity,
        snapshot: JSON.stringify(revision.snapshot),
        version_number: revision.version_number
      }
    });
    if (revision.entity_type === "USECASE" && context.advancesDefaultHead) {
      await this.prisma.useCase.update({
        data: { current_revision_id: revision.id },
        where: { id: revision.entity_id }
      });
    }
  }

  private async persistedParentRevisionId(
    revision: StoredRevision
  ): Promise<string | null> {
    if (revision.parent_revision_id === undefined) {
      return null;
    }

    return await this.prisma.revision.findUnique({
      select: { id: true },
      where: { id: revision.parent_revision_id }
    }) === null
      ? null
      : revision.parent_revision_id;
  }

  private async revisionContext(
    revision: StoredRevision
  ): Promise<{ advancesDefaultHead: boolean; authorId: string; branchId: string }> {
    const projectId = revisionProjectId(revision);
    const project = await this.prisma.project.findUnique({
      select: {
        default_branch_id: true,
        workspace: { select: { owner_id: true } }
      },
      where: { id: projectId }
    });
    if (project?.default_branch_id === null || project?.default_branch_id === undefined) {
      throw new Error(`Missing default branch for revision ${revision.id}`);
    }
    const branchId = revision.branch_id ?? project.default_branch_id;

    return {
      advancesDefaultHead: branchId === project.default_branch_id,
      authorId: project.workspace.owner_id,
      branchId
    };
  }
}
