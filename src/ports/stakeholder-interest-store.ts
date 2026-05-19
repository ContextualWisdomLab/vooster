import type { StoredStakeholderInterest } from "../http/signup-types.js";

export type StakeholderInterestStore = {
  deleteStakeholderInterest: (interestId: string) => Promise<void>;
  findStakeholderInterestById: (
    usecaseId: string,
    interestId: string
  ) => Promise<StoredStakeholderInterest | undefined>;
  findStakeholderInterestForStakeholder: (
    usecaseId: string,
    stakeholderId: string
  ) => Promise<StoredStakeholderInterest | undefined>;
  listStakeholderInterests: (usecaseId: string) => Promise<StoredStakeholderInterest[]>;
  saveStakeholderInterest: (interest: StoredStakeholderInterest) => Promise<void>;
};
