# vspec

vspec는 사람과 AI 기여자가 함께 명시적이고 버전 관리되는 제품 동작을 중심으로
협업할 수 있도록 돕는 Cockburn 스타일의 유스케이스 관리 도구입니다.
Fastify API, Prisma 영속 계층, 그리고 유스케이스 명세를 작성·리뷰·내보내기
위한 oclif 기반 CLI를 함께 제공합니다.

> [English README](./README.md)

## vspec이 풀고자 하는 문제

최신 AI 보조 개발 환경에서는 흔히 **6개 이상의 동시 AI 코딩 에이전트
세션**이 같은 시스템의 서로 다른 부분을 편집합니다. Notion·Confluence·Linear
같은 기존 명세 도구는 사람 속도, 사람만의 협업을 전제로 설계되어 있어
이러한 부하에서 무너집니다.

- "고정된" 스냅샷 개념이 없어 에이전트가 작업 중간에 컨텍스트가 바뀝니다.
- 의미론적 변경 추적이 없어 단계 이름이 바뀌면 그 위에서 동작하던 Gherkin
  테스트가 조용히 깨집니다.
- 충돌하는 편집이 경고 없이 허용되며, 조율은 사람의 몫으로 남습니다.

vspec은 사용자 환경을 **분산된 다중 에이전트 시스템**으로 간주하고, 이를
데이터 모델과 워크플로우에서 최우선 관심사로 다룹니다.

## 핵심 차별점

1. **Cockburn 충실성** — 이해관계자, 관심사, 레벨, 확장이 자유 텍스트가 아니라
   1급 엔티티로 모델링됩니다.
2. **세션별 스냅샷 고정** — 각 에이전트는 불변 리비전을 기준으로 작업하므로
   다른 곳의 편집이 진행 중인 작업을 깨뜨릴 수 없습니다.
3. **명세 브랜치와 영향 인식 머지** — 기본적으로 브랜치 격리, 충돌은 머지
   시점에만 드러나며 COSMETIC / NON_BREAKING / BREAKING 으로 분류됩니다.
4. **3단계 락** — SOFT(정보), SEMANTIC(의미 변경 차단), HARD(모든 변경 차단).
5. **스스로 가르치는 CLI** — 모든 오류 메시지에 다음 추천 명령이 포함되며,
   `--format=agent` 는 JSON과 `suggested_next_actions` 를 함께 출력하고,
   `vspec ai-guide` 명령을 제공합니다.
6. **파일 우선 워크플로우** — 명세는 저장소 안의 마크다운(`specs/*.md`)으로
   존재하며 서버와 양방향 동기화되므로, AI 코딩 에이전트가 기존 파일시스템
   도구만으로도 읽고 쓸 수 있습니다.

## 설치

npm에서 CLI를 바로 실행:

```bash
npx vspec --help
```

자주 사용한다면 전역 설치:

```bash
npm install -g vspec
vspec --help
```

새로 클론한 저장소에서 개발 환경 구성:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm -r build
```

## 실행

선택 사항인 로컬 Postgres 서비스를 띄운 뒤 개발 서버를 실행합니다.

```bash
cp .env.example .env
docker compose up -d db
pnpm run dev
```

Docker 없이 로컬 실행하려면 `.env.example`의 SQLite `DATABASE_URL`을 그대로
두고 다음을 사용합니다.

```bash
pnpm start
```

`PORT`를 별도로 지정하지 않으면 서버는 `http://localhost:3000`에서
`GET /healthz`를 노출합니다.

## 배포

운영에 가까운 Docker 스택을 빌드하고 실행합니다.

```bash
cp .env.example .env
VSPEC_AUTH_STUB=1 docker compose -f docker-compose.prod.yml up -d
```

실제 GitHub OAuth를 사용하려면 스택을 띄우기 전에 `GITHUB_CLIENT_ID` 와
`GITHUB_CLIENT_SECRET` 를 환경변수로 설정하세요. compose 파일은 `DATABASE_URL`
을 통해 Postgres 를 제공하고 `${VSPEC_DEPLOY_HOST_PORT:-4400}` 포트로 앱을
공개합니다.

## 주요 페르소나

| 페르소나               | 역할                                                  |
| ---------------------- | ----------------------------------------------------- |
| 사람 개발자/PM         | 명세를 작성·리뷰하고 에이전트를 감독합니다.           |
| AI 코딩 에이전트       | 고정된 명세를 기준으로 코드와 테스트를 구현합니다.    |
| 워크스페이스 관리자    | 멤버, API 키, 빌링을 관리합니다.                      |
| CI/CD 시스템           | Gherkin 동기화와 명세 드리프트 감지를 수행합니다.     |

## 문서

- [개요 (Overview)](docs/00-overview.md)
- [아키텍처 (Architecture)](docs/01-architecture.md)
- [기술 스택 (Tech stack)](docs/02-tech-stack.md)
- [API 계약 (API contract)](docs/06-api-contract.md)
- [CLI 사양 (CLI spec)](docs/07-cli-spec.md)
- [자율 빌드 하니스 (Autonomous build harness)](docs/build-harness.md)
