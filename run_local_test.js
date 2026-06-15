const { execSync } = require('child_process');
try {
  execSync('export NODE_OPTIONS="--max-old-space-size=4096" && cd /app && pnpm --filter @vooster/api run test -- apps/api/tests/integration/persistence-matrix-identity.test.ts', { stdio: 'inherit' });
} catch (e) {
  console.log("Test failed");
}
