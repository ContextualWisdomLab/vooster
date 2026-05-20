import type { StoredStakeholderInterest } from "../domain/entities/index.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";

export function createMemoryStakeholderInterestStore(): StakeholderInterestStore {
  const interestsByUseCaseId = new Map<string, StoredStakeholderInterest[]>();

  return {
    deleteStakeholderInterest(interestId) {
      for (const [usecaseId, interests] of interestsByUseCaseId) {
        interestsByUseCaseId.set(
          usecaseId,
          interests.filter((interest) => interest.id !== interestId)
        );
      }
      return Promise.resolve();
    },

    findStakeholderInterestById(usecaseId, interestId) {
      return Promise.resolve(
        (interestsByUseCaseId.get(usecaseId) ?? []).find(
          (interest) => interest.id === interestId
        )
      );
    },

    findStakeholderInterestForStakeholder(usecaseId, stakeholderId) {
      return Promise.resolve(
        (interestsByUseCaseId.get(usecaseId) ?? []).find(
          (interest) => interest.stakeholder_id === stakeholderId
        )
      );
    },

    listStakeholderInterests(usecaseId) {
      return Promise.resolve(interestsByUseCaseId.get(usecaseId) ?? []);
    },

    saveStakeholderInterest(interest) {
      interestsByUseCaseId.set(interest.usecase_id, [
        ...(interestsByUseCaseId.get(interest.usecase_id) ?? []),
        interest
      ]);
      return Promise.resolve();
    }
  };
}
