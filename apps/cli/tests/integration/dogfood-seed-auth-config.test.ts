import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

describe("dogfood seed auth", () => {
  it("writes the seeded workspace into the isolated global config", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vspec-dogfood-seed-"));
    const repo = path.join(tmp, "repo");
    const bin = path.join(tmp, "bin");
    const configPath = path.join(repo, ".vspec", "global-config.json");

    try {
      await mkdir(repo, { recursive: true });
      await createCurlStub(bin);

      await execFileAsync("bash", ["scripts/dogfood/dogfood-seed-auth.sh"], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          VSPEC_DOGFOOD_API_URL: "http://127.0.0.1:8799",
          VSPEC_DOGFOOD_AUTH_STUB_ID: "dogfood-test",
          VSPEC_DOGFOOD_GLOBAL_CONFIG: configPath,
          VSPEC_DOGFOOD_REPO: repo
        },
        maxBuffer: 1024 * 1024
      });

      const config: unknown = JSON.parse(await readFile(configPath, "utf8"));
      expect(config).toMatchObject({
        api_url: "http://127.0.0.1:8799",
        current_workspace_id: "workspace-id",
        current_workspace_slug: "dogfood-dogfood-test",
        session_token: "session-token"
      });
    } finally {
      await rm(tmp, { force: true, recursive: true });
    }
  });
});

async function createCurlStub(bin: string): Promise<void> {
  await mkdir(bin, { recursive: true });
  await writeFile(
    path.join(bin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
header=""
output=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -D) header="$2"; shift 2 ;;
    -o) output="$2"; shift 2 ;;
    -X|-H|-d) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
case "$url" in
  */v1/auth/github/start)
    printf 'set-cookie: vspec_oauth_state=oauth-state; Path=/\\n' > "$header"
    printf '{"state":"oauth-state"}\\n' > "$output"
    ;;
  */v1/auth/github/callback*)
    printf 'set-cookie: vspec_session=session-token; Path=/\\n' > "$header"
    printf '{"workspace":{"id":"workspace-id","slug":"dogfood-dogfood-test"}}\\n' > "$output"
    ;;
  *)
    echo "unexpected curl url: $url" >&2
    exit 1
    ;;
esac
`,
    { mode: 0o755 }
  );
}
