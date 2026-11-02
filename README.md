# SQL JD Trainer

데이터 분석가 라이브 쿼리 테스트를 대비하는 SQL 연습 도구. 실무형 마트에서 지표를 정의하고 쿼리로 구현하며, PostgreSQL · BigQuery · MySQL 중 하나를 골라 브라우저에서 바로 실행하고 결과 집합 비교로 즉시 채점한다.

배포: https://sql-jd-trainer.vercel.app

## 기능

- 문제 세트: 연습 세트(20문제), 학습 포맷 드릴(9문제), 타이머가 있는 모의 시험 세트(6문제)
- 문제 형식: 쿼리 작성, 깨진 쿼리 고치기(시작 쿼리 제공), 객관식, 출력 예측(입력 표와 쿼리를 보고 결과 입력), 결과 이상 찾기(잘못된 쿼리 결과에서 틀린 행 선택)
- 오답 진단: 문제별 오답 패턴 해시(문제당 2~3개)를 먼저 대조하고, 없으면 NULL·정수 나눗셈·정렬·행 수 규칙으로 라벨을 낸다
- 실행 엔진
  - PostgreSQL: PGlite(브라우저 WASM)
  - BigQuery: DuckDB-WASM + BigQuery 방언 변환(`lib/engine/bq-shim.ts`)
  - MySQL: 서버 Route Handler가 원격 MySQL에서 읽기 전용 실행
- 채점: 정답 결과 집합과 비교(순서·허용 오차·NULL 정규화). 미리 계산한 오답 패턴 해시와 행 수 규칙으로 원인을 진단
- 해설: 결과 · 조회 기준 · 인사이트 구조, 방언별 정답 쿼리와 메모, 자주 나오는 오답
- 진행 상태: 방언별 마지막 쿼리와 통과 여부를 localStorage에 저장

## 개발

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run typecheck
```

MySQL 모드를 로컬에서 쓰려면 환경변수 `MYSQL_URL`(예: `mysql://user:pass@host:3306/`)을 주고 실행한다. TLS가 필요한 호스팅(TiDB Serverless 등)은 `MYSQL_SSL=1`을 추가한다. 환경변수가 없으면 UI에 미연결 안내가 뜨고 나머지 두 방언은 정상 동작한다.

로컬 검증용 MySQL:

```bash
docker run -d --name sjt-mysql -e MYSQL_ROOT_PASSWORD=sjt -p 3307:3306 mysql:8.4
MYSQL_URL='mysql://root:sjt@127.0.0.1:3307/' npm run dev
```

## 문제 작성

```
content/schemas/<id>.json      방언 중립 시드 (scripts/gen-schema.ts 가 생성)
content/problems/<group>/*.json 문제 본문, 방언별 정답, 기대 결과, 오답 패턴, 해설
content/sets/*.json             세트 구성 (practice | mock)
```

정답 쿼리를 바꾸거나 문제를 추가하면 기대 결과를 다시 만든다. 세 방언의 결과가 같은지, 오답 패턴이 정답과 구분되는지 함께 검사한다.

```bash
npx tsx scripts/gen-schema.ts                    # 시드 재생성
MYSQL_URL=... npx tsx scripts/build-expected.ts  # 전체. 뒤에 문제 ID 접두사를 주면 일부만
npx tsx scripts/eval-diagnose.ts                 # 오답 진단 적중률(content/eval/wrong-queries.json, 목표 80%)
```

## 검증

```bash
npx playwright test                       # 로컬 dev 서버(포트 3100) 대상 E2E
E2E_BASE_URL=https://... npx playwright test e2e/prod-smoke.spec.ts
node e2e/screenshots.mjs                  # 화면 캡처 -> e2e/shots/
```

E2E는 `npx next dev -p 3100`이 떠 있어야 하며, MySQL 시나리오는 `MYSQL_URL`을 준 dev 서버가 필요하다.

## 문서

- `docs/PLAN.md`: 개선 플랜, 요구사항, 로드맵
- `docs/research/`: 전형 조사, JD 코퍼스, 엔진·경쟁 서비스 조사, 학습 포맷

## 라이선스

CC BY-NC 4.0. 개인 학습·연구 목적은 자유롭게 이용할 수 있고 상업적 이용은 금지한다.
https://creativecommons.org/licenses/by-nc/4.0/
