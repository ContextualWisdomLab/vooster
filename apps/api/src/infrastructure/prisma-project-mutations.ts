import { Prisma, type PrismaClient } from "@prisma/client";

import type { StoredProject } from "../domain/entities/index.js";
import type { DeleteProjectOutcome } from "../ports/project-store.js";
import { storedProject } from "./prisma-signup-mappers.js";

export async function deleteProjectViaPrisma(
  prisma: PrismaClient,
  projectId: string
): Promise<DeleteProjectOutcome> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project === null) {
    return "NOT_FOUND";
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { default_branch_id: null }
      });
      await tx.specBranch.deleteMany({ where: { project_id: projectId } });
      await tx.project.delete({ where: { id: projectId } });
    });
  } catch (error) {
    if (isPrismaCode(error, "P2003")) {
      return "HAS_DEPENDENCIES";
    }
    throw error;
  }

  return "DELETED";
}

export async function updateProjectNameViaPrisma(
  prisma: PrismaClient,
  projectId: string,
  name: string
): Promise<StoredProject | undefined> {
  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { name }
    });
    return storedProject(project);
  } catch (error) {
    if (isPrismaCode(error, "P2025")) {
      return undefined;
    }
    throw error;
  }
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
