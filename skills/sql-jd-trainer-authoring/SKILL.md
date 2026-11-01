---
name: sql-jd-trainer-authoring
description: SQL JD Trainer 문제·시드 작성과 검증 절차 (content JSON 구조, 3방언 정답, 오답 패턴, build-expected 실행).
---

# 문제 작성과 검증

## 구조
- `content/schemas/<id>.json`: 방언 중립 시드. 직접 고치지 말고 `scripts/gen-schema.ts`를 수정한 뒤 `npx tsx scripts/gen-schema.ts`.
- `content/problems/<group>/<id>.json`: 아래 키를 채운다.
  - id, schema, title, sourceType(expected|domain|jd), format(write|fix|mcq), difficulty(basic|intermediate|advanced), tags
  - prompt, requirements[], hints[], timeLimitMin
  - solutions{postgres, bigquery, mysql} (mcq 제외), starterSql(fix 전용)
  - expected{ordered} 만 쓰고 columns/rows는 빌드가 채운다
  - wrongPatterns[{label, explanation, sql{postgres}}]: resultHash는 빌드가 채운다
  - explanation: "결과 / 조회 기준 / 인사이트" 세 줄로 시작하고 풀이 핵심을 덧붙인다
  - dialectNotes{postgres, bigquery, mysql}
- `content/sets/<id>.json`: problems 배열에 id를 넣는다. mock 세트는 timeLimitMin을 둔다.

## 방언 규칙
- BigQuery 정답은 BigQuery 문법으로 쓴다. DuckDB 변환은 `lib/engine/bq-shim.ts`가 맡는다. 지원 목록에 없는 함수는 shim에 추가한다.
- BigQuery에서 TIMESTAMP와 DATE를 바로 비교하지 않는다. `DATE(paid_at)`으로 맞춘다.
- PostgreSQL 정수 나눗셈은 `::numeric` 캐스팅으로 피한다.

## 검증
```bash
MYSQL_URL='mysql://root:sjt@127.0.0.1:3307/' npx tsx scripts/build-expected.ts <id 접두사...>
```
- 세 방언 모두 "일치"여야 한다. "정답과 같은 결과" 경고가 뜨면 오답 패턴이 데이터에서 구분되지 않는 것이다. 패턴을 바꾸거나 시드에 함정 행을 추가한다.
- 로컬 MySQL은 README의 docker 명령으로 띄운다.
- UI 확인은 `npx next dev -p 3100` 후 `npx playwright test`.
