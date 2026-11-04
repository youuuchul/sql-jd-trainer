---
name: sql-jd-trainer-authoring
description: SQL JD Trainer 문제·시드 작성과 검증 절차 (content JSON 구조, 3방언 정답, 오답 패턴, build-expected 실행).
---

# 문제 작성과 검증

## 구조
- 콘텐츠(`content/problems`, `sets`, `schemas`, `cards`, `generators`)는 저장소에 두지 않는다. 로컬에서 작성·검증하고 `scripts/publish-content.ts` 로 운영 DB 에 게시한다.
- `content/schemas/<id>.json`: 방언 중립 시드. 직접 고치지 말고 생성기 `content/generators/gen-schema-<id>.ts`(공용 유틸 `scripts/seed-utils.ts`)를 고친 뒤 다시 만든다. 전체 3,000행 안쪽. `locked: true` 면 비밀번호 뒤로 간다.
- `content/problems/<group>/<id>.json`: 아래 키를 채운다.
  - id, schema, title, sourceType(expected|domain|jd), format(write|fix|mcq|predict|spot), difficulty(basic|intermediate|advanced), tags
  - prompt, requirements[], hints[], timeLimitMin
  - solutions{postgres, bigquery, mysql} (mcq 제외), starterSql(fix 전용)
  - expected{ordered} 만 쓰고 columns/rows는 빌드가 채운다
  - wrongPatterns[{label, explanation, sql{postgres}}]: resultHash는 빌드가 채운다. 문제당 2~3개, 시드 함정 행이 드러나는 실수로 만든다
  - predict(출력 예측): input{title, sql{postgres}} 에 보여줄 입력 표 쿼리(1~30행), solutions 에 예측 대상 쿼리. 입력 표만 보고 결과를 셀 수 있어야 하므로 같은 필터를 쓴다
  - spot(결과 이상 찾기): spot{sql{postgres,bigquery,mysql}} 에 잘못된 쿼리(ORDER BY 필수, 40행 이하), solutions 에 올바른 쿼리. 빌드가 spot.rows 와 anomalyRows(정답에 없는 행)를 채운다. 틀린 값이 행으로 남는 실수(팬아웃, COUNT(*), 경계 누락)를 고른다. 행이 통째로 빠지는 실수는 고를 행이 없어 부적합
  - explanation: "결과 / 조회 기준 / 인사이트" 세 줄로 시작하고 풀이 핵심을 덧붙인다
  - dialectNotes{postgres, bigquery, mysql}
- `content/sets/<id>.json`: problems 배열에 id를 넣는다. category(basics|job|kpi|archive)와 order 를 둔다. mock 세트는 timeLimitMin을 둔다.
- `content/cards/<번호>-<주제>.json`: 오늘의 카드 덱. 카드마다 dialect(common|postgres|bigquery|mysql), prompt, template(빈칸 `___` 정확히 1개, 테이블 없이 리터럴·CTE로 실행, 6줄·48자 이하), answers(첫 번째가 대표 답), caseSensitive, hint, explanation. result 는 `scripts/build-cards.ts` 가 채운다. common 은 세 방언 결과가 같아야 한다.
- 결과 해시는 행을 정렬해 만든다. 정렬 순서만 틀리는 실수는 오답 패턴으로 구분되지 않으니 패턴 대신 해설의 "자주 하는 실수"에 적는다(채점 시 "정렬 조건" 규칙이 잡는다).

## 방언 규칙
- BigQuery 정답은 BigQuery 문법으로 쓴다. DuckDB 변환은 `lib/engine/bq-shim.ts`가 맡는다. 지원 목록에 없는 함수는 shim에 추가한다.
- BigQuery에서 TIMESTAMP와 DATE를 바로 비교하지 않는다. `DATE(paid_at)`으로 맞춘다.
- PostgreSQL 정수 나눗셈은 `::numeric` 캐스팅으로 피한다.

## SQL 양식
화면에 보이는 SQL(카드 template, 문제 solutions·starterSql·spot.sql)은 `npx tsx scripts/format-sql.ts` 로 맞춘다. 키워드·함수 대문자, 2칸 들여쓰기, 절마다 새 줄, SELECT 항목이 둘 이상이면 한 줄에 하나, JOIN·AND/OR 는 들여쓴 새 줄, CTE 본문 들여쓰기, 리터럴 데이터 행은 `UNION ALL SELECT ...` 한 줄. 문제·카드를 추가하거나 고친 뒤 실행하고 `--check` 가 "바뀔 파일 없음"이어야 한다. 포맷은 공백·대소문자만 바꾸므로 build-expected·build-cards 결과가 그대로여야 한다.

## 검증
```bash
MYSQL_URL='mysql://root:sjt@127.0.0.1:3307/' npx tsx scripts/build-expected.ts <id 접두사...>
```
- 세 방언 모두 "일치"여야 한다. "정답과 같은 결과" 경고가 뜨면 오답 패턴이 데이터에서 구분되지 않는 것이다. 패턴을 바꾸거나 시드에 함정 행을 추가한다.
- 로컬 MySQL은 README의 docker 명령으로 띄운다.
- 공고 역량 매핑: `npx tsx scripts/eval-jd.ts`. content/jd/competencies.json 의 problemTags 는 실제 문제 tags 와 겹쳐야 하며, content/eval/jd-samples.json 의 expected/unexpected 역량이 모두 맞아야 한다. 문제 tags 를 새로 만들면 역량 사전에 넣을지 검토한다.
- 오답 진단 적중률: `npx tsx scripts/eval-diagnose.ts`. content/eval/wrong-queries.json 에 wrongPatterns와 다른 형태로 같은 실수를 저지른 쿼리와 기대 라벨을 둔다. 목표 80% 이상.
- 카드: `MYSQL_URL=... npx tsx scripts/build-cards.ts` 가 "모두 통과 (N장)".
- 여러 스키마를 한 번에 돌릴 때는 접두사를 여러 개 준다: `build-expected.ts ba bb ja jb k-`. 파일명 접두사로 거르므로 작업 중인 다른 파일을 건드리지 않는다.
- 게시: `npx tsx scripts/publish-content.ts --dry-run` 으로 검증한 뒤 `--revalidate https://sql-jd-trainer.vercel.app` 로 DB 반영과 캐시 무효화. 로컬 dev 도 같은 DB 를 읽으므로 화면 확인 전에 게시한다.
- UI 확인은 `npx next dev -p 3100` 후 `npx playwright test`. 새 스키마는 `e2e/schemas.spec.ts` 가 자동으로 한 문제씩 브라우저에서 채점한다.
