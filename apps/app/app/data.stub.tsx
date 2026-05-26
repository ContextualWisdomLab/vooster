import type {
  ActorSummary,
  CreateProjectInput,
  CreateProjectResult,
  DeleteProjectResult,
  ProjectSummary,
  RenameProjectResult,
  UsecaseDetail,
  UsecaseSummary
} from "./data";

export function isAuthStub(): boolean {
  return process.env.VSPEC_AUTH_STUB === "1";
}

const DEMO_WORKSPACE_ID = "DEMO-WORKSPACE";

type StubGlobal = { __vspecDemoProjects?: ProjectSummary[] };

type DemoUsecase = { key: string; detail: UsecaseDetail };

type DemoProject = {
  summary: ProjectSummary;
  actors: ActorSummary[];
  usecases: DemoUsecase[];
};

// Seeded demo data for VSPEC_AUTH_STUB=1: three realistic, project-scoped specs
// so the local experience mirrors what a real workspace looks like rather than a
// single placeholder. Each use case's summary (counts, level, status) is derived
// from its detail below, so the two views can never drift.
const DEMO_PROJECTS: DemoProject[] = [
  {
    summary: {
      id: "CHECKOUT",
      key: "CHECKOUT",
      name: "커머스 체크아웃",
      visibility: "PRIVATE",
      workspace_id: DEMO_WORKSPACE_ID
    },
    actors: [
      { id: "CHECKOUT-ACTOR-1", name: "고객", type: "PRIMARY", is_human: true },
      {
        id: "CHECKOUT-ACTOR-2",
        name: "결제 게이트웨이",
        type: "SUPPORTING",
        is_human: false
      },
      {
        id: "CHECKOUT-ACTOR-3",
        name: "재고 관리 시스템",
        type: "SUPPORTING",
        is_human: false
      },
      { id: "CHECKOUT-ACTOR-4", name: "정산 담당자", type: "OFFSTAGE", is_human: true }
    ],
    usecases: [
      {
        key: "CHECKOUT-001",
        detail: {
          title: "장바구니 상품을 주문한다",
          primary_actor: { name: "고객" },
          level: "USER_GOAL",
          status: "IN_REVIEW",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "고객",
                action: "장바구니를 열어 주문할 상품을 확인한다."
              },
              {
                step_number: 2,
                actor: "고객",
                action: "배송지와 배송 방법을 선택한다."
              },
              {
                step_number: 3,
                actor: "재고 관리 시스템",
                action: "주문 상품의 재고를 확인하고 예약한다."
              },
              {
                step_number: 4,
                actor: "고객",
                action: "결제 수단을 선택하고 결제를 요청한다."
              },
              { step_number: 5, actor: "결제 게이트웨이", action: "결제를 승인한다." },
              {
                step_number: 6,
                actor: "시스템",
                action: "주문을 확정하고 주문번호를 발급한다."
              }
            ]
          },
          extensions: [
            { condition: "배송 불가 지역의 상품이 포함됨", outcome: "PARTIAL" },
            { condition: "예약 시점에 재고가 부족함", outcome: "FAILURE" },
            { condition: "결제가 거절됨", outcome: "FAILURE" }
          ],
          stakeholder_interests: [
            {
              stakeholder: "고객",
              interest: "주문이 정확히 처리되고 결제 정보가 안전하게 보호된다."
            },
            {
              stakeholder: "프로덕트 매니저",
              interest: "체크아웃 이탈을 줄여 매출을 보호한다."
            },
            {
              stakeholder: "정산 담당자",
              interest: "결제와 주문 기록이 정확히 일치한다."
            }
          ]
        }
      },
      {
        key: "CHECKOUT-002",
        detail: {
          title: "할인 쿠폰을 적용한다",
          primary_actor: { name: "고객" },
          level: "SUBFUNCTION",
          status: "APPROVED",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "고객",
                action: "결제 단계에서 쿠폰 코드를 입력한다."
              },
              {
                step_number: 2,
                actor: "시스템",
                action: "쿠폰의 유효기간과 적용 조건을 검증한다."
              },
              {
                step_number: 3,
                actor: "시스템",
                action: "할인 금액을 계산해 결제 금액에 반영한다."
              }
            ]
          },
          extensions: [
            { condition: "쿠폰이 만료되었거나 존재하지 않음", outcome: "FAILURE" },
            { condition: "최소 주문 금액 조건을 충족하지 못함", outcome: "PARTIAL" }
          ],
          stakeholder_interests: [
            { stakeholder: "고객", interest: "적용 가능한 할인을 빠짐없이 받는다." },
            {
              stakeholder: "마케팅 담당자",
              interest: "프로모션이 의도한 조건대로만 적용된다."
            }
          ]
        }
      },
      {
        key: "CHECKOUT-003",
        detail: {
          title: "주문을 취소하고 환불받는다",
          primary_actor: { name: "고객" },
          level: "USER_GOAL",
          status: "DRAFT",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "고객",
                action: "주문 내역에서 취소할 주문을 선택한다."
              },
              {
                step_number: 2,
                actor: "시스템",
                action: "배송 상태가 취소 가능한 단계인지 확인한다."
              },
              {
                step_number: 3,
                actor: "고객",
                action: "취소 사유를 선택하고 취소를 요청한다."
              },
              {
                step_number: 4,
                actor: "결제 게이트웨이",
                action: "결제를 취소하고 환불을 처리한다."
              },
              {
                step_number: 5,
                actor: "시스템",
                action: "재고를 복구하고 취소 완료를 안내한다."
              }
            ]
          },
          extensions: [
            { condition: "이미 배송이 시작됨", outcome: "PARTIAL" },
            { condition: "게이트웨이에서 환불 처리가 실패함", outcome: "FAILURE" }
          ],
          stakeholder_interests: [
            {
              stakeholder: "고객",
              interest: "취소가 신속하고 환불이 누락 없이 이뤄진다."
            },
            {
              stakeholder: "고객지원팀",
              interest: "취소 사유가 기록되어 응대에 활용된다."
            }
          ]
        }
      },
      {
        key: "CHECKOUT-004",
        detail: {
          title: "주문 내역을 조회한다",
          primary_actor: { name: "고객" },
          level: "USER_GOAL",
          status: "APPROVED",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "고객",
                action: "마이페이지에서 주문 내역을 연다."
              },
              {
                step_number: 2,
                actor: "시스템",
                action: "최근 주문을 최신순으로 보여준다."
              },
              {
                step_number: 3,
                actor: "고객",
                action: "특정 주문을 선택해 상세 내역과 배송 상태를 확인한다."
              }
            ]
          },
          extensions: [{ condition: "조회 기간에 주문이 없음", outcome: "SUCCESS" }],
          stakeholder_interests: [
            {
              stakeholder: "고객",
              interest: "언제든 자신의 주문 상태를 투명하게 확인한다."
            }
          ]
        }
      },
      {
        key: "CHECKOUT-005",
        detail: {
          title: "정기 결제 수단을 관리한다",
          primary_actor: { name: "고객" },
          level: "SUMMARY",
          status: "DEPRECATED",
          main_scenario: {
            steps: [
              { step_number: 1, actor: "고객", action: "결제 수단 관리 화면을 연다." },
              {
                step_number: 2,
                actor: "고객",
                action: "카드나 간편결제 수단을 등록하거나 삭제한다."
              }
            ]
          },
          extensions: [
            {
              condition: "구버전 정기결제 모듈은 신규 빌링 시스템으로 대체됨",
              outcome: "FAILURE"
            }
          ],
          stakeholder_interests: [
            {
              stakeholder: "보안 담당자",
              interest: "결제 수단 정보가 PCI-DSS 기준에 따라 저장된다."
            }
          ]
        }
      }
    ]
  },
  {
    summary: {
      id: "ONBOARD",
      key: "ONBOARD",
      name: "팀 워크스페이스 온보딩",
      visibility: "INTERNAL",
      workspace_id: DEMO_WORKSPACE_ID
    },
    actors: [
      { id: "ONBOARD-ACTOR-1", name: "신규 멤버", type: "PRIMARY", is_human: true },
      {
        id: "ONBOARD-ACTOR-2",
        name: "워크스페이스 관리자",
        type: "PRIMARY",
        is_human: true
      },
      {
        id: "ONBOARD-ACTOR-3",
        name: "이메일 발송 서비스",
        type: "SUPPORTING",
        is_human: false
      },
      {
        id: "ONBOARD-ACTOR-4",
        name: "보안 감사 로그",
        type: "OFFSTAGE",
        is_human: false
      }
    ],
    usecases: [
      {
        key: "ONBOARD-001",
        detail: {
          title: "초대 링크로 워크스페이스에 합류한다",
          primary_actor: { name: "신규 멤버" },
          level: "USER_GOAL",
          status: "APPROVED",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "신규 멤버",
                action: "이메일로 받은 초대 링크를 연다."
              },
              {
                step_number: 2,
                actor: "시스템",
                action: "초대 토큰의 유효성을 확인한다."
              },
              {
                step_number: 3,
                actor: "신규 멤버",
                action: "GitHub 계정으로 로그인한다."
              },
              {
                step_number: 4,
                actor: "시스템",
                action: "멤버를 워크스페이스에 추가하고 기본 역할을 부여한다."
              }
            ]
          },
          extensions: [
            { condition: "초대 링크가 만료됨", outcome: "FAILURE" },
            { condition: "이미 가입된 계정임", outcome: "PARTIAL" }
          ],
          stakeholder_interests: [
            { stakeholder: "신규 멤버", interest: "복잡한 절차 없이 빠르게 합류한다." },
            {
              stakeholder: "워크스페이스 관리자",
              interest: "승인된 사람만 워크스페이스에 들어온다."
            }
          ]
        }
      },
      {
        key: "ONBOARD-002",
        detail: {
          title: "팀원을 역할과 함께 초대한다",
          primary_actor: { name: "워크스페이스 관리자" },
          level: "USER_GOAL",
          status: "IN_REVIEW",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "워크스페이스 관리자",
                action: "멤버 관리 화면에서 초대를 시작한다."
              },
              {
                step_number: 2,
                actor: "워크스페이스 관리자",
                action: "이메일 주소와 부여할 역할을 입력한다."
              },
              {
                step_number: 3,
                actor: "이메일 발송 서비스",
                action: "초대 메일을 발송한다."
              },
              {
                step_number: 4,
                actor: "시스템",
                action: "초대 상태를 '대기 중'으로 기록한다."
              }
            ]
          },
          extensions: [
            { condition: "이미 멤버이거나 초대 대기 중인 이메일", outcome: "PARTIAL" },
            { condition: "라이선스 좌석 한도를 초과함", outcome: "FAILURE" }
          ],
          stakeholder_interests: [
            {
              stakeholder: "워크스페이스 관리자",
              interest: "권한을 최소한으로 정확히 부여한다."
            },
            {
              stakeholder: "재무 담당자",
              interest: "좌석 한도를 넘는 초대가 차단된다."
            }
          ]
        }
      },
      {
        key: "ONBOARD-003",
        detail: {
          title: "SSO로 로그인한다",
          primary_actor: { name: "신규 멤버" },
          level: "SUBFUNCTION",
          status: "DRAFT",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "신규 멤버",
                action: "회사 이메일로 로그인을 시도한다."
              },
              {
                step_number: 2,
                actor: "시스템",
                action: "도메인에 연결된 SSO 공급자로 이동시킨다."
              },
              {
                step_number: 3,
                actor: "신규 멤버",
                action: "SSO 공급자에서 인증한다."
              },
              {
                step_number: 4,
                actor: "시스템",
                action: "인증 결과를 검증하고 세션을 생성한다."
              }
            ]
          },
          extensions: [
            { condition: "SSO 공급자 응답이 검증에 실패함", outcome: "FAILURE" }
          ],
          stakeholder_interests: [
            {
              stakeholder: "보안 담당자",
              interest: "사내 계정 정책이 로그인에 강제된다."
            }
          ]
        }
      },
      {
        key: "ONBOARD-004",
        detail: {
          title: "온보딩 체크리스트를 완료한다",
          primary_actor: { name: "신규 멤버" },
          level: "SUMMARY",
          status: "DRAFT",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "신규 멤버",
                action: "첫 로그인 후 온보딩 체크리스트를 확인한다."
              },
              {
                step_number: 2,
                actor: "신규 멤버",
                action: "프로필 작성과 첫 프로젝트 열람 등 항목을 수행한다."
              },
              {
                step_number: 3,
                actor: "시스템",
                action: "완료된 항목을 표시하고 진행률을 갱신한다."
              }
            ]
          },
          extensions: [{ condition: "일부 항목을 건너뜀", outcome: "PARTIAL" }],
          stakeholder_interests: [
            {
              stakeholder: "신규 멤버",
              interest: "무엇부터 해야 할지 명확히 안내받는다."
            }
          ]
        }
      }
    ]
  },
  {
    summary: {
      id: "SUPPORT",
      key: "SUPPORT",
      name: "고객 지원 티켓",
      visibility: "PRIVATE",
      workspace_id: DEMO_WORKSPACE_ID
    },
    actors: [
      { id: "SUPPORT-ACTOR-1", name: "고객", type: "PRIMARY", is_human: true },
      { id: "SUPPORT-ACTOR-2", name: "상담원", type: "PRIMARY", is_human: true },
      {
        id: "SUPPORT-ACTOR-3",
        name: "지식베이스",
        type: "SUPPORTING",
        is_human: false
      },
      { id: "SUPPORT-ACTOR-4", name: "알림 봇", type: "SUPPORTING", is_human: false }
    ],
    usecases: [
      {
        key: "SUPPORT-001",
        detail: {
          title: "문의 티켓을 생성한다",
          primary_actor: { name: "고객" },
          level: "USER_GOAL",
          status: "APPROVED",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "고객",
                action: "도움말 센터에서 문의하기를 선택한다."
              },
              {
                step_number: 2,
                actor: "지식베이스",
                action: "입력 내용과 유사한 도움말을 추천한다."
              },
              {
                step_number: 3,
                actor: "고객",
                action: "추천으로 해결되지 않으면 제목과 내용을 작성해 제출한다."
              },
              {
                step_number: 4,
                actor: "시스템",
                action: "티켓 번호를 발급하고 접수 확인 메일을 보낸다."
              }
            ]
          },
          extensions: [
            { condition: "추천 도움말로 문제가 해결됨", outcome: "SUCCESS" },
            { condition: "첨부 파일 용량이 한도를 초과함", outcome: "PARTIAL" }
          ],
          stakeholder_interests: [
            {
              stakeholder: "고객",
              interest: "문의가 누락 없이 접수되고 진행 상황을 알 수 있다."
            },
            { stakeholder: "고객지원팀", interest: "셀프서비스로 문의량을 줄인다." }
          ]
        }
      },
      {
        key: "SUPPORT-002",
        detail: {
          title: "티켓을 상담원에게 배정한다",
          primary_actor: { name: "상담원" },
          level: "SUBFUNCTION",
          status: "APPROVED",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "시스템",
                action: "새 티켓의 카테고리와 우선순위를 분류한다."
              },
              {
                step_number: 2,
                actor: "시스템",
                action: "담당 가능한 상담원 중 부하가 가장 적은 사람을 선택한다."
              },
              {
                step_number: 3,
                actor: "알림 봇",
                action: "배정된 상담원에게 슬랙으로 알린다."
              },
              {
                step_number: 4,
                actor: "상담원",
                action: "배정된 티켓을 확인하고 처리를 시작한다."
              }
            ]
          },
          extensions: [
            { condition: "가용한 상담원이 없음", outcome: "PARTIAL" },
            { condition: "VIP 고객 티켓으로 분류됨", outcome: "SUCCESS" }
          ],
          stakeholder_interests: [
            { stakeholder: "상담원", interest: "업무량이 공정하게 분배된다." },
            { stakeholder: "고객지원팀", interest: "응답 시간 SLA를 지킨다." }
          ]
        }
      },
      {
        key: "SUPPORT-003",
        detail: {
          title: "티켓을 상위 그룹으로 에스컬레이션한다",
          primary_actor: { name: "상담원" },
          level: "USER_GOAL",
          status: "IN_REVIEW",
          main_scenario: {
            steps: [
              {
                step_number: 1,
                actor: "상담원",
                action: "자신이 해결하기 어려운 티켓을 선택한다."
              },
              {
                step_number: 2,
                actor: "상담원",
                action: "에스컬레이션 사유와 기술 정보를 첨부한다."
              },
              {
                step_number: 3,
                actor: "시스템",
                action: "티켓을 상위 지원 그룹 대기열로 이동한다."
              },
              {
                step_number: 4,
                actor: "알림 봇",
                action: "상위 그룹과 고객에게 상태 변경을 알린다."
              }
            ]
          },
          extensions: [
            { condition: "이미 최상위 그룹에 있음", outcome: "FAILURE" },
            { condition: "고객이 추가 정보 제공을 거부함", outcome: "PARTIAL" }
          ],
          stakeholder_interests: [
            {
              stakeholder: "고객",
              interest: "복잡한 문제도 적합한 전문가에게 전달된다."
            },
            {
              stakeholder: "상담원",
              interest: "권한 밖의 문제를 명확한 절차로 넘긴다."
            }
          ]
        }
      }
    ]
  }
];

function demoProjects(): ProjectSummary[] {
  const store = globalThis as StubGlobal;
  if (store.__vspecDemoProjects === undefined) {
    store.__vspecDemoProjects = DEMO_PROJECTS.map((project) => ({
      ...project.summary
    }));
  }
  return store.__vspecDemoProjects;
}

function findDemoProject(projectKey: string): DemoProject | undefined {
  return DEMO_PROJECTS.find(
    (project) => project.summary.id === projectKey || project.summary.key === projectKey
  );
}

function toUsecaseSummary(usecase: DemoUsecase): UsecaseSummary {
  const { detail } = usecase;
  return {
    key: usecase.key,
    level: detail.level,
    primary_actor: detail.primary_actor.name,
    status: detail.status,
    title: detail.title,
    scenario_count: 1 + detail.extensions.length,
    extension_count: detail.extensions.length
  };
}

function placeholderDetail(ucKey: string): UsecaseDetail {
  return {
    title: `${ucKey} 명세`,
    primary_actor: { name: "미지정" },
    level: "USER_GOAL",
    status: "DRAFT",
    main_scenario: { steps: [] },
    extensions: [],
    stakeholder_interests: []
  };
}

export function stubProjects(): ProjectSummary[] {
  return [...demoProjects()];
}

export function stubUsecases(projectKey: string): UsecaseSummary[] {
  return findDemoProject(projectKey)?.usecases.map(toUsecaseSummary) ?? [];
}

export function stubActors(projectKey: string): ActorSummary[] {
  return (findDemoProject(projectKey)?.actors ?? []).map((actor) => ({ ...actor }));
}

export function stubUsecaseDetail(projectKey: string, ucKey: string): UsecaseDetail {
  const match =
    findDemoProject(projectKey)?.usecases.find((uc) => uc.key === ucKey) ??
    DEMO_PROJECTS.flatMap((project) => project.usecases).find((uc) => uc.key === ucKey);
  return match === undefined ? placeholderDetail(ucKey) : { ...match.detail };
}

export function stubCreateProject(input: CreateProjectInput): CreateProjectResult {
  const store = demoProjects();
  if (store.some((project) => project.key === input.key)) {
    return { ok: false, error: `프로젝트 키 ${input.key}는 이미 사용 중입니다.` };
  }
  const project: ProjectSummary = {
    id: `${input.key}-${randomSuffix()}`,
    key: input.key,
    name: input.name,
    visibility: input.visibility ?? "PRIVATE",
    workspace_id: DEMO_WORKSPACE_ID
  };
  store.push(project);
  return { ok: true, project };
}

export function stubRenameProject(
  projectId: string,
  name: string
): RenameProjectResult {
  const project = demoProjects().find((entry) => entry.id === projectId);
  if (project === undefined) {
    return { ok: false, error: "Project not found." };
  }
  project.name = name;
  return { ok: true, project: { ...project } };
}

export function stubDeleteProject(projectId: string): DeleteProjectResult {
  const store = demoProjects();
  const index = store.findIndex((entry) => entry.id === projectId);
  if (index === -1) {
    return { ok: false, error: "Project not found." };
  }
  store.splice(index, 1);
  return { ok: true };
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
