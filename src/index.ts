import { createServer } from "./http/server.js";

const defaultPort = 3000;

async function main() {
  const app = await createServer({
    authStub: process.env.VSPEC_AUTH_STUB === "1"
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
