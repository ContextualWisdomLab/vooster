import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import {
  deleteProjectViaPrisma,
  updateProjectNameViaPrisma
} from "../../src/infrastructure/prisma-project-mutations.js";

describe("prisma project mutation helpers", () => {
  test("returns not found when the project does not exist", async () => {
    const prisma = prismaClient({ findProject: null });

    await expect(deleteProjectViaPrisma(prisma.client, "project-1")).resolves.toBe(
      "NOT_FOUND"
    );

    expect(prisma.transaction).not.toHaveBeenCalled();
  });

  test("clears branches before deleting an existing project", async () => {
    const prisma = prismaClient({});

    await expect(deleteProjectViaPrisma(prisma.client, "project-1")).resolves.toBe(
      "DELETED"
    );

    expect(prisma.projectUpdate).toHaveBeenCalledWith({
      data: { default_branch_id: null },
      where: { id: "project-1" }
    });
    expect(prisma.branchDeleteMany).toHaveBeenCalledWith({
      where: { project_id: "project-1" }
    });
    expect(prisma.projectDelete).toHaveBeenCalledWith({
      where: { id: "project-1" }
    });
  });

  test("reports dependency conflicts from Prisma foreign key errors", async () => {
    const prisma = prismaClient({ transactionError: prismaError("P2003") });

    await expect(deleteProjectViaPrisma(prisma.client, "project-1")).resolves.toBe(
      "HAS_DEPENDENCIES"
    );
  });

  test("rethrows unexpected project delete errors", async () => {
    const error = new Error("database unavailable");
    const prisma = prismaClient({ transactionError: error });

    await expect(deleteProjectViaPrisma(prisma.client, "project-1")).rejects.toBe(
      error
    );
  });

  test("updates a project name and returns the stored project shape", async () => {
    const prisma = prismaClient({});

    await expect(
      updateProjectNameViaPrisma(prisma.client, "project-1", "New name")
    ).resolves.toEqual({
      default_branch_id: "",
      id: "project-1",
      key: "PRJ",
      name: "New name",
      visibility: "PRIVATE",
      workspace_id: "workspace-1"
    });

    expect(prisma.projectUpdate).toHaveBeenCalledWith({
      data: { name: "New name" },
      where: { id: "project-1" }
    });
  });

  test("returns undefined when the project update misses", async () => {
    const prisma = prismaClient({ updateError: prismaError("P2025") });

    await expect(
      updateProjectNameViaPrisma(prisma.client, "project-1", "New name")
    ).resolves.toBeUndefined();
  });

  test("rethrows unexpected project update errors", async () => {
    const error = prismaError("P2003");
    const prisma = prismaClient({ updateError: error });

    await expect(
      updateProjectNameViaPrisma(prisma.client, "project-1", "New name")
    ).rejects.toBe(error);
  });
});

type ProjectRecord = {
  default_branch_id: null | string;
  id: string;
  key: string;
  name: string;
  visibility: string;
  workspace_id: string;
};

type ProjectUpdateArgs = {
  data: { default_branch_id: null } | { name: string };
  where: { id: string };
};

function prismaClient(options: {
  findProject?: null | ProjectRecord;
  transactionError?: Error;
  updateError?: Error;
}) {
  const record = projectRecord();
  const findUnique = vi.fn(
    (): Promise<null | ProjectRecord> =>
      Promise.resolve(options.findProject === undefined ? record : options.findProject)
  );
  const projectUpdate = vi.fn((args: ProjectUpdateArgs): Promise<ProjectRecord> => {
    if (options.updateError !== undefined) {
      return Promise.reject(options.updateError);
    }
    return Promise.resolve({
      ...record,
      default_branch_id: "name" in args.data ? null : record.default_branch_id,
      name: "name" in args.data ? args.data.name : record.name
    });
  });
  const branchDeleteMany = vi.fn((): Promise<void> => Promise.resolve());
  const projectDelete = vi.fn((): Promise<void> => Promise.resolve());
  const tx = {
    project: { delete: projectDelete, update: projectUpdate },
    specBranch: { deleteMany: branchDeleteMany }
  };
  const runTransaction = (
    callback: (transactionClient: typeof tx) => Promise<unknown>
  ): Promise<unknown> => {
    if (options.transactionError !== undefined) {
      return Promise.reject(options.transactionError);
    }
    return callback(tx);
  };
  const transaction = vi.fn(runTransaction);

  return {
    branchDeleteMany,
    client: {
      $transaction: transaction,
      project: { findUnique, update: projectUpdate }
    } as unknown as PrismaClient,
    findUnique,
    projectDelete,
    projectUpdate,
    transaction
  };
}

function projectRecord(): ProjectRecord {
  return {
    default_branch_id: "branch-1",
    id: "project-1",
    key: "PRJ",
    name: "Project",
    visibility: "EXTERNAL",
    workspace_id: "workspace-1"
  };
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Prisma error", {
    clientVersion: "test",
    code
  });
}
