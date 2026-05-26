# 웹 뷰어 디자인 — 표기 원칙

웹 뷰어가 도메인 개념을 화면에 **어떻게 표기/설명하는지**의 원칙. 구체적인
용어→라벨→설명 목록은 finding F1
(`docs/findings/2026-05-25T1503-web-viewer-de-jargon.md`)에 있고, 구현은
`apps/app/lib/labels.ts`(+ `TermLabel`)가 맡는다.

## 원칙

1. **캐논 용어 라벨 + on-demand 설명.** 라벨은 표준 용어(유스케이스·액터·확장…)로
   단정하게 표기한다. paraphrase로 치환하지 않는다.
2. **설명은 `?` popover로.** 용어를 모를 수 있는 곳엔 라벨 우측에 question-mark
   circle을 두고 클릭/호버 시 한 줄 설명을 띄운다. (라벨 안정·유지보수↑, 모르는
   사용자는 눌러 학습)
3. **한국어 하드코딩, i18n 없음.** (ICP·랜딩 모두 한국어, 베타까지 충분)
4. **코드 필드명(snake_case) 비노출.** (`primary_actor`·`main_scenario` 등)
