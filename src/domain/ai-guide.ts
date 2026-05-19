export type AiGuideFormat = "json" | "markdown";

export type CachedAiGuide = {
  cli_version: string;
  content: string;
};

export type SuggestedNextAction = {
  command: string;
  reason: string;
};

export type AiGuideRequest = {
  cachedGuides: CachedAiGuide[];
  cliVersion: string;
  format: AiGuideFormat;
  simulateNetworkFailure: boolean;
};

export type AiGuideSection = {
  body: string;
  heading: string;
};
