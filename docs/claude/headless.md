# `claude -p` Headless 모드 사용법

> **목적**: codex가 Claude Code에 코드 리뷰/피드백을 요청할 때, 이 문서를
> 인용하여 정확한 명령어를 구성한다. 모든 플래그는 `claude --help` (Claude
> Code v2.x) 출력을 기준으로 검증되었다.
>
> **작업(빌드) 위임은 별도 문서**: codex가 presentation goal을 Claude에
> headless로 _짓게_ 하는 경우(리뷰가 아니라 construction)는
> `docs/claude/delegation.md`의 계약을 따른다. 이 문서는 그 위임 호출이
> 쓰는 플래그의 레퍼런스다.

## 핵심 개념

`claude -p "<프롬프트>"` 는 Claude Code를 **non-interactive 모드**로 실행한다.

- 대화형 TUI를 띄우지 않고, 단발성 응답을 stdout으로 출력한 뒤 종료한다.
- workspace trust 다이얼로그가 자동으로 스킵된다 → **신뢰하는 디렉터리에서만 실행**.
- 설정 파일이 검증에 실패해도 조용히 무시된다(에러 다이얼로그 없음).
- stdout이 TTY가 아니면(파이프/리다이렉트) `-p` 없이도 non-interactive로 동작한다.

`-p` 는 `--print` 의 단축이며 둘 다 동일하다.

## 1. 기본 호출

### 1.1 인자로 프롬프트 전달

```bash
claude -p "이 함수의 책임을 한 줄로 요약해줘"
```

### 1.2 stdin으로 입력 전달

stdin은 프롬프트의 **추가 컨텍스트**로 합쳐진다. `-p "..."` 인자에 지시문을,
stdin에 데이터(diff, 로그, 코드)를 넣는 패턴이 표준이다.

```bash
git diff origin/main | claude -p "이 diff를 보안 관점에서 리뷰해줘"
```

```bash
cat src/auth/login.ts | claude -p "이 파일의 잠재적 버그를 나열해줘"
```

**stdin 크기 제한**: 약 10MB. 그보다 크면 파일 경로를 프롬프트에 적어 Claude가
직접 Read 툴로 읽게 한다.

```bash
claude -p "/var/log/build.log 의 마지막 500줄을 분석해서 실패 원인을 찾아줘"
```

## 2. 출력 포맷 (`--output-format`)

`-p` 모드 한정으로 세 가지 포맷을 지원한다.

| 값              | 용도                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| `text` (기본값) | 사람이 읽는 평문. 파일/콘솔로 바로 보낼 때.                                           |
| `json`          | 결과+메타데이터(세션 ID, 비용, 토큰 사용량 등) 단일 객체. **자동화 기본값으로 권장**. |
| `stream-json`   | 진행 중 이벤트를 줄 단위 JSON으로 스트리밍. 긴 작업 모니터링용.                       |

### 2.1 JSON 포맷 예시

```bash
claude -p "이 PR의 위험도를 평가해줘" --output-format json
```

응답 객체의 주요 필드:

- `result` — 최종 답변 텍스트
- `session_id` — 후속 `--resume`에 사용할 세션 UUID
- `total_cost_usd` — 호출 총 비용
- `usage.input_tokens` / `output_tokens` / `cache_*_tokens`
- `is_error` — 에러 여부 (exit code가 0이어도 이게 true면 실패)
- `num_turns` — 사용된 턴 수
- `duration_ms` — 총 소요 시간

```bash
result=$(claude -p "리뷰해줘" --output-format json)
echo "$result" | jq -r '.result'
echo "$result" | jq -r '.session_id'
echo "$result" | jq -r '.total_cost_usd'
```

### 2.2 stream-json 포맷

```bash
claude -p "긴 작업" --output-format stream-json --verbose
```

- 한 줄당 하나의 JSON 이벤트
- `--include-partial-messages` 를 추가하면 토큰 단위 델타까지 스트리밍
- `--include-hook-events` 로 hook lifecycle 이벤트 포함 가능

## 3. 구조화된 출력 (`--json-schema`)

응답 본문을 강제로 JSON Schema에 맞추고 싶을 때.

```bash
claude -p "이 diff의 이슈를 분류해줘" \
  --output-format json \
  --json-schema '{
    "type": "object",
    "properties": {
      "issues": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "severity": { "type": "string", "enum": ["critical","high","medium","low"] },
            "file":     { "type": "string" },
            "line":     { "type": "integer" },
            "message":  { "type": "string" }
          },
          "required": ["severity","message"]
        }
      },
      "summary": { "type": "string" }
    },
    "required": ["issues","summary"]
  }'
```

`codex`가 후속 처리를 위해 결정론적 구조가 필요할 때 항상 이 플래그를 사용한다.

## 4. 입력 포맷 (`--input-format`)

| 값            | 의미                                                       |
| ------------- | ---------------------------------------------------------- |
| `text` (기본) | stdin은 일반 텍스트                                        |
| `stream-json` | stdin이 줄 단위 JSON 메시지 스트림. 다중 턴 실시간 입력용. |

대부분의 경우 기본값을 쓴다. agent-to-agent 실시간 대화에서만 `stream-json`을 고려.

## 5. 모델 선택 (`--model`)

```bash
claude -p "..." --model sonnet
claude -p "..." --model opus
claude -p "..." --model haiku
claude -p "..." --model claude-opus-4-7
```

- **opus**: 가장 강력. 복잡한 리팩토링/아키텍처 판단/심화 리뷰.
- **sonnet**: 균형형 기본값. 일반 코드 리뷰에 적합.
- **haiku**: 빠르고 저렴. 분류·요약·간단한 lint성 작업.

오버로드 대비 fallback:

```bash
claude -p "..." --model opus --fallback-model sonnet
```

(`--fallback-model`은 `--print` 모드에서만 동작)

## 6. 도구 허용/차단

### 6.1 `--allowedTools` (= `--allowed-tools`)

Headless 모드에서 도구 호출이 권한 프롬프트에 막히면 **무한 대기**한다. 따라서
필요한 도구를 미리 허용해야 한다.

```bash
claude -p "..." --allowedTools "Read,Edit,Bash(git diff *)"
```

- 콤마 또는 공백으로 구분
- `Bash(pattern *)` 형태로 prefix 매칭 (`*` 앞 공백 주의)
- 예: `Bash(git log *)`, `Bash(pnpm test *)`

### 6.2 `--disallowedTools`

```bash
claude -p "..." --disallowedTools "WebFetch,WebSearch"
```

### 6.3 `--tools` (built-in 도구 셋 제한)

```bash
claude -p "..." --tools "Bash,Edit,Read"     # 명시한 것만 사용
claude -p "..." --tools ""                   # 모든 도구 비활성화
claude -p "..." --tools "default"            # 전체 활성화
```

리뷰 목적이라면 보통 `--tools "Read,Grep,Glob"` 정도로 읽기 전용만 켠다.

## 7. 권한 모드 (`--permission-mode`)

| 값                  | 동작                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `default`           | 읽기는 자동 허용, 쓰기/실행은 규칙에 따름. headless에서 규칙 부족 시 멈춤. |
| `acceptEdits`       | 파일 편집·생성류를 자동 승인. 자동 수정 작업에 적합.                       |
| `plan`              | 읽기만 허용, 변경은 하지 않고 계획만 출력.                                 |
| `auto`              | 자동 분류기에 따라 모드 결정.                                              |
| `dontAsk`           | `permissions.allow` 에 명시된 것만 허용, 나머지는 거부. CI 락다운.         |
| `bypassPermissions` | 모든 권한 체크 우회. **격리 환경 전용**.                                   |

리뷰(읽기 전용) 호출 권장 조합:

```bash
claude -p "..." --permission-mode plan --tools "Read,Grep,Glob"
```

자동 수정 호출 권장 조합:

```bash
claude -p "..." --permission-mode acceptEdits --allowedTools "Read,Edit,Bash(git diff *)"
```

### 7.1 위임(construction) 루프의 권장 조합 — cwd 가 경계

`bypassPermissions` / `--dangerously-skip-permissions` 는 위 표에서 "격리
환경 전용" 으로 적었지만, 그건 _권한이 유일한 경계일 때_ 의 보수적 규칙이다.
codex → Claude **작업 위임 루프**(`docs/claude/delegation.md`)에서는 다른
보완 통제를 쓴다: **cwd 를 goal 이 선언한 앱 디렉토리로 고정**한다.

```bash
cd apps/web && claude --dangerously-skip-permissions \
  --model opus --output-format json --max-budget-usd 2.00 \
  --append-system-prompt "이 디렉토리 밖은 손대지 말 것" \
  -p "<goal.md + 현재 step>"
```

- skip-permissions 는 권한 _프롬프트_ 만 없앤다(헝 방지) — _blast radius_ 는
  cwd 가 정한다. repo 루트에서 절대 돌리지 말고, api/domain 을 `--add-dir`
  로 열지 마라.
- `--bare` 는 **쓰지 않는다** — cwd 의 `CLAUDE.md`/`DESIGN.md` 가 자동
  로드되어야 무상태 재호출 간 디자인 계약이 유지된다(§12 참조).
- 비용·정체 상한은 위임 오케스트레이터(`scripts/delegate-to-claude.sh`)가
  결정론적으로 강제한다.

## 8. 시스템 프롬프트

### 8.1 `--append-system-prompt` (권장)

기본 시스템 프롬프트를 유지한 채 지시문을 **추가**한다. Claude Code의 도구
사용 지침/안전 규칙이 보존된다.

```bash
claude -p "이 diff를 리뷰해줘" \
  --append-system-prompt "당신은 보안 전문가다. OWASP Top 10 위주로 보고, JSON으로 답해."
```

### 8.2 `--system-prompt` (전체 교체)

Claude Code 정체성 자체를 다른 에이전트로 교체할 때만 사용. 일반 리뷰에는
부적합(도구 사용법 지침이 사라진다).

## 9. 작업 디렉터리 / 추가 디렉터리 접근

기본적으로 Claude는 **현재 작업 디렉터리(cwd)** 의 파일만 읽고 쓴다.

```bash
cd /repo/apps/api
claude -p "src/ 를 리뷰해줘"
```

cwd 외의 디렉터리에 접근시켜야 하면 `--add-dir`:

```bash
claude -p "공유 모듈도 같이 봐줘" --add-dir ../../packages/shared ../../packages/types
```

## 10. 세션 재개 (multi-turn)

### 10.1 가장 최근 세션 이어가기

```bash
claude -p "1차 리뷰해줘" --output-format json
claude -p "방금 지적한 이슈 중 보안 항목만 더 깊게 봐줘" --continue --output-format json
```

### 10.2 세션 ID로 재개

```bash
sid=$(claude -p "초기 분석" --output-format json | jq -r '.session_id')
# ... 시간 경과 후 ...
claude -p "분석 결과를 한국어 보고서로 변환해줘" --resume "$sid" --output-format json
```

### 10.3 분기 (fork)

```bash
claude -p "다른 접근으로 다시 시도" --resume "$sid" --fork-session --output-format json
```

원본 세션은 유지되고 새 세션 ID가 발급된다.

### 10.4 세션 저장 비활성화

```bash
claude -p "..." --no-session-persistence
```

일회성 호출(리뷰 결과만 받고 버릴 때) 사용. `~/.claude/projects/` 에 흔적이 남지 않는다.

### 10.5 세션 ID 지정

```bash
claude -p "..." --session-id "$(uuidgen)"
```

외부 시스템이 세션 ID를 미리 정해놓고 추적하고 싶을 때.

## 11. 비용/예산 제한 (`--max-budget-usd`)

```bash
claude -p "..." --max-budget-usd 2.00
```

총 비용이 한도를 초과하면 중단된다. `--print` 모드 전용.

## 12. `--bare` 모드 (CI/자동화 권장)

```bash
claude --bare -p "..."
```

다음을 모두 **비활성화**한다:

- hooks (SessionStart 등)
- LSP, plugin sync
- attribution
- auto-memory 로딩 (CLAUDE.md 자동 탐색 포함)
- background prefetch
- keychain 읽기

인증은 오로지 `ANTHROPIC_API_KEY` 또는 `--settings` 의 `apiKeyHelper` 만 사용
(OAuth/keychain은 절대 안 읽음). 3P 프로바이더(Bedrock/Vertex/Foundry)는 각자
자격증명을 사용.

`--bare` 사용 시에도 다음은 명시적으로 전달 가능:
`--system-prompt[-file]`, `--append-system-prompt`, `--add-dir`,
`--mcp-config`, `--settings`, `--agents`, `--plugin-dir`.

> codex가 호출하는 모든 자동화 시나리오에서는 `--bare` 를 기본 사용해 로컬
> 설정 오염을 차단한다.

## 13. MCP 서버

### 13.1 명시적 로드

```bash
claude -p "..." --mcp-config ./ci-mcp.json
```

### 13.2 명시한 것만 사용 (`--strict-mcp-config`)

```bash
claude -p "..." --mcp-config ./ci-mcp.json --strict-mcp-config
```

`.mcp.json`, 사용자 전역 설정 등 다른 MCP 출처를 전부 무시한다.

## 14. 인증

### 14.1 API 키 (자동화 표준)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
claude --bare -p "..."
```

### 14.2 구독 OAuth

`claude auth login` 으로 로그인된 상태라면 `-p` 호출이 OAuth 토큰을 사용한다.
다만 자동화 환경에서는 토큰 만료/머신 바인딩 이슈를 피하기 위해 API 키를 권장.

### 14.3 장수명 토큰

```bash
claude setup-token
```

구독 사용자가 CI용 장수명 토큰을 만들 때.

## 15. 종료 코드와 에러 시맨틱

- **0**: 정상 종료. `--output-format json` 응답의 `is_error` 가 `false` 인지 반드시 확인.
- **0이 아닌 값**: 인증 실패, stdin 크기 초과, MCP 시작 실패, 잘못된 인자 등.

CI 패턴:

```bash
out=$(claude --bare -p "리뷰" --output-format json) || { echo "claude failed"; exit 1; }
if [ "$(echo "$out" | jq -r '.is_error')" = "true" ]; then
  echo "$out" | jq -r '.result'
  exit 2
fi
echo "$out" | jq -r '.result'
```

## 16. 자주 막히는 함정

1. **권한 프롬프트로 헝(hang)**: headless에서 도구 호출이 권한 승인을 기다리며
   멈춘다. `--allowedTools` 또는 `--permission-mode acceptEdits/plan/dontAsk` 로
   사전 승인하라.
2. **stdin 무시**: 파이프 입력이 무시되는 것처럼 보이면, `-p "..."` 인자에
   stdin을 어떻게 활용할지(예: "위에 붙인 diff를 리뷰") 명시했는지 확인.
3. **stream-json 버퍼링**: 파이프로 받을 때 라인 단위 flush를 보장하려면
   `stdbuf -oL claude -p ... --output-format stream-json | jq ...` 또는 Python의
   `-u` 옵션 등으로 언버퍼링.
4. **로컬 설정 오염**: 사용자 머신에서는 동작하는데 CI에서 다르게 동작한다면
   `--bare` 를 빼먹었을 가능성이 높다.
5. **세션 영구 저장**: `~/.claude/projects/` 에 모든 헤드리스 호출이 기록된다.
   민감 정보가 흐른다면 `--no-session-persistence` 사용.
6. **JSON Schema 미준수**: `--json-schema` 만으로 100% 강제되지 않는 경우가
   있으니, codex 측에서도 schema 재검증 후 실패 시 한 번 더 시도하는 로직을 둔다.
7. **워크스페이스 신뢰**: `-p` 는 trust 다이얼로그를 스킵한다. 검증되지 않은
   디렉터리(예: PR 체크아웃 직후)에서 실행할 때는 `--strict-mcp-config` + `--bare`
   조합으로 위험한 자동 동작을 차단한다.

## 17. codex → Claude Code 리뷰 요청 표준 레시피

### 17.1 가장 단순한 리뷰 (텍스트 출력)

```bash
git diff origin/main...HEAD | claude --bare -p "이 diff를 한국어로 리뷰해줘. 버그·보안·테스트 누락 위주."
```

### 17.2 구조화된 JSON 피드백 (codex 후속 처리용)

```bash
git diff origin/main...HEAD | claude --bare \
  -p "이 diff를 리뷰해서 schema에 맞춰 JSON으로 답해줘." \
  --output-format json \
  --tools "Read,Grep,Glob" \
  --permission-mode plan \
  --append-system-prompt "한국어로, 근거 라인 번호를 포함해라." \
  --json-schema '{
    "type":"object",
    "properties":{
      "verdict":   {"type":"string","enum":["approve","request_changes","comment"]},
      "issues":    {"type":"array","items":{
        "type":"object",
        "properties":{
          "severity":{"type":"string","enum":["critical","high","medium","low"]},
          "file":{"type":"string"},
          "line":{"type":"integer"},
          "message":{"type":"string"},
          "suggestion":{"type":"string"}
        },
        "required":["severity","file","message"]
      }},
      "summary":   {"type":"string"}
    },
    "required":["verdict","issues","summary"]
  }' \
  --max-budget-usd 1.00
```

`result` 필드에 schema에 맞춘 JSON 문자열이 들어온다. codex는 이를 파싱하여
`verdict == "request_changes"` 이면 작업을 재개하는 식으로 분기한다.

### 17.3 특정 파일 집합만 리뷰

```bash
claude --bare \
  -p "다음 파일들만 리뷰해줘: apps/api/src/http/routes/use-cases.ts, apps/api/src/application/use-cases/save.ts. 각 파일의 문제를 분리해서 보고해줘." \
  --tools "Read,Grep,Glob" \
  --permission-mode plan \
  --output-format json
```

### 17.4 후속 질문 (멀티 턴)

```bash
sid=$(git diff origin/main...HEAD | claude --bare -p "1차 리뷰" --output-format json | jq -r '.session_id')

claude --bare -p "지적한 이슈 중 critical만 추려서 패치 diff까지 제안해줘." \
  --resume "$sid" \
  --output-format json
```

## 18. 빠른 참조 — 자주 쓰는 플래그 요약

| 플래그                                            | 용도                           |
| ------------------------------------------------- | ------------------------------ |
| `-p, --print`                                     | headless 모드 진입             |
| `--bare`                                          | 로컬 설정/캐시 비활성, CI 표준 |
| `--output-format json\|stream-json\|text`         | 출력 포맷                      |
| `--json-schema '<schema>'`                        | 구조화된 출력 강제             |
| `--model sonnet\|opus\|haiku`                     | 모델 선택                      |
| `--fallback-model <name>`                         | 오버로드 시 대체 모델          |
| `--allowedTools "Read,Edit,Bash(git *)"`          | 도구 사전 승인                 |
| `--disallowedTools "WebFetch"`                    | 도구 차단                      |
| `--tools "Read,Grep,Glob"`                        | 사용 가능한 도구 집합 제한     |
| `--permission-mode plan\|acceptEdits\|dontAsk`    | 권한 베이스라인                |
| `--system-prompt` / `--append-system-prompt`      | 시스템 지시 교체/추가          |
| `--add-dir <dirs...>`                             | cwd 외 접근 허용               |
| `--mcp-config <file>` (+ `--strict-mcp-config`)   | MCP 서버                       |
| `--continue` / `--resume <id>` / `--fork-session` | 세션 재개·분기                 |
| `--no-session-persistence`                        | 세션 디스크 저장 끄기          |
| `--session-id <uuid>`                             | 세션 ID 강제                   |
| `--max-budget-usd <amount>`                       | 비용 상한                      |
| `--include-partial-messages`                      | stream-json 토큰 델타          |
| `--include-hook-events`                           | stream-json hook 이벤트        |
| `--verbose`                                       | 상세 출력                      |
| `--dangerously-skip-permissions`                  | 권한 우회 (격리 환경 한정)     |

## 출처

- `claude --help` (Claude Code v2.x, 본 저장소 호스트 기준 검증)
- 공식 문서: https://docs.claude.com/en/docs/claude-code/headless
- 공식 문서: https://docs.claude.com/en/docs/claude-code/cli-reference
