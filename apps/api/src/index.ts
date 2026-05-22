import { createServer } from "./http/server.js";
import { createPrismaSignupStore } from "./infrastructure/prisma-signup-store.js";

const defaultPort = 8080;

async function main() {
  const app = await createServer({
    authStub: process.env.VSPEC_AUTH_STUB === "1",
    githubOAuth: githubOAuthFromEnv(process.env.VSPEC_AUTH_STUB === "1"),
    signupStore:
      process.env.DATABASE_URL === undefined
        ? undefined
        : createPrismaSignupStore(process.env.DATABASE_URL)
  });

  const shutdown = async () => {
    await app.close();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  await app.listen({
    host: "0.0.0.0",
    port: portFrom(process.env.PORT)
  });
}

function portFrom(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.trim() === "") {
    return defaultPort;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${rawPort}`);
  }

  return port;
}

function githubOAuthFromEnv(authStub: boolean) {
  if (authStub) {
    return undefined;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (clientId === undefined || clientSecret === undefined) {
    return undefined;
  }

  return { clientId, clientSecret };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
