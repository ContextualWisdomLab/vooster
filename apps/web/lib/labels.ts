// Canonical Korean product terminology for the web viewer.
//
// The viewer must never leak storage-contract terms (snake_case field names,
// raw enum values) into the UI. This module is the single source of truth for
// turning use-case enum values into stable Korean labels, plus the glossary of
// term descriptions surfaced through the `?` popover affordance.
//
// 표기 원칙은 apps/web/DESIGN.md, 구체 용어집의 출처는
// docs/findings/2026-05-25T1503-web-viewer-de-jargon.md.

export type Level = "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";

const LEVEL_LABELS: Record<Level, string> = {
  SUMMARY: "요약",
  USER_GOAL: "사용자 목표",
  SUBFUNCTION: "하위 기능"
};

export type Status = "DRAFT" | "IN_REVIEW" | "APPROVED" | "DEPRECATED";

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "초안",
  IN_REVIEW: "검토 중",
  APPROVED: "확정",
  DEPRECATED: "폐기"
};

// Unknown enums fall back to their raw value so the UI degrades to the source
// string rather than throwing — but every spec value is mapped above.
export function levelLabel(level: string): string {
  const key = level.toUpperCase();
  return key in LEVEL_LABELS ? LEVEL_LABELS[key as Level] : level;
}

export function statusLabel(status: string): string {
  const key = status.toUpperCase();
  return key in STATUS_LABELS ? STATUS_LABELS[key as Status] : status;
}

export type GlossaryTerm = {
  label: string;
  description: string;
};

// Keyed by the code field name so pages reference terms stably. Labels are the
// canonical product vocabulary; descriptions are the on-demand `?` popover copy.
export const GLOSSARY = {
  usecase: {
    label: "유스케이스",
    description: "사용자가 시스템으로 달성하는 하나의 목표 단위"
  },
  primary_actor: {
    label: "주요 액터",
    description: "이 유스케이스를 주로 수행하는 사용자/시스템"
  },
  level: {
    label: "레벨",
    description: "유스케이스의 추상화 수준 (요약 / 사용자 목표 / 하위 기능)"
  },
  main_scenario: {
    label: "메인 시나리오",
    description: "모든 것이 정상일 때의 기본 성공 흐름"
  },
  extensions: {
    label: "확장",
    description: "기본 흐름에서 벗어나는 조건과 그 처리"
  },
  stakeholder_interests: {
    label: "이해관계자 관심사",
    description: "누구의 어떤 가치가 보호되어야 하는가"
  }
} as const satisfies Record<string, GlossaryTerm>;

export type GlossaryKey = keyof typeof GLOSSARY;

// 상태(status)는 자명하여 popover 설명 없이 라벨만 둔다.
export const STATUS_TERM_LABEL = "상태";
