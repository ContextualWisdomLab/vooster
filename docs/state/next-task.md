# Next Task

_Auto-generated 2026-05-19T21:01:47Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Implement real GitHub OAuth (gate 2.B1).

  1. RED: write tests/e2e/UC-001-real-oauth.test.ts. The test must:
       - boot createServer({ authStub: false }) with GITHUB_CLIENT_ID +
         GITHUB_CLIENT_SECRET set to fixture values
       - install an undici MockAgent that intercepts
           POST https://github.com/login/oauth/access_token
           GET  https://api.github.com/user
       - drive the full /v1/auth/github/start → /callback flow
       - assert the workspace is created and a session cookie is set
     Commit: red(auth): real GitHub OAuth flow

  2. GREEN: in src/http/signup-routes.ts (or extracted application module),
     branch on options.authStub. When false, perform the token exchange and
     user-profile fetch using fetch() / undici. Read GITHUB_CLIENT_ID and
     GITHUB_CLIENT_SECRET from process.env at server-boot time and pass
     them as ServerOptions.
     Commit: green(auth): exchange code for token without stub
```
