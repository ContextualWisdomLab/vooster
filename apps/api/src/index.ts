import { pathToFileURL } from "node:url";
import { createServer } from "./http/server.js";
import { createPrismaSignupStore } from "./infrastructure/prisma-signup-store.js";

const defaultPort = 8080;

type RuntimeEnv = Record<string, string | undefined>;

export type ApiRuntime = {
  createServer: typeof createServer;
  createSignupStore: typeof createPrismaSignupStore;
  env: RuntimeEnv;
  once: (signal: NodeJS.Signals, listener: () => void) => unknown;
};

export async function startApi(runtime: Partial<ApiRuntime> = {}) {
  const env = runtime.env ?? process.env;
  const authStub = env.VSPEC_AUTH_STUB === "1";
  const forceMemoryStore = env.VSPEC_FORCE_MEMORY_STORE === "1";
  const port = portFrom(env.PORT);
  const app = await (runtime.createServer ?? createServer)({
    authStub,
    githubOAuth: githubOAuthFromEnv(authStub, env),
    signupStore:
      forceMemoryStore || env.DATABASE_URL === undefined
        ? undefined
        : (runtime.createSignupStore ?? createPrismaSignupStore)(env.DATABASE_URL)
  });

  const shutdown = async () => {
    await app.close();
  };

  const once = runtime.once ?? process.once.bind(process);
  once("SIGINT", () => {
    void shutdown();
  });
  once("SIGTERM", () => {
    void shutdown();
  });

  await app.listen({
    host: "0.0.0.0",
    port
  });

  return app;
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

function githubOAuthFromEnv(authStub: boolean, env: RuntimeEnv) {
  if (authStub) {
    return undefined;
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (clientId === undefined || clientSecret === undefined) {
    return undefined;
  }

  return { clientId, clientSecret };
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  /* v8 ignore next 3 -- direct process launch is covered by boot gates. */
  startApi().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
