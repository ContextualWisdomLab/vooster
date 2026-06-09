import type { FastifyReply } from "fastify";
import { authLoginResponseSchema } from "@vooster/contracts";
import type { CompleteOAuthResult } from "../application/signup.js";
import type { PendingOAuth } from "./signup-types.js";
import { establishSession } from "./session-support.js";
import { githubUnavailable, problem, signupResponse } from "./signup-support.js";

export function sendDeniedOAuth(reply: FastifyReply, flow: PendingOAuth["flow"]) {
  if (flow === "login") {
    return reply
      .code(401)
      .send(
        problem(401, "GitHub authorization denied", {}, [
          { command: "vspec login", reason: "Retry login." }
        ])
      );
  }

  return reply
    .code(400)
    .send(
      problem(400, "GitHub authorization denied", {}, [
        { command: "vspec login", reason: "Retry signup." }
      ])
    );
}

export function sendGithubUnavailable(reply: FastifyReply, flow: PendingOAuth["flow"]) {
  return githubUnavailable(reply, flow);
}

export function sendCompleteOAuthResult(
  reply: FastifyReply,
  sessionsByToken: Map<string, string>,
  result: CompleteOAuthResult
) {
  switch (result.status) {
    case "LOGGED_IN":
      establishSession(reply, sessionsByToken, result.user.id);
      return reply.code(200).send(
        authLoginResponseSchema.parse({
          user: result.user,
          workspaces: result.workspaces,
          ...(result.recommendedNextCommand === undefined
            ? {}
            : { recommended_next_command: result.recommendedNextCommand })
        })
      );
    case "SIGNED_UP":
      establishSession(reply, sessionsByToken, result.user.id);
      return reply
        .code(201)
        .send(signupResponse(result.user, result.workspace, result.membership));
    case "UNVERIFIED_EMAIL":
      return reply
        .code(422)
        .send(
          problem(422, "Verify your GitHub email", {}, [
            { command: "vspec login", reason: "Retry signup." }
          ])
        );
    case "USER_NOT_FOUND":
      return reply
        .code(404)
        .send(
          problem(404, "No vspec user exists for GitHub identity", {}, [
            { command: "vspec login", reason: "Sign up before logging in." }
          ])
        );
    case "USER_ALREADY_EXISTS":
      return reply.code(409).send(
        problem(409, "GitHub identity already has a vspec account", {}, [
          {
            command: "vspec login",
            reason: "Re-run login without workspace flags."
          }
        ])
      );
    case "WORKSPACE_SLUG_TAKEN":
      return reply.code(422).send(
        problem(422, "Workspace slug is already taken", {
          suggested_alternative_slug: result.suggestedSlug
        })
      );
  }
}
