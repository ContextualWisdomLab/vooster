import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { GithubProfile, PendingSignup, ServerOptions } from "./signup-types.js";

export class GithubNetworkError extends Error {}

export function clearOAuthState(reply: FastifyReply) {
  reply.header("set-cookie", expiredCookie("vspec_oauth_state"));
}

export function establishSession(reply: FastifyReply) {
  reply.header("set-cookie", [
    cookie("vspec_session", randomUUID()),
    expiredCookie("vspec_oauth_state")
  ]);
}

export function signupResponse(profile: GithubProfile, pending: PendingSignup) {
  const user = {
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
    membership: ownerMembership(user.id, workspace.id),
    recommended_next_command: "vspec project create"
  };
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

export function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

export function alternativeSlug(slug: string, existingSlugs: Set<string>): string {
  let suffix = 2;
  let candidate = `${slug}-${String(suffix)}`;

  while (existingSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${slug}-${String(suffix)}`;
  }

  return candidate;
}

export function problem(
  status: number,
  title: string,
  extra: Record<string, string> = {},
  suggestedNextActions = [{ command: "vspec login", reason: "Restart signup." }]
) {
  return {
    type: "https://vspec.dev/errors/bad-request",
    title,
    status,
    ...extra,
    suggested_next_actions: suggestedNextActions
  };
}

function workspaceFor(pending: PendingSignup, ownerId: string) {
  return {
    id: randomUUID(),
    name: pending.name,
    slug: pending.slug,
    owner_id: ownerId,
    plan: "FREE"
  };
}

function ownerMembership(userId: string, workspaceId: string) {
  return {
    id: randomUUID(),
    user_id: userId,
    workspace_id: workspaceId,
    role: "OWNER"
  };
}

function cookie(name: string, value: string): string {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax`;
}

function expiredCookie(name: string): string {
  return `${name}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax`;
}
