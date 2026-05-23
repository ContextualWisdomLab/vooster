---
version: 0.1
name: Vooster-Atelier-design
description: >-
  Vooster의 한국어 랜딩(`apps/www`)을 위한 디자인 시스템.
  conductor.build의 다크-퍼스트 개발자 도구 미감을 골격으로,
  vooster의 "작업실(atelier)" 톤(따뜻한 오프-블랙 + 단일 에메랄드 액센트 + 헤어라인 카드)을
  더한 단일 표면 디자인 언어. AI 코딩 에이전트가 읽어서
  UI를 일관되게 재생산할 수 있도록 토큰 + 규칙 형태로 정리한다.

colors:
  primary: "#2dd4bf"
  primary-soft: "#5eead4"
  primary-deep: "#0f766e"
  on-primary: "#0c100e"
  ink-strong: "#fffaf1"
  ink: "#eee6d6"
  body: "#b8c2bc"
  mute: "#6f7d76"
  hairline: "#28302c"
  hairline-soft: "#1c2421"
  canvas: "#0c100e"
  canvas-soft: "#13181a"
  canvas-raised: "#161c1d"
  code-bg: "#13181a"
  code-ink: "#e6f1ec"
  signal-success: "#22c55e"
  signal-warn: "#facc15"
  signal-error: "#f87171"

typography:
  display-xl:
    fontFamily: "Inter, Pretendard, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(56px, 9vw, 96px)"
    fontWeight: 400
    lineHeight: "1.02"
    letterSpacing: "-0.025em"
  display-lg:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "clamp(36px, 5vw, 56px)"
    fontWeight: 400
    lineHeight: "1.06"
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 40px)"
    fontWeight: 500
    lineHeight: "1.12"
    letterSpacing: "-0.015em"
  display-sm:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "1.2"
    letterSpacing: "-0.01em"
  eyebrow-mono:
    fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.18em"
    textTransform: "uppercase"
  body-lg:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "1.65"
  body-md:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.6"
  body-sm:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.55"
  caption:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.01em"
  code:
    fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.55"
  button-md:
    fontFamily: "Inter, Pretendard, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "1"
    letterSpacing: "-0.005em"

rounded:
  none: "0px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "9999px"

spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
  5xl: "48px"
  6xl: "64px"
  7xl: "96px"
  8xl: "128px"

elevation:
  flat: "none"
  hairline: "inset 0 0 0 1px {colors.hairline}"
  glow-soft: "0 0 0 1px {colors.hairline}, 0 24px 60px -32px rgba(45, 212, 191, 0.12)"
  glow-emerald: "0 0 0 1px rgba(45, 212, 191, 0.4), 0 0 32px -8px rgba(45, 212, 191, 0.25)"
  modal: "0 30px 80px rgba(0, 0, 0, 0.6), inset 0 0 0 1px {colors.hairline}"

container:
  max-width: "1180px"
  gutter-desktop: "{spacing.3xl}"
  gutter-mobile: "{spacing.lg}"

components:
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: "{spacing.md} {spacing.3xl}"
    borderBottom: "1px solid {colors.hairline}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
    hoverBackground: "{colors.primary-soft}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "14px 20px"
    hoverBorder: "{colors.primary-soft}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary-soft}"
    typography: "{typography.button-md}"
    padding: "14px 16px"
  pill-tag:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card-feature:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.md}"
    padding: "{spacing.2xl}"
  card-feature-emphasized:
    backgroundColor: "{colors.canvas-raised}"
    border: "1px solid {colors.primary-deep}"
    rounded: "{rounded.md}"
    padding: "{spacing.2xl}"
  code-mockup:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  code-inline-chip:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.code-ink}"
    typography: "{typography.code}"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
  text-input:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    padding: "{spacing.7xl} 0 {spacing.6xl}"
  content-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    padding: "{spacing.7xl} 0"
  content-band-soft:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    padding: "{spacing.7xl} 0"
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    borderTop: "1px solid {colors.hairline}"
    padding: "{spacing.5xl} 0 {spacing.4xl}"
---

## 1. Visual Theme & Atmosphere

Vooster의 랜딩은 **단일 어두운 캔버스 위에 헤어라인으로 구획된 작업실(atelier)** 이다.
conductor.build 와 같은 모던 개발자 도구의 다크-퍼스트 미감을 골격으로 삼되,
순흑(#000) 대신 살짝 따뜻한 오프-블랙(`{colors.canvas}` `#0c100e`)을 써서
"코드 에디터" 보다는 "조명이 낮춰진 작업실"에 가까운 분위기를 만든다.

- **밀도(density):** 중간. 코드 한 줄, 한 카드, 한 줄의 카피 사이에 충분한 여백.
  conductor.build 가 그러하듯 _생각할 자리_ 가 보이도록 디자인한다.
- **색의 절제:** 액센트는 단 하나 — 에메랄드 `{colors.primary}` `#2dd4bf`.
  CTA, 상태 표시, "현재 진행 중" 인디케이터, 코드 키워드 강조에만 쓴다.
  보조 색은 헤어라인(`{colors.hairline}`) 한 가지로 카드와 구간을 가른다.
- **장식 금지:** 그라디언트 메쉬, 글로우 클라우드, 일러스트 시리즈 없음.
  유일한 장식은 (a) 카드 헤어라인, (b) 모노스페이스 eyebrow 라벨,
  (c) 섹션 사이의 1px 점선 디바이더.
- **한국어 톤:** 카피는 짧고 명령형보다 진술형. "~합니다" 대신 "~한다 / ~합니다" 혼용을 피하고
  존중조(합니다)로 통일. 영어 잡음(예: "Now Hiring", "GitHub Star")은 한글 번역으로 흡수.

## 2. Color Palette & Roles

### Brand & Accent

| Token                   | Hex       | Role                                                            |
| ----------------------- | --------- | --------------------------------------------------------------- |
| `{colors.primary}`      | `#2dd4bf` | 유일한 브랜드 액센트. CTA 배경, 라이브 인디케이터, 코드 키워드. |
| `{colors.primary-soft}` | `#5eead4` | 호버/포커스 시 primary 의 밝은 변형. 텍스트 링크 호버.          |
| `{colors.primary-deep}` | `#0f766e` | 강조 카드 보더, 본문 인라인 링크의 기본 색.                     |
| `{colors.on-primary}`   | `#0c100e` | primary 위에 놓이는 텍스트(=canvas와 동일).                     |

### Surface

| Token                    | Hex       | Role                                          |
| ------------------------ | --------- | --------------------------------------------- |
| `{colors.canvas}`        | `#0c100e` | 기본 페이지 배경. 라이트 모드 미지원.         |
| `{colors.canvas-soft}`   | `#13181a` | 인풋, 인라인 코드 칩, 보조 섹션 배경.         |
| `{colors.canvas-raised}` | `#161c1d` | 강조 카드(featured tier 등)의 살짝 들린 표면. |
| `{colors.hairline}`      | `#28302c` | 1px 보더 — 카드/버튼/디바이더의 단일 엣지 색. |
| `{colors.hairline-soft}` | `#1c2421` | 점선 디바이더, 보조 그리드 라인.              |

### Text

| Token                 | Hex       | Role                                                       |
| --------------------- | --------- | ---------------------------------------------------------- |
| `{colors.ink-strong}` | `#fffaf1` | 히어로 헤드라인, 최고 강조 카피. (살짝 따뜻한 오프-화이트) |
| `{colors.ink}`        | `#eee6d6` | 기본 본문 색 — 따뜻한 크림 톤으로 다크 캔버스에 안착.      |
| `{colors.body}`       | `#b8c2bc` | 보조 본문, 카드 디스크립션.                                |
| `{colors.mute}`       | `#6f7d76` | 캡션, 푸터 보조 라인, 비활성 메뉴.                         |
| `{colors.code-ink}`   | `#e6f1ec` | 코드 목업 안 텍스트.                                       |

### Semantic

| Token                     | Hex       | Role                        |
| ------------------------- | --------- | --------------------------- |
| `{colors.signal-success}` | `#22c55e` | "통과", "그린" 상태.        |
| `{colors.signal-warn}`    | `#facc15` | "주의", "디퍼" 상태.        |
| `{colors.signal-error}`   | `#f87171` | "빨간 테스트", "실패" 상태. |

> Vooster 의 도메인이 빨간/초록 테스트와 직접 맞닿아 있으므로 semantic 3색은
> 단지 보조가 아니라 **현장 컨텍스트로 자주 표면화** 된다 — Showcase 패널의 상태 점 등.

## 3. Typography Rules

### Font Stack

1. **Sans (디스플레이/본문)**: `Inter` + `Pretendard` 한글 매핑.
   `Pretendard` 가 라틴 글리프도 자체 제공하지만, 디스플레이 H1 의 트래킹/시각 무게가
   conductor.build 의 Inter 분위기에 더 가깝기 때문에 Inter 를 먼저 두고
   Pretendard 를 한글 폴백으로 둔다. 자체 호스팅이 어려운 환경에서는 system-ui 로 자연 폴백.
2. **Mono (코드/eyebrow)**: `JetBrains Mono` → `SF Mono` → `Menlo` → `Consolas`.
   eyebrow 라벨, 인라인 코드 칩, 코드 목업, 그리고 숫자/메트릭 표기에 사용.

### Hierarchy

| Token                       | 크기                 | 굵기 | 행간 | 트래킹    | 용도                               |
| --------------------------- | -------------------- | ---- | ---- | --------- | ---------------------------------- |
| `{typography.display-xl}`   | `clamp(56,9vw,96)`   | 400  | 1.02 | -0.025em  | 히어로 H1.                         |
| `{typography.display-lg}`   | `clamp(36,5vw,56)`   | 400  | 1.06 | -0.02em   | 섹션 헤드라인.                     |
| `{typography.display-md}`   | `clamp(28,3.4vw,40)` | 500  | 1.12 | -0.015em  | 서브섹션 헤드라인, 가격 카드 제목. |
| `{typography.display-sm}`   | 22px                 | 600  | 1.2  | -0.01em   | 피처 카드 제목, How-step 제목.     |
| `{typography.eyebrow-mono}` | 12px                 | 600  | 16px | 0.18em UC | 섹션 위 eyebrow 라벨.              |
| `{typography.body-lg}`      | 18px                 | 400  | 1.65 | 0         | 히어로/Showcase 리드 카피.         |
| `{typography.body-md}`      | 16px                 | 400  | 1.6  | 0         | 기본 본문.                         |
| `{typography.body-sm}`      | 14px                 | 400  | 1.55 | 0         | 카드 본문, 푸터.                   |
| `{typography.caption}`      | 12px                 | 500  | 16px | 0.01em    | 메타 라벨, 일자 표시.              |
| `{typography.code}`         | 13px                 | 400  | 1.55 | 0         | 코드 목업/칩.                      |
| `{typography.button-md}`    | 15px                 | 600  | 1    | -0.005em  | 버튼 라벨.                         |

### Principles

- **저중량 디스플레이.** 히어로 H1 은 Inter 400 (regular). 굵게 외치지 않고
  "이게 우리 도구입니다" 라고 차분히 둔다.
- **모노 eyebrow 가 시그니처.** 모든 섹션 위 `EVERYTHING YOU NEED` 식의 eyebrow 는
  JetBrains Mono 12px / tracking 0.18em / uppercase. 본문이 한글이어도 eyebrow 는
  영문 약어(예: `STEP / WHY VOOSTER / PRICING`)를 쓰는 것을 허용 — 단,
  같은 카드 안 본문에는 반드시 한글이 1자 이상 포함되어야 한다(Goal 5 C4).
- **한글 행간/자간 보정.** Latin 디스플레이의 `-0.025em` 트래킹은 한글에서 좁아 보이므로
  한글이 우세한 라인은 `letter-spacing: -0.01em` 정도로 보정한다. 본문 한글 라인은
  Latin 기준 1.65 보다 살짝 빡빡한 1.55–1.6 이 더 안정적이다.
- **숫자는 모노.** 가격(`월 49,000원`), 메트릭, 진행도 카운터는 JetBrains Mono 로 렌더해서
  컬럼 정렬을 깨지 않게 한다.

## 4. Component Stylings

> 모든 컴포넌트는 위 토큰(`{colors.*}`, `{typography.*}`, `{spacing.*}`, `{rounded.*}`)을 참조한다.
> 새 컴포넌트를 만들 때 토큰 외 값을 직접 입력해야 한다면, 먼저 토큰을 추가하라.

### Buttons

- **`button-primary`** — 에메랄드 솔리드 CTA.
  배경 `{colors.primary}`, 텍스트 `{colors.on-primary}`, 라운드 `{rounded.sm}` 6px,
  패딩 `14px 20px`, 라벨 `{typography.button-md}`.
  호버: 배경을 `{colors.primary-soft}` 로 페이드(120ms ease-out).
  포커스: `outline: 2px solid {colors.primary-soft}`, `outline-offset: 2px`.
- **`button-outline`** — 헤어라인 보더 + 투명 배경의 보조 CTA.
  보더 `1px solid {colors.hairline}`, 텍스트 `{colors.ink}`, 호버 시 보더 → `{colors.primary-soft}`.
- **`button-ghost`** — 텍스트 전용 3차 CTA. `{colors.primary-soft}` 라벨, 패딩 `14px 16px`.

### Cards

- **`card-feature`** — 기본 피처 카드. `{colors.canvas}` 배경에 `1px solid {colors.hairline}` 보더,
  라운드 `{rounded.md}` 8px, 패딩 `{spacing.2xl}`.
  내부에는 24×24 또는 28×28 의 stroked icon (currentColor) → 제목 → 본문 순서.
  그림자/필 없음.
- **`card-feature-emphasized`** — 강조 카드. 배경 `{colors.canvas-raised}`,
  보더 `1px solid {colors.primary-deep}`. 가격 그리드의 "팀" 티어에 사용.
- **`code-mockup`** — 코드 에디터 카드. 헤더에 4×4 dot 3개(traffic light) + 파일명 캡션.
  본문은 `{typography.code}`, 키워드 강조에만 `{colors.primary}` 사용.
- **`code-inline-chip`** — 본문 안 인라인 명령어 칩. `{colors.canvas-soft}` 배경,
  `{typography.code}`, 라운드 `{rounded.xs}`.

### Inputs

- **`text-input`** — 다크 인풋. 배경 `{colors.canvas-soft}`, 보더 `1px solid {colors.hairline}`,
  라운드 `{rounded.sm}` 6px, 패딩 `12px 14px`. 포커스: 보더 → `{colors.primary-soft}`,
  shadow `0 0 0 3px rgba(45,212,191,0.18)`.

### Navigation

- **`nav-bar`** — sticky top nav. 배경 `{colors.canvas}`, 하단 보더 `1px solid {colors.hairline}`,
  좌측에 워드마크, 우측에 nav-link 3–5개 + `button-primary` 1개.
  높이 64px, 패딩 `{spacing.md} {spacing.3xl}`.
- **`nav-link`** — `{colors.body}` → 호버 시 `{colors.ink}` 로 페이드.
  active 시 하단에 2px solid `{colors.primary}` 인디케이터.

### Signature

- **`hero-band`** — 다크 캔버스, 상단 패딩 `{spacing.7xl}` (96px), 하단 `{spacing.6xl}` (64px).
  H1 → `{typography.display-xl}` `{colors.ink-strong}`. eyebrow → `{typography.eyebrow-mono}`
  `{colors.primary-soft}`. 보조 카피 → `{typography.body-lg}` `{colors.body}`.
  CTA pair: `button-primary` + `button-outline`. 아래에 코드 목업 또는 작업실 미리보기 카드 1개.
- **`pill-tag`** — 상태/태그 표시. 보더 + 헤어라인 + pill 라운드. 예: `Live`, `v0.1`, `한국어`.
- **`green-divider`** — 섹션 사이의 2px solid `{colors.primary}` top/bottom 보더 한 줄.
  중요 트랜지션(예: 마지막 CTA 직전)에만 사용. 일반 섹션 사이에는 1px dashed `{colors.hairline-soft}`.

## 5. Layout Principles

### Spacing scale (4px base)

`{spacing.xxs}` 2 · `{spacing.xs}` 4 · `{spacing.sm}` 8 · `{spacing.md}` 12 · `{spacing.lg}` 16 ·
`{spacing.xl}` 20 · `{spacing.2xl}` 24 · `{spacing.3xl}` 32 · `{spacing.4xl}` 40 · `{spacing.5xl}` 48 ·
`{spacing.6xl}` 64 · `{spacing.7xl}` 96 · `{spacing.8xl}` 128.

- 섹션 vertical padding 은 `{spacing.7xl}` (96px) 기본, 좁은 섹션은 `{spacing.6xl}` (64px).
- 카드 내부 패딩은 `{spacing.2xl}` (24px) 또는 `{spacing.3xl}` (32px).
- 카드 사이 gap 은 `{spacing.lg}` (16px), 그리드 컬럼 사이는 `{spacing.xl}` (20px).

### Container

- `max-width: 1180px`, 좌우 마진 자동.
- 데스크톱 좌우 거터: `{spacing.3xl}` (32px).
- 모바일 좌우 거터: `{spacing.lg}` (16px).
- 풀-블리드 컬러 밴드(예: hero-band)는 컨테이너 밖에서 배경만 깔고, 내부 콘텐츠는 컨테이너 폭으로 잡는다.

### Grid

- 피처 그리드: 데스크톱 3-up, 태블릿 2-up, 모바일 1-up.
- How-step: 데스크톱 4-up(수평), 태블릿 2×2, 모바일 1-up.
- 가격 그리드: 항상 3-up; 모바일에서 1-up 으로 스택.
- LogoCloud: 데스크톱 6-up 단일 행 또는 3-up 2행, 모바일 2-up.

### Whitespace Philosophy

"여백이 디자인이다" — conductor.build 와 같이 비어 보이는 영역이 _의도된 여백_ 임을 명확히 한다.
한 섹션 안에서 헤드라인과 본문 사이 `{spacing.2xl}`, 본문과 그리드 사이 `{spacing.5xl}` 이 기본.

## 6. Depth & Elevation

| Level            | Treatment                                                | Use                                    |
| ---------------- | -------------------------------------------------------- | -------------------------------------- |
| 0 — Flat         | 그림자/보더 없음                                         | 풀-블리드 밴드, 푸터.                  |
| 1 — Hairline     | `1px solid {colors.hairline}`                            | 모든 카드/버튼/인풋의 기본.            |
| 2 — Glow-soft    | `0 24px 60px -32px rgba(45,212,191,0.12)` + hairline     | 히어로 코드 목업, featured 카드.       |
| 3 — Glow-emerald | `0 0 0 1px primary, 0 0 32px -8px rgba(45,212,191,0.25)` | 활성/포커스 상태, "라이브" 인디케이터. |
| 4 — Modal        | `0 30px 80px rgba(0,0,0,0.6)` + inset hairline           | 모달/드로어(현 랜딩에는 미사용).       |

원칙: **shadow 보다 hairline 으로 깊이를 만든다.** 다크 캔버스에서 그림자는 거의 안 보이고
hairline 의 명도 차가 깊이감을 만든다. 그림자는 액센트일 뿐이지 분리 도구가 아니다.

## 7. Do's and Don'ts

### Do

- **단일 액센트.** primary 에메랄드 외 다른 컬러 액센트를 도입하지 말 것. semantic 3색은 _상태 표시_ 한정.
- **헤어라인이 우선.** 카드/섹션 분리는 1px hairline 으로. fill 색 변경은 강조 카드에 한정.
- **모노 eyebrow.** 섹션 위에는 항상 12px JetBrains Mono uppercase eyebrow 한 줄.
- **숫자/메트릭은 모노.** 가격, 진행도, UC-ID 등 정렬이 중요한 숫자는 mono.
- **한글 위주 본문.** 모든 컴포넌트 파일은 한글 1자 이상 포함(Goal 5 C4).
- **명령어/엔티티명은 인라인 코드 칩으로.** 예: `pnpm install`, `UC-012`, `vspec spec ls`.

### Don't

- ❌ 그라디언트 메쉬, 글로우 클라우드, 일러스트 시리즈 — 도입 금지.
- ❌ 새 액센트 컬러 — primary 외에 핑크/블루/오렌지 도입 금지.
- ❌ 라이트 모드 — 다크 단일 표면이 브랜드 시그니처. 라이트 변형 만들지 않는다.
- ❌ Lorem ipsum 또는 영문 자리 채우기 — Goal 5 C4 게이트 불통과 + 브랜드 톤 깨짐.
- ❌ 그림자로 카드 분리 — hairline 이 분리, shadow 는 강조 only.
- ❌ 두꺼운 디스플레이 폰트(700+) — Inter 400/500 이 시그니처. 굵게 외치지 않는다.
- ❌ 외부 폰트의 추가 import — Inter + Pretendard + JetBrains Mono 외 신규 페이스 도입 금지.

## 8. Responsive Behavior

### Breakpoints

| Name    | Width      | Key Changes                                   |
| ------- | ---------- | --------------------------------------------- |
| Mobile  | < 640px    | H1 56px → 40px, 모든 그리드 1-up, nav 햄버거. |
| Tablet  | 640–1023px | 그리드 2-up, nav 가로 유지 또는 컴팩트.       |
| Desktop | ≥ 1024px   | 풀 3/4-up 그리드, 컨테이너 폭 1180.           |

### Touch targets

모든 인터랙티브 요소(버튼, nav-link, footer link) 의 hit area 는 최소 44×44px.
`button-primary` 의 14×20 패딩 + 15px 라벨로 자연스럽게 충족.

### Collapsing strategy

- 히어로 CTA pair: 데스크톱 inline, 모바일 stack(`flex-direction: column`, gap `{spacing.md}`).
- 피처 그리드: 3-up → 2-up → 1-up.
- 가격 카드: 항상 3-up but 모바일에서 1-up stack(featured 카드가 가운데에 먼저 등장하도록 순서 재정렬).
- nav: 데스크톱 가로, < 768px 에서 햄버거 → 드로어. 드로어 내부도 다크 캔버스 + emerald CTA pin.

### Image / Mockup behavior

- 히어로의 코드 목업은 데스크톱에서 풀폭, 모바일에서 좌우 거터만 유지하고 풀-블리드.
- LogoCloud 의 파트너 로고는 SVG only (PNG 금지) 로 다크 캔버스에 자연스럽게 합성되도록 `fill: currentColor` 또는 단색 변형.

## 9. Agent Prompt Guide

### Quick color reference (copy-paste)

```
--color-canvas: #0c100e;
--color-canvas-soft: #13181a;
--color-canvas-raised: #161c1d;
--color-ink-strong: #fffaf1;
--color-ink: #eee6d6;
--color-body: #b8c2bc;
--color-mute: #6f7d76;
--color-hairline: #28302c;
--color-primary: #2dd4bf;
--color-primary-soft: #5eead4;
--color-primary-deep: #0f766e;
--color-on-primary: #0c100e;
--font-sans: "Inter", "Pretendard", system-ui, sans-serif;
--font-mono: "JetBrains Mono", SFMono-Regular, Menlo, monospace;
```

### Ready-to-use prompts

- **"히어로 섹션 만들어줘"** → "Vooster DESIGN.md 의 `hero-band` 컴포넌트 토큰을 사용해서
  apps/www/src/components/sections/Hero.astro 를 다시 짜. 다크 캔버스 `{colors.canvas}`,
  H1 은 `{typography.display-xl}` `{colors.ink-strong}`, eyebrow 는 `{typography.eyebrow-mono}` `{colors.primary-soft}`,
  CTA pair 는 `button-primary` + `button-outline`. 하단에 `code-mockup` 카드 한 개."
- **"피처 카드 6개"** → "card-feature 토큰으로 3-up 그리드. 각 카드 = stroked icon + display-sm 제목 + body-sm 본문.
  카드 보더만, fill 변경 금지. 한 카드만 card-feature-emphasized 로 보더에 primary-deep."
- **"가격 카드 3-tier"** → "오픈소스/팀/조직 3장. 팀이 featured(card-feature-emphasized).
  가격 숫자는 mono, CTA 는 티어별로 차별화(button-primary / button-primary / button-outline)."

### Migration cue

랜딩의 어떤 부분이라도 위 토큰 외 값을 인용하면(예: `background: #1a1a1a` 처럼 raw hex 직타),
그 자리에 가장 가까운 토큰명(`{colors.canvas-soft}`)으로 치환하라.
토큰에 없는 값이 정말 필요하면 DESIGN.md 의 frontmatter 에 토큰을 먼저 추가하고 사용한다.

## Appendix — Goal 5 Invariants (do not break)

`apps/www` 의 디자인을 어떻게 바꾸든 아래는 깨면 안 된다 (`goals/5-monorepo.md` C4·C5·C6).

- `apps/www/src/components/sections/{Hero,LogoCloud,Features,HowItWorks,Showcase,Pricing,Footer}.astro` 7개 파일은
  같은 이름·경로로 유지. 각 파일에 한글 1자 이상 포함.
- `apps/www/src/pages/index.astro` 는 위 7개를 `import` 한다.
- `pnpm --filter @vooster/www build` 가 0 으로 종료, `apps/www/dist/index.html` 생성.

새 컴포넌트는 자유롭게 `apps/www/src/components/ui/` 등에 추가 가능 — 단 새 `.astro` 파일에도
주석이든 alt 텍스트든 한글 1자 이상 넣어 C4 안전 마진을 유지한다.
