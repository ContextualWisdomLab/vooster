# vooster — vspec

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ContextualWisdomLab/vooster)

**사람 개발자와 병렬 AI 코딩 에이전트가 명시적이고 버전 관리되는 제품 동작을 중심으로 협업하도록 돕는 Cockburn 스타일 유스케이스 관리 도구입니다.**

`vspec`은 소프트웨어 명세를 정적인 문서가 아니라 협업 인프라로 다룹니다. 팀은 구조화된 유스케이스 모델, 불변 리비전, 명세 브랜치와 머지, 작업 세션 고정, 변경 영향 증거, CLI/API 흐름을 함께 사용할 수 있습니다.

> [English README](./README.md)

## 왜 필요한가

여러 사람과 코딩 에이전트가 동시에 작업하면 변경 중인 명세 자체가 숨은 경쟁 조건이 될 수 있습니다. 한 에이전트가 구현을 진행하는 동안 다른 작업이 전제를 바꾸면, 코드가 서로 다른 제품 정의를 기준으로 만들어질 수 있습니다.

`vspec`은 그 상태를 명시적으로 관리합니다.

- actor, stakeholder, goal, scenario, step, extension을 구조화된 도메인 개념으로 표현합니다.
- 에이전트 작업 세션을 불변 specification revision에 고정합니다.
- 명세 브랜치와 영향 기반 merge request를 제공합니다.
- 민감한 명세 영역에 semantic/hard locking을 적용할 수 있습니다.
- 저장소의 Markdown 명세와 동기화해 파일 중심 개발 흐름을 유지합니다.
- 사람과 자동화가 함께 소비할 수 있는 CLI/API 계약을 제공합니다.

전체 MVP 책임과 비목표는 [제품 개요](docs/00-overview.md)를 참고하세요.

## 현재 상태

이 ContextualWisdomLab 저장소는 **소스/개발 트리**이며 공개 npm 또는 GitHub Release의 존재를 의미하지 않습니다. 루트 workspace는 `private: true`, CLI package는 private `@vooster/cli@0.0.0`, 실행 명령 이름은 `vspec`입니다. 현재 이 저장소에는 GitHub Release가 없습니다.

따라서 평가와 개발에는 source checkout을 사용하세요. 명령 이름이 `vspec`이라는 이유만으로 공개 npm 패키지 `vspec`이 이 저장소에서 배포된다고 가정하면 안 됩니다.

## 소스에서 빠르게 시작하기

필요 조건은 Node.js 20+, Corepack, 루트 package metadata에 고정된 pnpm 11.0.5입니다. 로컬 PostgreSQL을 Compose로 실행하려면 Docker/Compose도 필요합니다.

```bash
corepack enable
pnpm install
pnpm -r build
```

저장소 CLI를 직접 실행합니다.

```bash
node apps/cli/bin/run.js --help
node apps/cli/bin/run.js ai-guide
```

빌드 출력이 있으면 launcher가 이를 사용하고, 그렇지 않으면 저장소의 `tsx` 의존성을 통해 TypeScript source CLI로 폴백합니다.

## 로컬 서비스 실행

```bash
cp .env.example .env
docker compose up -d db
pnpm run dev
```

`PORT`를 별도로 지정하지 않으면 기본 서비스는 `http://localhost:8080`에서 `GET /healthz`를 제공합니다.

운영과 비슷한 로컬 Compose profile은 다음과 같이 실행할 수 있습니다.

```bash
cp .env.example .env
VSPEC_AUTH_STUB=1 docker compose -f docker-compose.prod.yml up -d
```

`VSPEC_AUTH_STUB=1`은 개발/테스트용 우회 경로이며 운영 인증이 아닙니다. 실제 GitHub OAuth를 사용할 때는 필요한 client credential을 배포 환경에 설정하고 소스에 커밋하지 마세요.

`docker-compose.prod.yml`은 PostgreSQL 연결을 `DATABASE_URL`에서 읽습니다. 애플리케이션을 호스트에 공개하는 포트는 `VSPEC_DEPLOY_HOST_PORT`로 바꿀 수 있으며, 값을 지정하지 않으면 **4400**을 사용합니다. 예를 들어 `VSPEC_DEPLOY_HOST_PORT=8088`을 설정하면 호스트의 8088 포트로 노출됩니다. 데이터베이스와 호스트 포트 모두 배포 환경 값이며 README의 기본값을 운영용 비밀정보나 고정 인프라 권위로 간주하면 안 됩니다.

## 아키텍처와 통합 경계

저장소는 TypeScript/pnpm workspace이며 다음 경계를 갖습니다.

- Fastify API: 명세와 협업 workflow
- Prisma + PostgreSQL: 영속성
- oclif CLI: `vspec` 명령 표면
- shared workspace contracts: API/CLI 간 공통 계약
- repository-local Markdown: 명세와 동기화 흐름

`vspec`은 유스케이스/명세 lifecycle과 협업 semantics를 소유합니다. Git hosting, GitHub OAuth identity, CI 실행, coding-agent runtime, 명세를 소비하는 구현 저장소는 별도 시스템입니다. 명세 revision은 구현을 안내할 수 있지만 코드 실행이나 merge 권한이 되지는 않습니다.

## 검증

루트 package가 제공하는 저장소 검증 진입점은 다음과 같습니다.

```bash
pnpm run verify
```

세부 lint, typecheck, test, coverage, build 명령은 루트와 workspace `package.json`을 따르세요. PR의 통합 가능성은 동일 exact revision의 현재 GitHub Checks와 review/governance 상태를 기준으로 판단합니다.

## 문서

| 목적 | 문서 |
| --- | --- |
| 제품 목적·페르소나 | [Overview](docs/00-overview.md) |
| 아키텍처 | [Architecture](docs/01-architecture.md) |
| 기술 선택 | [Tech stack](docs/02-tech-stack.md) |
| HTTP 통합 | [API contract](docs/06-api-contract.md) |
| CLI 동작 | [CLI spec](docs/07-cli-spec.md) |
| 저장소 기반 agent workflow | [Build harness](docs/build-harness.md) |

도메인 또는 workflow 동작을 변경하기 전에 [제품 개요](docs/00-overview.md)와 [AGENTS.md](AGENTS.md)를 함께 확인하세요.

## 라이선스와 provenance

이 저장소는 기존 [MIT License](LICENSE)와 `Copyright (c) 2026 vibemafiaclub` 표기를 보존합니다. 루트 package metadata 역시 MIT를 선언하고 upstream `vibemafiaclub/vooster` repository/issues/homepage 정보를 유지합니다.

ContextualWisdomLab 저장소라고 해서 upstream 저작권을 교체하거나 upstream-derived source를 새로 독점 라이선스한 것으로 표현하지 않습니다. 제3자 npm package, container image, GitHub 서비스 등은 각각의 라이선스와 약관을 유지합니다.
