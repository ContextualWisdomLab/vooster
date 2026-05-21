import type { PrismaClient } from "@prisma/client";

import type { StoredApiKey } from "../domain/entities/index.js";
import type { ApiKeyStore } from "../ports/api-key-store.js";
import {
  apiKeyData,
  apiKeyUpdate,
  storedApiKey
} from "./prisma-signup-mappers.js";

export function createPrismaApiKeyStore(prisma: PrismaClient): ApiKeyStore {
  return new PrismaApiKeyStore(prisma);
}

class PrismaApiKeyStore implements ApiKeyStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findApiKeyById(apiKeyId: string): Promise<StoredApiKey | undefined> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId }
    });

    return apiKey === null ? undefined : storedApiKey(apiKey);
  }

  async listApiKeysForWorkspace(workspaceId: string): Promise<StoredApiKey[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      orderBy: { created_at: "asc" },
      where: { workspace_id: workspaceId }
    });

    return apiKeys.map(storedApiKey);
  }

  async saveApiKey(apiKey: StoredApiKey): Promise<void> {
    await this.prisma.apiKey.create({ data: apiKeyData(apiKey) });
  }

  async updateApiKey(apiKey: StoredApiKey): Promise<void> {
    await this.prisma.apiKey.update({
      data: apiKeyUpdate(apiKey),
      where: { id: apiKey.id }
    });
  }
}
