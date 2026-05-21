import type { StoredApiKey } from "../domain/entities/index.js";

export type ApiKeyStore = {
  findApiKeyById: (apiKeyId: string) => Promise<StoredApiKey | undefined>;
  listApiKeysForWorkspace: (workspaceId: string) => Promise<StoredApiKey[]>;
  saveApiKey: (apiKey: StoredApiKey) => Promise<void>;
  updateApiKey: (apiKey: StoredApiKey) => Promise<void>;
};
