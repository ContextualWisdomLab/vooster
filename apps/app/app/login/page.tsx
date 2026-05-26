import Image from "next/image";

import { Button } from "@/components/ui/button";

const loginPath = "/v1/auth/github/start";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Image src="/logo-text.svg" alt="Vooster" width={157} height={32} priority />
        <div className="flex w-full flex-col gap-6 rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-1.5 px-6 pt-6">
            <h1 className="text-lg font-semibold leading-none tracking-tight text-foreground">
              Vooster 로그인
            </h1>
            <p className="text-sm text-muted-foreground">
              GitHub 계정으로 로그인하고 유스케이스 명세를 확인하세요.
            </p>
          </div>
          <div className="px-6 pb-6">
            <Button asChild size="lg" className="w-full">
              <a href={loginPath}>
                <GithubMark />
                GitHub으로 계속하기
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function GithubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.02 3.24 9.27 7.74 10.77.57.11.78-.25.78-.55 0-.27-.01-.99-.02-1.94-3.14.68-3.81-1.51-3.81-1.51-.51-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.66 1.23 3.31.94.1-.73.4-1.23.72-1.51-2.51-.29-5.15-1.26-5.15-5.6 0-1.24.44-2.25 1.16-3.04-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.12 1.16.9-.25 1.87-.38 2.83-.38.96 0 1.93.13 2.83.38 2.16-1.46 3.11-1.16 3.11-1.16.62 1.56.23 2.71.11 3 .72.79 1.16 1.8 1.16 3.04 0 4.35-2.65 5.3-5.17 5.59.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.66.79.55 4.5-1.5 7.74-5.75 7.74-10.77C23.33 5.56 18.27.5 12 .5Z"
      />
    </svg>
  );
}
