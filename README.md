# SQL JD Trainer

데이터 분석가 라이브 쿼리 테스트를 대비하는 SQL 연습 도구. 실무형 마트에서 지표를 정의하고 쿼리로 구현하며, PostgreSQL · BigQuery · MySQL 중 하나를 골라 브라우저에서 바로 실행하고 결과 집합 비교로 즉시 채점한다.

배포: https://sql-jd-trainer.vercel.app

## 기능

- 문제 280개(세트 30개 + 세트 밖 유형 전용 문제 101개)
  - 기초 문법 10개: 조회·집계·NULL·CASE·JOIN(쇼핑몰 데이터), 문자열·날짜·서브쿼리·윈도우·숫자/집합(공공자전거 대여 데이터)
  - 직무별 실무 7개: 마케팅, 그로스/PM, 영업, 인사, CS/운영, 물류/SCM, 재무
  - 숙박 예약 3개: 집계값 붙이기와 순위, JOIN과 날짜, 모의 시험 60분(4문항). MySQL 코딩테스트 대비용
  - 유형 전용 문제: 세트에는 넣지 않고 유형 탭에서만 푸는 반복 연습 문제(기초 문법 36, 패턴·함수 65)
  - KPI 대시보드 2개: Placewave 마트에서 개요 스코어보드, 퍼널·리텐션·마케팅 효율 카드 재현
  - 쿼리 리뷰 1개: 마케팅 지표(CTR·CPC, 가입 전환율, ROAS) 쿼리에 심은 결함 찾기
  - 비공개 복습 아카이브 3개: 개인 복습용. 비밀번호(`UNLOCK_PASSWORD`)로 잠겨 있다
- 탭: 오늘(카드와 문제 복습) / 코스(분류 → 세트 → 순서) / 유형(패턴·함수·기초 문법별 묶음) / 공고
- 유형(`/skills`): 문제의 `skills` 로 묶은 유형별 문제 목록. 난이도(입문·중급·상급)로 나눠 보이고, 유형에서 연 풀이는 머리와 이전·다음이 그 유형 기준으로 움직인다(`?skill=`). 함수 유형은 문법 형태를 함께 보여 준다
- 문제 복습: 문제를 통과하면 그 문제의 대표 유형(`skills[0]`)에 다음 복습 날짜가 잡힌다(1·3·7·14·30일, 복습 때 틀리면 처음 간격으로). 날짜가 지난 유형은 오늘 탭에 올라오고, 그 유형에서 틀린 문제 → 안 푼 문제 → 통과한 지 오래된 문제 순으로 한 문제를 준다. 이미 통과한 문제는 빈칸 채우기로 연다
- 빈칸 채우기(`?mode=blank`): 정답 쿼리에서 `blanks` 로 지정한 자리를 가리고, 채운 쿼리를 실행해 결과로 채점한다. 글자가 달라도 결과가 같으면 통과
- 오늘의 카드(`/daily`): 함수 이름·함수 인자 빈칸을 채우는 카드 119장(10개 덱, 방언별 카드 포함). 빈칸은 정답 글자 수만큼 보인다. 하루 목표 n장, 틀린 카드는 5분 뒤 다시, 맞힌 카드는 1·3·7·14·30일 간격으로 복습. 새 카드는 자주 쓰는 카드 위주이고 응용 카드는 4장에 1장꼴로 섞인다. 풀고 나면 그 카드의 함수 문법(방언별 형태와 차이)이 함께 보인다. 기록은 localStorage
- PWA와 알림: 홈 화면에 설치할 수 있고, 알림을 켜면 매일 오전 9시 무렵(Vercel Cron, 00:00 UTC) Web Push 로 오늘의 카드를 알린다. iOS 는 홈 화면에 추가한 앱에서만 알림을 받는다
- 문제 형식: 쿼리 작성, 깨진 쿼리 고치기(시작 쿼리 제공), 객관식, 출력 예측(입력 표와 쿼리를 보고 결과 입력), 결과 이상 찾기(잘못된 쿼리 결과에서 틀린 행 선택), 쿼리 리뷰(그럴듯한 쿼리에서 결함이 있는 줄을 고르고 유형을 붙임)
- 쿼리 리뷰 채점: 결함 유형 체크리스트 7종(조인 팬아웃, 중복 집계, NULL 처리, 정수 나눗셈, 기간·경계, 조인 조건, 지표 정의)으로 줄마다 맞음·유형 다름·결함 아님을 판정한다. 결함을 모두 찾고 오탐이 없어야 통과. 검토 쿼리의 방언별 결과 표와 채점 없는 검증 쿼리 편집기가 함께 있다. 정수 나눗셈처럼 방언에 따라 결함 여부가 달라지는 줄은 방언별로 채점한다
- 오답 진단: 문제별 오답 패턴 해시(문제당 2~3개)를 먼저 대조하고, 없으면 NULL·정수 나눗셈·정렬·행 수 규칙으로 라벨을 낸다
- 실행 엔진
  - PostgreSQL: PGlite(브라우저 WASM)
  - BigQuery: DuckDB-WASM + BigQuery 방언 변환(`lib/engine/bq-shim.ts`)
  - MySQL: 서버 Route Handler가 원격 MySQL에서 읽기 전용 실행
- 채점: 정답 결과 집합과 비교(순서·허용 오차·NULL 정규화). 미리 계산한 오답 패턴 해시와 행 수 규칙으로 원인을 진단
- 해설: 결과 · 조회 기준 · 인사이트 구조, 방언별 정답 쿼리와 메모, 자주 나오는 오답
- 진행 상태: 방언별 마지막 쿼리와 통과 여부를 localStorage에 저장
- 공고 분석(`/jd`): 채용 공고 본문을 붙여넣으면 역량 키워드 사전(`content/jd/competencies.json`)으로 요구 역량을 찾고, 문제 태그와 겹치는 문제를 추천한다. 잠긴 세트 문제는 추천하지 않는다. 추천 문제는 버튼 하나로 모의 시험(`/mock/jd`)으로 바로 풀 수 있다. 추천 순서대로 앞 6문제, 제한 시간은 그 권장 시간 합과 60분 중 작은 값(목록은 localStorage에 저장). AI 호출 없음
- 콘텐츠 저장: 문제·세트·시드·카드·카드 문법은 운영 DB(Neon Postgres, `content_item`)에 있고 저장소에는 없다. 앱은 `use cache`(태그 `content`)로 읽는다

## 개발

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run typecheck
```

환경변수(`.env.local`, Vercel 프로젝트에도 같은 이름으로 둔다)

- `DATABASE_URL`: 콘텐츠 DB(Neon, Vercel Marketplace 연결 시 자동 추가). 없으면 빌드·실행이 멈춘다
- `UNLOCK_PASSWORD`: 잠긴 세트 비밀번호. 없으면 잠긴 세트는 열리지 않는다
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: 알림 구독 저장소(Upstash Redis, Vercel Marketplace 연결 시 자동 추가)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: Web Push 키. `npx web-push generate-vapid-keys` 로 만든다
- `CRON_SECRET`: Vercel Cron 이 `/api/cron/daily-push` 를, 게시 스크립트가 `/api/content/revalidate` 를 부를 때 쓰는 비밀값
- `MYSQL_URL`, `MYSQL_SSL`, `MYSQL_CA`, `NEXT_PUBLIC_MYSQL`: 아래 MySQL 모드

MySQL 모드를 로컬에서 쓰려면 환경변수 `MYSQL_URL`(예: `mysql://user:pass@host:3306/`)을 주고 실행한다. TLS가 필요한 호스팅(TiDB Serverless 등)은 `MYSQL_SSL=1`을 추가한다. 자체 인증 기관을 쓰는 호스팅(Aiven 등)은 CA 인증서(PEM)를 `MYSQL_CA` 에 넣는다. 화면의 방언 선택에 MySQL 을 보이려면 `NEXT_PUBLIC_MYSQL=1` 을 함께 준다(빌드 시점 값). 없으면 MySQL 은 화면에 나오지 않고 나머지 두 방언은 정상 동작한다.

로컬 검증용 MySQL:

```bash
docker run -d --name sjt-mysql -e MYSQL_ROOT_PASSWORD=sjt -p 3307:3306 mysql:8.4
MYSQL_URL='mysql://root:sjt@127.0.0.1:3307/' NEXT_PUBLIC_MYSQL=1 npm run dev
```

## 문제 작성

콘텐츠는 로컬 `content/` 에서 작성·검증하고 운영 DB 에 게시한다. 아래 경로 중 `content/jd`, `content/eval/jd-samples.json` 만 저장소에 있고 나머지는 `.gitignore` 대상이다.

```
content/schemas/<id>.json      방언 중립 시드 (content/generators/gen-schema-<id>.ts 가 생성)
content/problems/<group>/*.json 문제 본문, 방언별 정답, 기대 결과, 오답 패턴, 해설
content/sets/*.json             세트 구성 (practice | mock, category basics | job | kpi | archive)
content/cards/*.json            오늘의 카드 덱 (빈칸 ___ 하나, 테이블 없이 실행되는 SQL, level core | applied, syntax 문법 id)
content/syntax/*.json           카드 풀이 뒤에 보여 주는 함수·구문 문법 (방언별 형태)
content/skills/*.json           유형 사전 (shelf pattern | function | basics, 함수 유형은 syntax 문법 id)
content/jd/competencies.json    공고 분석용 역량 사전 (keywords -> problemTags)
```

스키마에 `locked: true` 를 두면 그 스키마의 세트·문제·MySQL 실행이 비밀번호 뒤로 간다.

문제의 `skills` 는 유형 탭의 묶음이다. 첫 번째가 대표 유형(복습 간격의 기준)이고, 세트에 넣지 않은 문제도 유형에서 풀 수 있다. `blanks` 는 방언별로 정답 쿼리에 정확히 한 번 나오는 글 목록이다(게시 검사가 확인한다).

문제의 `tags`는 공고 분석 추천의 근거가 된다. 새 태그를 만들면 역량 사전의 `problemTags`에도 넣을지 검토한다.

게시 전 화면 확인은 `CONTENT_SOURCE=local npx next dev -p 3100` 으로 한다. 개발 모드에서만 DB 대신 로컬 `content/` 를 읽고(운영·Preview 빌드는 항상 DB), 파일을 고친 뒤에는 dev 서버를 다시 띄운다. 새 문제 형식·분류를 쓰는 콘텐츠는 그 코드가 운영에 배포된 뒤에 게시한다. 운영 코드가 모르는 값이 DB 에 들어가면 콘텐츠 로드가 실패한다.

파이프라인 문제(`script` 필드, 분류 kpi)는 여러 문장 스크립트를 PostgreSQL·BigQuery 로만 실행한다(MySQL 없음).

- 머리 구획: `-- A.` 로 시작하는 줄부터 `-- B.` 로 시작하는 첫 줄 앞까지. 채점은 이 구획을 `solutions` 원본으로 바꿔 끼워 돌린다
- `script.probes`: 스크립트 뒤 같은 트랜잭션에서 돌리는 확인 조회(두 방언 공용). 없으면 마지막 조회 문장으로 채점
- `script.variants`: 머리 구획 대체본. 각각 다시 돌려 채점한다(본문에 값을 박으면 틀린다)
- `script.runTwice`: 머리 1번 + 본문 2번 실행 뒤 채점(재실행 안전 적재)
- 허용 문장: SELECT·WITH·VALUES·CREATE [OR REPLACE] [TEMP] TABLE·INSERT·DELETE·UPDATE·DROP TABLE·TRUNCATE, BigQuery 는 DECLARE·SET(값 치환). 트랜잭션 제어 등은 거부. BigQuery 변수 이름은 스키마 컬럼과 겹치면 안 된다
- 실행이 끝나면 모든 변경을 되돌린다. 실행기·채점 확인: `npx tsx scripts/check-engine.ts`

정답 쿼리를 바꾸거나 문제를 추가하면 기대 결과를 다시 만든다. 세 방언의 결과가 같은지, 오답 패턴이 정답과 구분되는지 함께 검사한다.

```bash
npx tsx content/generators/gen-schema-<id>.ts    # 시드 재생성
MYSQL_URL=... npx tsx scripts/build-cards.ts     # 카드 빈칸에 정답을 넣어 실행하고 result 를 채운다
npx tsx scripts/format-sql.ts                    # 화면에 보이는 예시 SQL 양식 통일 (--check 로 검사만)
MYSQL_URL=... npx tsx scripts/build-expected.ts  # 전체. 뒤에 문제 ID 접두사를 주면 일부만
npx tsx scripts/eval-diagnose.ts                 # 오답 진단 적중률(content/eval/wrong-queries.json, 목표 80%)
npx tsx scripts/eval-jd.ts                       # 공고 역량 매핑 평가(content/eval/jd-samples.json, 전부 통과해야 함)
npx tsx scripts/publish-content.ts --dry-run     # 게시 전 검증만
npx tsx scripts/publish-content.ts --revalidate https://sql-jd-trainer.vercel.app  # DB 반영과 캐시 무효화
```

## 검증

```bash
npx playwright test                       # 로컬 dev 서버(포트 3100) 대상 E2E
E2E_BASE_URL=http://localhost:3137 npx playwright test  # 다른 포트의 dev 서버 대상
E2E_BASE_URL=https://... npx playwright test e2e/prod-smoke.spec.ts
node e2e/screenshots.mjs                  # 화면 캡처 -> e2e/shots/
```

E2E는 `npx next dev -p 3100`이 떠 있어야 하며(게시 전 콘텐츠로 돌릴 때는 `CONTENT_SOURCE=local` 을 준다), MySQL 시나리오는 `MYSQL_URL`을 준 dev 서버가 필요하다. 잠긴 세트는 `.env.local` 의 `UNLOCK_PASSWORD` 로 화면에서 연다(playwright.config 가 읽는다).

- `e2e/flow.spec.ts`: 문제 풀이·포맷·모의 시험·쿼리 리뷰·공고 분석·공고 추천 모의 시험
- `e2e/daily-lock.spec.ts`: 홈 분류, 잠금 해제, 오늘의 카드(모바일 폭) 오답 재출제, 풀이 뒤 문법 표시, 응용 카드 비중, 기록 유지
- `e2e/skills.spec.ts`: 탭 구성, 유형에서 풀기와 복습 날짜, 오늘의 문제 복습, 코스의 풀던 문제, 빈칸 채우기
- `e2e/schemas.spec.ts`: 잠기지 않은 스키마마다 한 문제를 브라우저 엔진 세 방언으로 채점

## 문서

- `docs/research/03-engine-and-landscape.md`: 실행 엔진·유사 서비스 조사
- `docs/portfolio.md`: 포트폴리오용 정리(핵심 장면, 사용자 흐름, 화면 목록, 구현)

## 라이선스

CC BY-NC 4.0. 개인 학습·연구 목적은 자유롭게 이용할 수 있고 상업적 이용은 금지한다.
https://creativecommons.org/licenses/by-nc/4.0/
