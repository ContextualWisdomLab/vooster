import { z } from "zod";

const authWorkspaceInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1)
});

export const authStartRequestSchema = z.union([
  z.object({
    workspace: authWorkspaceInputSchema
  }),
  z.object({ flow: z.literal("login") })
]);

export const authStartResponseSchema = z.object({
  authorization_url: z.string(),
  state: z.string()
});

export const authCallbackQuerySchema = z.union([
  z.object({
    code: z.string().min(1),
    state: z.string().min(1)
  }),
  z.object({
    error: z.literal("access_denied"),
    state: z.string().min(1)
  })
]);

export const authDeviceTokenRequestSchema = z.object({
  access_token: z.string().min(1),
  workspace: authWorkspaceInputSchema.optional()
});

export const authSignupResponseSchema = z.object({
  membership: z.looseObject({
    role: z.string(),
    user_id: z.string(),
    workspace_id: z.string()
  }),
  recommended_next_command: z.string(),
  user: z.looseObject({
    email: z.string(),
    github_id: z.string(),
    id: z.string()
  }),
  workspace: z.looseObject({
    id: z.string(),
    name: z.string(),
    slug: z.string()
  })
});

export const authLoginResponseSchema = z.object({
  recommended_next_command: z.string().optional(),
  user: z.looseObject({
    github_id: z.string(),
    id: z.string()
  }),
  workspaces: z.array(
    z.looseObject({
      id: z.string(),
      role: z.string(),
      slug: z.string()
    })
  )
});

export type AuthStartRequest = z.infer<typeof authStartRequestSchema>;
export type AuthStartResponse = z.infer<typeof authStartResponseSchema>;
export type AuthCallbackQuery = z.infer<typeof authCallbackQuerySchema>;
export type AuthDeviceTokenRequest = z.infer<typeof authDeviceTokenRequestSchema>;
export type AuthSignupResponse = z.infer<typeof authSignupResponseSchema>;
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;
