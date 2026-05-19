import type { StoredRevision } from "../http/signup-types.js";

export type RevisionStore = {
  findRevisionById: (revisionId: string) => Promise<StoredRevision | undefined>;
  latestRevision: (entityId: string) => Promise<StoredRevision | undefined>;
  listRevisions: (entityId: string) => Promise<StoredRevision[]>;
  nextVersionNumber: (entityId: string) => Promise<number>;
  saveRevision: (revision: StoredRevision) => Promise<void>;
};
