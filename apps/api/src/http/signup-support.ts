import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import { authSignupResponseSchema, type SuggestedNextAction } from "@vooster/contracts";
import type {
  GithubProfile,
  PendingOAuth,
  PendingSignup,
  ServerOptions
} from "./signup-types.js";
import type {
  StoredMembership,
  StoredUser,
  StoredWorkspace
} from "../domain/entities/index.js";

export class GithubNetworkError extends Error {}

export function clearOAuthState(reply: FastifyReply) {
  reply.header("set-cookie", expiredCookie("vspec_oauth_state"));
}

export function signupEntities(profile: GithubProfile, pending: PendingSignup) {
  const user: StoredUser = {
    id: randomUUID(),
    github_id: profile.githubId,
    email: profile.email,
    name: profile.name,
    avatar_url: profile.avatarUrl
  };
  const workspace = workspaceFor(pending, user.id);

  return {
    user,
    workspace,
    membership: ownerMembership(user.id, workspace.id)
  };
}

export function signupResponse(
  user: StoredUser,
  workspace: StoredWorkspace,
  membership: StoredMembership
) {
  return authSignupResponseSchema.parse({
    user,
    workspace,
    membership,
    recommended_next_command: "vspec project create"
  });
}

export function githubProfile(options: ServerOptions, code: string): GithubProfile {
  if (!options.authStub) {
    throw new Error("GitHub OAuth is not configured.");
  }

  if (code === "stub-github-network-failure") {
    throw new GithubNetworkError("GitHub is unavailable.");
  }

  if (code === "stub-unverified-email") {
    return {
      githubId: code,
      email: "",
      emailVerified: false,
      name: "Stub GitHub User",
      avatarUrl: "https://github.com/identicons/stub.png"
    };
  }

  return {
    githubId: code,
    email: `${code}@users.noreply.github.com`,
    emailVerified: true,
    name: "Stub GitHub User",
    avatarUrl: "https://github.com/identicons/stub.png"
  };
}

export async function fetchGithubProfile(
  options: ServerOptions,
  code: string
): Promise<GithubProfile | undefined> {
  try {
    return options.authStub
      ? githubProfile(options, code)
      : await fetchRealGithubProfile(options, code);
  } catch (error) {
    if (error instanceof GithubNetworkError) {
      return undefined;
    }

    throw error;
  }
}

export async function fetchGithubProfileByAccessToken(
  options: ServerOptions,
  accessToken: string
): Promise<GithubProfile | undefined> {
  try {
    if (options.authStub) {
      if (!accessToken.startsWith("stub-access-token-")) {
        throw new GithubNetworkError("Stub access token was invalid.");
      }

      return githubProfile(options, accessToken.slice("stub-access-token-".length));
    }

    return await fetchRealGithubProfileByAccessToken(options, accessToken);
  } catch (error) {
    if (error instanceof GithubNetworkError) {
      return undefined;
    }

    throw error;
  }
}

async function fetchRealGithubProfile(
  options: ServerOptions,
  code: string
): Promise<GithubProfile> {
  const config = options.githubOAuth;
  if (config === undefined) {
    throw new GithubNetworkError("GitHub OAuth is not configured.");
  }

  const token = await exchangeGithubCode(config.clientId, config.clientSecret, code);
  const response = await fetch("https://api.github.com/user", {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": "vspec"
    }
  });
  if (!response.ok) {
    throw new GithubNetworkError("GitHub profile request failed.");
  }

  return profileFromGithubUser(await response.json());
}

async function fetchRealGithubProfileByAccessToken(
  options: ServerOptions,
  accessToken: string
): Promise<GithubProfile> {
  if (options.githubOAuth === undefined) {
    throw new GithubNetworkError("GitHub OAuth is not configured.");
  }

  const response = await fetch("https://api.github.com/user", {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "vspec"
    }
  });
  if (!response.ok) {
    throw new GithubNetworkError("GitHub profile request failed.");
  }

  return profileFromGithubUser(await response.json());
}

async function exchangeGithubCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code
  });
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  if (!response.ok) {
    throw new GithubNetworkError("GitHub token request failed.");
  }

  const parsed = (await response.json()) as { access_token?: unknown };
  if (typeof parsed.access_token !== "string" || parsed.access_token === "") {
    throw new GithubNetworkError("GitHub token response was invalid.");
  }

  return parsed.access_token;
}

function profileFromGithubUser(raw: unknown): GithubProfile {
  if (!isRecord(raw)) {
    throw new GithubNetworkError("GitHub profile response was invalid.");
  }

  const email = stringField(raw.email);
  return {
    avatarUrl: stringField(raw.avatar_url) ?? "",
    email: email ?? "",
    emailVerified: email !== undefined,
    githubId: githubIdFrom(raw.id),
    name: stringField(raw.name) ?? stringField(raw.login) ?? "GitHub User"
  };
}

function githubIdFrom(value: unknown): string {
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  throw new GithubNetworkError("GitHub profile response was invalid.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function githubUnavailable(reply: FastifyReply, flow: PendingOAuth["flow"]) {
  const action =
    flow === "login"
      ? "Retry login after GitHub is reachable."
      : "Retry signup after GitHub is reachable.";

  return reply
    .code(502)
    .send(
      problem(502, "GitHub is unavailable", {}, [
        { command: "vspec login", reason: action }
      ])
    );
}

export function readCookie(
  header: string | undefined,
  name: string
): string | undefined {
  return header
    ?.split(/[;,]/)
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

export function problem(
  status: number,
  title: string,
  extra: Record<string, unknown> = {},
  suggestedNextActions: SuggestedNextAction[] = []
) {
  return {
    type: "https://vspec.dev/errors/bad-request",
    title,
    status,
    ...extra,
    suggested_next_actions: suggestedNextActions
  };
}

export function usecaseShowRecoveryActions(): SuggestedNextAction[] {
  return [
    {
      command: "vspec usecase show <KEY>",
      reason: "Re-read the use case to get the current scenario and step ids."
    }
  ];
}

function workspaceFor(pending: PendingSignup, ownerId: string): StoredWorkspace {
  return {
    id: randomUUID(),
    name: pending.name,
    slug: pending.slug,
    owner_id: ownerId,
    plan: "FREE",
    archived_at: null
  };
}

function ownerMembership(userId: string, workspaceId: string): StoredMembership {
  return {
    id: randomUUID(),
    user_id: userId,
    workspace_id: workspaceId,
    role: "OWNER"
  };
}

export function cookie(name: string, value: string): string {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax`;
}

function expiredCookie(name: string): string {
  return `${name}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax`;
}
