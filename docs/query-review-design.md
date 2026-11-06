# 쿼리 리뷰 포맷 설계안

BACKLOG Phase 3 "쿼리 코드 리뷰 포맷(결함 심기, 체크리스트 채점)". 2026-11-06 작성·승인. 결정은 11절, 구현하며 바뀐 점은 12절.

## 1. 목표와 범위

연습할 장면: 그럴듯하게 쓰인 쿼리(AI가 써 준 것 같은 쿼리)와 그 결과를 받아, 지표 정의와 대조해 결함이 있는 줄을 찾고 결함 유형을 붙인다. 결과 표와 직접 돌려 보는 검증 쿼리로 숫자가 이상한지 확인하는 과정까지 포함한다.

이번에 하는 것

- 새 문제 형식 `review`("쿼리 리뷰"): 줄 선택 + 결함 유형 체크리스트 채점
- 검토 대상 쿼리의 실행 결과 표(방언별, 빌드가 미리 계산), 채점 없는 검증 쿼리 편집기
- 빌드·양식·게시 검증 스크립트에 `review` 처리 추가
- 샘플 문제 3개와 세트 1개(로컬 `content/`, 저장소 밖)
- E2E 1건, README·포트폴리오 문서·작성 스킬 갱신

이번에 하지 않는 것

- 고친 쿼리를 다시 실행해 채점하는 2단계(깨진 쿼리 고치기 형식이 이미 있음. 다음 후보로 남긴다)
- AI 호출(문제는 사람이 작성한 고정 콘텐츠)
- 모의 시험 세트 편성(형식은 모의 시험에서도 동작하게 만든다)

## 2. 데이터 모델

`lib/content/types.ts` 에 추가한다. 기존 필드는 그대로 둔다.

```ts
export const ProblemFormatSchema = z.enum(["write", "fix", "mcq", "predict", "spot", "review"]);
// FORMAT_LABEL.review = "쿼리 리뷰"

export const REVIEW_CATEGORIES = ["fanout", "duplicate", "null", "int-division", "boundary", "join", "definition"] as const;
export const ReviewCategorySchema = z.enum(REVIEW_CATEGORIES);

/** 줄 지정. match 문자열 중 하나가 들어 있는 줄(대소문자 무시). 빌드가 방언별 줄 번호로 푼다 */
const ReviewLineRefSchema = z.object({
  match: z.array(z.string()).min(1),
  /** 이 방언에서만 해당한다. 없으면 세 방언 모두 */
  dialects: z.array(DialectSchema).optional(),
  /** 빌드가 채운다. 1부터 */
  lines: z.partialRecord(DialectSchema, z.array(z.number())).default({}),
});

export const ReviewDefectSchema = ReviewLineRefSchema.extend({
  category: ReviewCategorySchema,
  title: z.string(),        // 한 줄 요약: "여러 번 산 사용자를 주문 수만큼 셈"
  explanation: z.string(),  // 왜 틀렸고 결과가 어떻게 달라졌고 어떻게 고치는지
});

/** 의심스러워 보이지만 맞는 줄. 표시하면 오탐으로 세고, 정답 공개 때 이유를 보여 준다 */
export const ReviewDecoySchema = ReviewLineRefSchema.extend({ explanation: z.string() });

export const ReviewSchema = z.object({
  sql: z.partialRecord(DialectSchema, z.string()),
  defects: z.array(ReviewDefectSchema).min(1),
  decoys: z.array(ReviewDecoySchema).default([]),
  /** 빌드가 방언별로 sql 을 실행해 채운다. anomalyRows 는 정답 결과에 없는 행 인덱스 */
  results: z.partialRecord(DialectSchema, z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(CellSchema)),
    anomalyRows: z.array(z.number()),
  })).default({}),
});

// ProblemSchema 에 review: ReviewSchema.optional()
// SetCategorySchema 에 "review" 추가, SET_CATEGORY_LABEL.review = "쿼리 리뷰" (홈에서 KPI 대시보드 다음, 비공개 아카이브 앞)
```

문제 JSON에서 쓰는 기존 필드

- `prompt`: 요청 상황. 누가 무엇을 요청했고 이 쿼리를 어디에 쓰려는지
- `requirements`: 쿼리가 구현해야 하는 지표 정의. 리뷰어가 코드와 대조하는 기준
- `solutions`: 고친 쿼리(3방언). `expected` 는 빌드가 이것으로 채운다
- `hints`, `explanation`(결과 / 조회 기준 / 인사이트), `dialectNotes`, `tags`

설계 결정

- 줄 번호 대신 `match` 문자열로 지정한다. 양식 통일(`format-sql`)이 줄을 다시 나눠도, 방언마다 줄 구성이 달라도 빌드가 매번 다시 찾는다.
- 결과를 방언별로 둔다. 정수 나눗셈처럼 PostgreSQL에서만 결함인 경우가 있어서다(같은 코드가 BigQuery·MySQL에서는 소수로 나온다). 그 결함은 `dialects: ["postgres"]` 로 표시하고, 다른 방언에서는 같은 줄을 `decoys` 에 넣어 "이 방언에서는 맞다"를 설명한다.
- 한 줄에는 결함 하나만 둔다(방언별로 결함·오탐 줄이 겹치지 않게 빌드가 검사). 그래서 줄 하나에 유형 하나만 고르면 된다.

## 3. 결함 유형(채점 체크리스트)

| id           | 화면 라벨   | 대표 실수                        |
|--------------|-------------|----------------------------------|
| fanout       | 조인 팬아웃 | 1:N 조인 뒤 1쪽 값 합산          |
| duplicate    | 중복 집계   | COUNT(*)·DISTINCT 누락           |
| null         | NULL 처리   | NULL·빈 값 그룹, 분모에서 빠짐   |
| int-division | 정수 나눗셈 | 정수끼리 나눠 소수 버림          |
| boundary     | 기간·경계   | BETWEEN 끝 시각, 이상/초과       |
| join         | 조인 조건   | LEFT JOIN 무력화, 키 정규화 누락 |
| definition   | 지표 정의   | 필터·분모·평균의 평균            |

문제 화면 왼쪽 칸에 이 목록을 "리뷰 체크리스트"로 둔다(라벨 + 대표 실수 한 줄). 줄을 표시할 때 고르는 유형도 이 목록이다.

## 4. 채점

사용자 입력은 표시(mark) 목록이다. 표시 하나 = (줄 번호, 유형). 현재 방언 기준으로 채점한다.

판정

- 결함별: 그 결함 줄 중 하나에 같은 유형으로 표시했으면 "찾음", 결함 줄에 다른 유형으로 표시했으면 "유형 다름", 아니면 "놓침".
- 표시별: 결함 줄 + 같은 유형이면 "맞음", 결함 줄 + 다른 유형이면 "유형 다름", 결함 줄이 아니면 "결함 아님"(오탐 줄이면 오탐 설명이 붙는다).
- 통과: 모든 결함을 찾았고 모든 표시가 "맞음". 결과 이상 찾기와 같은 엄격 기준이다.
- 배너 숫자: "결함 3개 중 2개 찾음 · 유형 다름 1줄 · 결함 아님 1줄".

연습 모드 공개 규칙

- 채점하면 내가 표시한 줄마다 맞음 / 유형 다름 / 결함 아님이 붙는다. 놓친 결함은 개수만 보인다. 표시를 고쳐 다시 채점할 수 있다.
- 통과하거나 "정답 보기"를 누르면 전부 공개한다: 결함 줄 강조와 유형, 결함별 설명, 오탐 줄 설명, 올바른 결과, 올바른 쿼리, 해설.

모의 시험 모드: 배너 숫자만 보이고 줄별 판정·정답은 숨긴다(결과 이상 찾기와 같다). `onGraded(pass)` 로 시험 요약에 들어간다.

진행 저장: `ProblemProgress.reviewMarks?: Partial<Record<Dialect, { line: number; category: ReviewCategory }[]>>`. 줄 번호가 방언마다 다르므로 방언별로 둔다. 표시는 바꿀 때마다 저장한다. 검증 쿼리는 저장하지 않는다(12절).

## 5. 화면

문제 화면 3단 구조(문제 / 가운데 / 스키마)와 모바일 탭은 그대로 쓴다. 가운데 칸만 새 컴포넌트 `ReviewProblem` 이 그린다.

```
[PostgreSQL | BigQuery | MySQL]  준비됨
┌ 검토할 쿼리 · 결함이 있는 줄을 누르고 유형을 고르세요      2줄 표시 [채점] ┐
│  1  SELECT                                                                  │
│  2    LOWER(TRIM(u.utm_source)) AS channel,               [NULL 처리]      │
│  3    COUNT(DISTINCT u.user_id) AS signups,                                 │
│  4    COUNT(o.order_id) AS buyers,                         ← 선택 중         │
│     (조인 팬아웃)(중복 집계)(NULL 처리)(정수 나눗셈)(기간·경계)(조인 조건)(지표 정의) 지우기 │
│  5    ...                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
[오답] 결함 3개 중 1개 찾음 · 결함 아님 1줄                          [정답 보기]
┌ 검토 쿼리 결과 9행 | 검증 쿼리 | 올바른 결과* | 올바른 쿼리* ┐   * 공개 후
```

- 검토할 쿼리: 줄 번호가 붙은 읽기 전용 코드. 줄을 누르면 그 줄 아래에 유형 칩이 펼쳐지고, 칩을 고르면 줄 오른쪽에 유형 배지가 붙는다. 다시 누르면 칩 줄이 열리고 "지우기"로 표시를 뺀다. 줄은 버튼(aria-pressed), 칩은 라디오 그룹이다.
- 강조 색: 표시한 줄은 파랑, 채점 뒤 맞음 초록·유형 다름 노랑·결함 아님 빨강, 공개 뒤 놓친 결함 줄은 빨강 테두리.
- 검토 쿼리 결과: 방언별 미리 계산한 결과 표. 공개 뒤에는 정답에 없는 행을 강조한다(결과 이상 찾기와 같은 색).
- 검증 쿼리: 스키마 자동완성이 되는 편집기와 실행 버튼, 결과 표. 채점하지 않는다. "주문 수보다 구매자가 많은가" 같은 확인을 직접 돌려 보는 칸이다.
- 공개 뒤 결함 목록 카드: 유형 배지, 줄 번호, 제목, 설명, 찾음/놓침. 그 아래 오탐 줄 설명, 해설.
- 왼쪽 칸: 기존 문제 패널(상황, 요구 조건 = 지표 정의, 태그, 힌트) 아래에 리뷰 체크리스트.
- 모바일: 긴 코드 줄은 편집기처럼 접히고(배지가 칸 밖으로 밀리지 않게) 칩 줄은 줄바꿈된다.
- 안내 문구는 코드 칸 머리글 한 줄뿐이다.

## 6. 빌드·검증 파이프라인

`scripts/build-expected.ts` (review 분기 추가)

- 방언별로 `review.sql` 을 실행해 `results[d]` 와 `anomalyRows` 를 채운다. MySQL은 `MYSQL_URL` 이 있을 때만(기존과 같음).
- 방언별 검사: 그 방언에 해당하는 결함이 1개 이상, 결과가 정답과 달라야 함, 결과 40행 이하, ORDER BY 필수.
- `match` 를 방언별 줄 번호로 풀어 `lines` 를 채운다. 결함·오탐마다 줄이 1개 이상이어야 하고, 같은 방언 안에서 줄이 서로 겹치면 실패.

`scripts/format-sql.ts`: `review.sql` 을 양식 대상에 넣는다. 양식을 바꾼 뒤 build-expected 를 다시 돌리면 줄 번호가 새로 풀린다.

`scripts/publish-content.ts`: review 문제는 `review.results.postgres` 와 결함마다 `lines.postgres` 가 있어야 게시한다.

오답 진단(`diagnose`)과 진단 평가는 쓰지 않는다(이 형식에는 실행 채점이 없다).

## 7. 샘플 문제 3개

데이터셋은 공개 스키마 `job-marketing`(앱 서비스 마케팅·그로스)로 통일하고 새 세트 하나로 묶는다. 세트는 스키마 하나에 묶이는 구조(세트 화면 잠금·도메인 배지·모의 시험이 `set.schema` 를 씀)라서다. 이 데이터셋에는 utm 값의 NULL·빈 문자열·대소문자 흔들림, 여러 번 구매한 사용자, 클릭 0인 일시중지일, 종료일 NULL 캠페인이 있어 다섯 가지 결함이 모두 결과에 드러난다(PGlite로 데이터 확인함).

- 세트: `review-marketing`, 제목 "마케팅 지표 쿼리 리뷰", category review, practice
- 아래는 승인 때의 스케치다. 실제 배치는 12절(R2·R3 결함이 바뀜).

### R1. 5월 채널별 CTR·CPC (입문)

- 요청: 퍼포먼스 마케터가 5월 채널 리포트에 넣을 CTR·CPC를 뽑아 달라고 함
- 지표 정의: CTR = 클릭 합계 / 노출 합계, CPC = 비용 합계 / 클릭 합계(스키마 지표 정의와 같음)
- 결함
  - 정수 나눗셈(PostgreSQL만): `ROUND(100 * SUM(clicks) / SUM(impressions), 2)` 가 정수로 잘림
  - 지표 정의: `AVG(cost * 1.0 / NULLIF(clicks, 0))` 일별 CPC의 평균
- 오탐 줄: `spend_date BETWEEN '2025-05-01' AND '2025-05-31'`(DATE라 끝 날짜 포함, 맞음), `JOIN campaigns`(1:1, 팬아웃 아님), BigQuery·MySQL에서는 CTR 줄(소수 나눗셈이라 맞음)

### R2. 5월 가입자 채널별 첫 구매 전환율 (중급)

- 요청: 그로스 PM이 5월 가입 코호트의 채널별 구매 전환율을 주간 회의에 쓰려고 함
- 지표 정의: 채널 = 정규화한 utm_source(NULL·빈 값은 organic), 분모 = 5월 가입자, 분자 = paid 주문이 1건 이상인 가입자
- 결함
  - NULL 처리: `LOWER(TRIM(u.utm_source)) AS channel` 이 NULL과 빈 문자열을 따로 묶고 organic 이 없음
  - 중복 집계: `COUNT(o.order_id) AS buyers`(와 같은 식을 쓰는 전환율 줄) 가 여러 번 산 사용자를 주문 수만큼 셈
  - 조인 조건: LEFT JOIN 뒤 `WHERE ... AND o.status = 'paid'` 가 비구매 가입자를 지워 분모가 줄어듦
- 결과에서 보이는 신호: 전환율이 100%를 넘는 채널, 빈 이름 채널 행
- 오탐 줄: `u.signed_up_at < '2025-06-01'`(반열림 구간, 맞음), `COUNT(DISTINCT u.user_id)`

### R3. 5월 종료 캠페인 ROAS (상급)

- 요청: 마케팅 리드가 5월에 끝난 캠페인의 ROAS로 다음 달 예산을 나누려고 함
- 지표 정의: ROAS = 캠페인 귀속 순매출(paid) / 캠페인 광고비, 귀속 = 캠페인 기간(종료일 포함) 안에 가입하고 utm_campaign 이 캠페인과 같은 사용자(대소문자·공백 정규화)
- 결함
  - 조인 팬아웃: 일별 광고비와 가입자·주문을 한 번에 조인해 비용은 주문 수만큼, 매출은 집행일 수만큼 복제(조인 줄 또는 SUM 줄)
  - 조인 조건: `u.utm_campaign = c.campaign_name` 정규화 누락으로 대소문자·공백이 다른 가입자가 빠짐
  - 기간·경계: `u.signed_up_at BETWEEN c.start_date AND c.end_date` 가 종료일 0시에 끝나 종료일 당일 가입자 누락(BigQuery 판은 `TIMESTAMP(c.end_date)` 로 같은 실수)
- 오탐 줄: `c.end_date BETWEEN '2025-05-01' AND '2025-05-31'`(DATE, 맞음), `o.status = 'paid'` 를 ON 에 둔 줄

유형 분포: 팬아웃 1, 중복 집계 1, NULL 1, 정수 나눗셈 1, 기간·경계 1, 조인 조건 2, 지표 정의 1.

태그: `쿼리 리뷰`, `결과 검증` 과 결함별 기존 태그(`조인 팬아웃`, `NULL 처리`, `정수 나눗셈`, `날짜 경계`, `중복 제거`). 기존 태그가 공고 분석의 "정합성과 데이터 품질 검증" 역량에 이미 묶여 있어 검증을 요구하는 공고에서 추천된다. 역량 사전 `problemTags` 에 `쿼리 리뷰` 를 더할지는 eval-jd 8/8 유지를 확인하고 정한다.

## 8. 콘텐츠 반영과 배포 순서 (제약)

확인한 사실

- 앱은 콘텐츠를 운영 DB(`content_item`)에서만 읽는다. 로컬 dev 서버도 같다. 그래서 지금 구조로는 DB에 게시하기 전에는 새 문제를 로컬 화면에서도 볼 수 없다.
- 운영 코드(main)는 `format: "review"`, `category: "review"` 를 모른다. 로더가 모든 행을 zod로 검사하므로, 이 코드가 운영에 배포되기 전에 운영 DB에 리뷰 문제를 게시하면 콘텐츠 로드가 실패해 운영 사이트 전체가 오류가 난다. 순서는 반드시 main 머지·운영 배포 → 콘텐츠 게시다.
- 게시 스크립트는 로컬 `content/` 에 없는 DB 행을 지운다. 운영 게시는 원본 체크아웃 `content/` 에 샘플 파일을 합친 뒤 해야 한다.
- 이 worktree에는 운영 DB를 읽기 전용(SELECT)으로 받아 둔 `content/` 사본이 있다(gitignore 대상, 커밋 안 함).
- Preview 배포가 읽는 `DATABASE_URL` 은 확인하지 못했다(이 worktree는 Vercel 프로젝트에 링크돼 있지 않음). Marketplace Neon 연결 기본값이면 Preview도 운영 DB를 읽는다. 그렇다면 Preview에서는 화면 코드만 배포되고 샘플 문제는 보이지 않는다.

로컬 확인 방법(택1)

- A(추천): 로더에 개발 모드 전용 로컬 읽기를 추가. `NODE_ENV=development` 이고 `CONTENT_SOURCE=local` 일 때만 `content/` 파일을 읽는다. 운영·Preview 빌드에는 영향 없음. 게시 전에 화면을 확인하는 작성 흐름에도 그대로 쓴다. 약 20줄.
- B: Neon 브랜치 DB를 만들어 로컬 `DATABASE_URL` 을 그쪽으로 바꾸고 게시. Neon 리소스 생성이 필요하다.

Preview에서 샘플까지 보려면(택1)

- P1: Neon 브랜치 DB + Vercel Preview 환경변수(브랜치 feat/query-review 한정 `DATABASE_URL`) + 그 브랜치 DB에 게시. Vercel·Neon 설정 변경이라 사용자가 직접 하거나 허락해야 한다.
- P2(추천): Preview는 기존 화면 회귀 확인용으로만 쓰고, 새 형식은 로컬(A)에서 E2E로 확인한다. 샘플은 main 머지·운영 배포 뒤 사용자가 운영 DB에 게시한다.

## 9. 검증 계획

- `npm run typecheck`, `npm run lint`, `npm run build`
- `MYSQL_URL=... npx tsx scripts/build-expected.ts jr-`: 3방언 정답 일치, 방언별 리뷰 결과 차이, 줄 풀이 성공
- `npx tsx scripts/format-sql.ts --check`, `npx tsx scripts/publish-content.ts --dry-run`, `npx tsx scripts/eval-jd.ts`
- E2E 추가(`e2e/flow.spec.ts`): 세트에서 문제 열기 → 결함 줄을 다른 유형으로 표시 → 채점 "오답·유형 다름" → 오탐 줄 표시 → "결함 아님" → 바르게 고쳐 "정답" → 결함 설명·올바른 결과 탭 → 새로고침 후 표시 유지 → BigQuery로 바꾸면 결함 수가 줄어듦(정수 나눗셈 문제). 기존 E2E 전체 재실행(dev 서버 3100, MySQL 포함).
- 브랜치 push 후 Preview: 기존 화면(홈·문제 풀이·오늘의 카드) 동작 확인. 운영 DB에 샘플이 없으면 새 문제는 보이지 않는 것이 정상.

## 10. 바꿀 파일

- 코드: `lib/content/types.ts`, `lib/progress.ts`, `components/workspace/Workspace.tsx`, 새 `components/workspace/ReviewProblem.tsx`, (A 선택 시) `lib/content/loader.ts`
- 스크립트: `scripts/build-expected.ts`, `scripts/format-sql.ts`, `scripts/publish-content.ts`
- 테스트: `e2e/flow.spec.ts`
- 문서: README(형식 목록·문제 작성), `docs/portfolio.md`(형식 6종, 핵심 장면), `BACKLOG.md`(체크), `skills/sql-jd-trainer-authoring/SKILL.md`(review 작성 규칙)
- 콘텐츠(저장소 밖): `content/problems/review/jr-0{1,2,3}-*.json`, `content/sets/review-marketing.json`

## 11. 결정이 필요한 것

1. 로컬 확인 방법: A(개발 모드 로컬 읽기) / B(Neon 브랜치)
2. Preview: P2(새 형식은 로컬 E2E로만, 추천) / P1(Neon 브랜치 + Preview 환경변수, 사용자 작업 필요)
3. 샘플 묶음: 마케팅 데이터셋 한 세트(추천) / 기존 세트 여러 곳에 나눠 넣기
4. 홈에 새 분류 "쿼리 리뷰"를 둘지, 기존 "직무별 실무"에 세트를 넣을지
5. 검증 쿼리 편집기를 이번 범위에 넣을지(추천: 넣음. "결과로 검증" 연습의 핵심)

결정(2026-11-06): 1 A, 2 P2, 3 마케팅 데이터셋 한 세트, 4 홈에 새 분류 "쿼리 리뷰", 5 검증 쿼리 편집기 넣음.

## 12. 구현하며 바뀐 점

- 결함 배치: R3 의 "종료일 당일 가입 누락"은 시드에 종료일 당일 가입자가 없어 결과가 바뀌지 않았다. 기간·경계 결함은 R2(`BETWEEN '2025-05-01' AND '2025-05-31'`, 5월 31일 가입자 2명 누락)로 옮겼다. R3 에는 환불 주문을 매출에 넣는 지표 정의 결함을 넣고, `DATE(가입 시각) BETWEEN 시작일 AND 종료일` 줄은 맞는 줄로 뒀다. R2 의 LEFT JOIN 은 paid 조건을 ON 에 둔 맞는 줄로 바꿨다.
- 최종 분포
  - R1: 정수 나눗셈(PostgreSQL만), 지표 정의(CPC 평균의 평균). 맞는 줄 3(BigQuery·MySQL 의 CTR 줄 포함)
  - R2: NULL 처리, 중복 집계, 기간·경계. 맞는 줄 2
  - R3: 조인 팬아웃, 조인 조건(키 정규화 누락 + INNER JOIN 으로 매출 없는 캠페인 누락), 지표 정의(환불 포함). 맞는 줄 2
- MySQL 기본 콜레이션이 대소문자를 무시해 R3 의 MySQL 결과는 PostgreSQL·BigQuery 와 다르다(끝 공백 차이만 드러남). 방언 메모에 적었다.
- PostgreSQL 판은 `DATE(x)` 대신 `x::date` 로 쓴다. 양식 통일이 PG 의 `DATE(x)` 를 `DATE (x)` 로 바꾼다.
- 검증 쿼리는 저장하지 않는다. 표시를 바꿀 때마다 진행 저장소가 갱신되는데, 같은 저장소에서 검증 쿼리를 다시 읽으면 실행 전 입력이 지워진다.
- 홈 분류 순서: 기초 문법, 직무별 실무, KPI 대시보드, 쿼리 리뷰, 비공개 복습 아카이브. 홈 분류 E2E 의 기대 목록도 이 순서로 바꿨다.
