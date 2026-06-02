import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("landing spec drift copy", () => {
  it("defines drift as deterministic link and test failure, not semantic mismatch", () => {
    const howItWorks = readFileSync(
      "apps/www/src/components/sections/HowItWorks.astro",
      "utf8"
    );
    const onboarding = readFileSync(
      "apps/www/src/components/sections/Onboarding.astro",
      "utf8"
    );

    expect(howItWorks).toContain("링크가 깨졌거나 테스트가 실패하거나 연결 없는 step");
    expect(howItWorks).toContain("traceability drift detected");
    expect(howItWorks).toContain("step 3 link missing");
    expect(howItWorks).not.toContain("spec과 코드의 일치를 CI에서 자동 검증");
    expect(howItWorks).not.toContain("spec drift detected");
    expect(onboarding).toContain("코드/테스트 링크 검증");
    expect(onboarding).toContain("links/tests pass");
  });
});
