import type { StoredStakeholder } from "../http/signup-types.js";

export type StakeholderStore = {
  findStakeholderById: (
    projectId: string,
    stakeholderId: string
  ) => Promise<StoredStakeholder | undefined>;
  findStakeholderByName: (
    projectId: string,
    name: string
  ) => Promise<StoredStakeholder | undefined>;
  listStakeholders: (projectId: string) => Promise<StoredStakeholder[]>;
  saveStakeholder: (stakeholder: StoredStakeholder) => Promise<void>;
};
