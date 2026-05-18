import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import { readCookie } from "./signup-support.js";

export function establishSession(
  reply: FastifyReply,
  sessionsByToken: Map<string, string>,
  userId: string
) {
  const token = randomUUID();
  sessionsByToken.set(token, userId);
  reply.header("set-cookie", [
    sessionCookie(token),
    expiredCookie("vspec_oauth_state")
  ]);
}

export function authenticatedUserId(
  cookieHeader: string | undefined,
  sessionsByToken: Map<string, string>
): string | undefined {
  const token = readCookie(cookieHeader, "vspec_session");
  return token === undefined ? undefined : sessionsByToken.get(token);
}

function sessionCookie(token: string): string {
  return `vspec_session=${token}; HttpOnly; Path=/; SameSite=Lax`;
}

function expiredCookie(name: string): string {
  return `${name}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax`;
}
