import type { StoredApiKey } from "../domain/entities/index.js";
import type { ApiKeyStore } from "../ports/api-key-store.js";

export function createMemoryApiKeyStore(): ApiKeyStore {
  const apiKeysById = new Map<string, StoredApiKey>();

  return {
    findApiKeyById(apiKeyId) {
      return Promise.resolve(apiKeysById.get(apiKeyId));
    },

    listApiKeysForWorkspace(workspaceId) {
      return Promise.resolve(
        [...apiKeysById.values()].filter((apiKey) => apiKey.workspace_id === workspaceId)
      );
    },

    saveApiKey(apiKey) {
      apiKeysById.set(apiKey.id, apiKey);
      return Promise.resolve();
    },

    updateApiKey(apiKey) {
      apiKeysById.set(apiKey.id, apiKey);
      return Promise.resolve();
    }
  };
}
