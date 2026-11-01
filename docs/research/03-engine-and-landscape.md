# 03. 엔진 선택 및 경쟁 환경 조사

작성일: 2026-11-01
방법: WebSearch(standard) 위주. `[확인]` = 검색 결과로 근거 확보, `[추정]` = 학습 지식 기반이며 도입 전 재확인 필요.
검색으로 확인하지 못한 항목은 "미확인"으로 표기했다.

---

## Part A. 멀티 방언 SQL 실행 옵션

### A-1. 브라우저 WASM 엔진

#### PGlite (electric-sql)
- 정의: PostgreSQL 실제 코드를 WASM으로 빌드한 임베디드 Postgres (단일 사용자 모드).
- 방언 충실도: PostgreSQL 거의 100%. DATE_TRUNC, DISTINCT ON, 윈도우, 재귀 CTE, ARRAY, JSONB 동작. 확장 일부(pgvector 등) 지원.
- 용량/로드: npm 패키지 약 3.7MB gzip 수준 [확인: 0.3.7 기준, unpkg 설명]. 최초 로드 후 브라우저 캐시. 초기화 1~3초대 [추정].
- 라이선스: Apache-2.0 / PostgreSQL License [추정].
- 유지보수: 활발. 0.5.4가 2026-07-04 [확인: mvnpm 미러, npm 원본 재확인 필요].
- 한계: 1 연결(단일 프로세스), 메모리 사용량 큼, 0.x 버전이라 API 변동 가능.
- 비용: 0 (클라이언트 실행).

#### DuckDB-WASM
- 정의: 분석용 인프로세스 컬럼나 DB의 WASM 빌드.
- 방언 충실도: PostgreSQL 계열 문법에 가깝고 QUALIFY, `GROUP BY ALL`, `SELECT * EXCLUDE`, 리스트/STRUCT/UNNEST 지원. BigQuery 문법과 겹치는 부분이 많음(QUALIFY, STRUCT, UNNEST, `SAFE_` 없음). DATE_TRUNC, STRFTIME 제공.
- 용량/로드: WASM 바이너리가 수 MB~수십 MB(unpacked 141MB는 다중 번들 포함) [확인: npm 페이지]. JS 래퍼는 약 44KB gzip [확인: depscope]. 실제 다운로드는 eh 번들 약 6~10MB [추정].
- 라이선스: MIT.
- 유지보수: 활발. 다만 버전 표기 출처마다 불일치(npm 1.30.0 / 공식 문서 1.5.5) [확인: 불일치]. 과거 악성 릴리스 사고 언급 있음 [확인: 2차 출처, 사실 확인 필요] - 버전 고정 필수.
- 한계: COOP/COEP 없이도 동작하나 일부 기능(멀티스레드)은 헤더 필요. 모바일 메모리 부담.
- 비용: 0.

#### sql.js (SQLite)
- 정의: SQLite WASM 빌드.
- 방언 충실도: SQLite 방언. MySQL/PG/BQ 어느 것과도 다름. 윈도우 지원(3.25+), 재귀 CTE 지원. DATE_TRUNC, DATEDIFF, 정규식, ARRAY 없음. strftime만.
- 용량/로드: wasm 약 0.6~1MB [추정]. 가장 가벼움.
- 라이선스: MIT (SQLite는 public domain).
- 유지보수: 안정적 [추정].
- 한계: 방언 학습 목적으로는 부적합. 단순 스키마 검증/채점용 보조로만.
- 비용: 0.

#### AlaSQL (현재 엔진)
- 정의: 순수 JS SQL 엔진 (WASM 아님), NoSQL/JSON 질의 지향.
- 방언 충실도: MySQL 비호환 다수.
  - 윈도우 함수(`OVER (PARTITION BY ...)`) 미지원 또는 불완전 [확인: Retool 커뮤니티, #1216 요청 이슈 / 최신 상태 미확인].
  - DATE_FORMAT, DATEDIFF, DATE_ADD, INTERVAL 산술 등 MySQL 날짜 함수 부재 또는 의미 상이 [추정].
  - NOW() 포맷이 MySQL 모사 문자열이라 Safari/Firefox에서 문제 → v2.0.1에서 수정 [확인: 이슈 #1287].
  - 재귀 CTE, LATERAL, 정규식 함수, 엄격한 타입/NULL 정렬 규칙 차이 [추정].
  - 중복 DB 생성 오류(현 repo 최근 커밋에서 무시 처리).
- 용량: 약 0.3~0.6MB min [추정].
- 라이선스: MIT. 유지보수: 릴리스 간격 길어짐 [추정].
- 결론: JD 기반 DA 실무 SQL(윈도우, DATE_TRUNC 등) 연습에는 부적합. 교체 대상.

#### MySQL-in-WASM
- 실제 컴파일된 MySQL WASM은 확인되지 않음 [확인: 검색 결과 없음].
  - gitee `mysql-wasm`: v86(x86 에뮬레이터)에 Linux 이미지로 MySQL 부팅. 수십 MB 이미지, 부팅 느림, 별 0개 수준의 실험작 [확인].
  - TiDB의 Wasm 컴파일은 2019년 실험(고루틴/스토리지 한계)으로 사실상 중단 [확인: DZone 2019].
  - Dolt, MariaDB, Vitess WASM: 검색에서 미확인. 실사용 가능한 공개 빌드 없다고 가정.
- MySQL 근사 대안:
  - (1) 호스티드 MySQL 호환 DB(TiDB Starter) 사용.
  - (2) DuckDB/PGlite에서 MySQL 함수 일부를 shim(예: DATE_FORMAT 매크로) - 충실도 낮음, 비추천.
  - (3) MySQL 문법 파서(node-sql-parser)로 정적 검사 + 결과는 PG/DuckDB로 실행 - 표기 불일치 위험.

### A-2. 호스티드 무료 티어 (Vercel 서버리스에서 접근)

#### MySQL
- TiDB Cloud Starter (구 Serverless): 인스턴스당 행 5GiB + 컬럼 5GiB + 5천만 RU/월 무료, 조직당 최대 5개 인스턴스 [확인: 공식 docs]. 8월 12일 2025 개명. 한도 초과 시 신규 연결 제한 [확인]. MySQL 호환(8.0 계열)이지만 완전 MySQL은 아님(일부 윈도우/함수/트랜잭션 차이) [추정]. HTTP/서버리스 드라이버 제공. 유휴 후 콜드스타트 있음 [추정].
- PlanetScale: 2024-04 무료 Hobby 폐지, 현재 최저 Postgres 단일노드 약 $5/월, Vitess $39/월~ [확인: 2차 출처, 가격 재확인 필요]. 무료 아님 → 제외.
- Aiven 무료 MySQL: 무료 플랜 존재 [추정, 미확인]. 1 CPU/1GB/5GB, 비활성 시 전원 off 정책 [추정]. 안정성 낮아 보조.
- Railway: 무료 티어 없음(트라이얼 크레딧 후 사용량 과금) [추정].
- 사용자 격리: 읽기 전용 DB 사용자 + 문제별 고정 시드 DB. 사용자 제출 쿼리는 SELECT/WITH만 허용(파서 검증) + `SET SESSION MAX_EXECUTION_TIME`. 쓰기 문제가 필요하면 세션별 스키마 생성은 TiDB 5개 인스턴스·연결 수 제약상 비추천.

#### PostgreSQL
- Neon: 프로젝트당 100 CU-hours/월, 스토리지 0.5GB, 100 프로젝트, 전송 5GB [확인: 공식]. 한도 도달 시 컴퓨트 정지. scale-to-zero 콜드스타트 수백 ms~1초 [추정]. `@neondatabase/serverless`(HTTP/WebSocket)로 Vercel에서 풀링 불필요.
- Supabase: 무료 프로젝트 500MB, 7일 비활성 시 일시정지 [추정]. 풀러(Supavisor) 제공.
- Vercel Postgres: 현재 Marketplace(Neon 등)로 이관됨 [추정].
- 판단: PostgreSQL은 PGlite로 클라이언트 실행이 가능하므로 호스티드 불필요. 서버 채점 일관성이 필요할 때만 Neon.

#### BigQuery
- Sandbox: 카드 불필요, 월 10GB 저장 + 1TB 쿼리 처리 무료 [확인: 공식 문서]. 테이블 60일 만료 [확인: 2차 출처, 공식 재확인 필요].
- 서버 접근: GCP 서비스 계정 키 필요. Vercel env var에 JSON 저장(base64, 4KB 제한 유의 - Vercel env 합계 64KB [추정]). `@google-cloud/bigquery` 사용, 번들 크기 큼(수십 MB, 250MB 이내).
- 지연: 쿼리당 보통 1~3초(잡 생성 오버헤드) [추정]. 다수 사용자 시 동시성/슬롯 한계, 1TB 월 한도는 소량 시드 테이블이면 충분하나 남용(풀스캔 반복) 시 소진 위험 → 공용 데이터셋 대신 소형 시드 + `maximumBytesBilled` 설정.
- 격리: 사용자별 데이터셋 불필요. 읽기 전용 공용 데이터셋 + 서비스 계정에 `dataViewer` + `jobUser`만 부여, DML/DDL 차단(파서 검증 + dry-run으로 statement 타입 확인).
- Sandbox 계정의 결제 연결 시 과금 위험 → 별도 프로젝트에 결제 미연결 유지.

#### BigQuery 에뮬레이터 / ZetaSQL
- goccy/bigquery-emulator: Go 구현, 내부는 ZetaSQL(go-zetasqlite)+SQLite. 최신 v0.6.1 [확인], README에서 beta 명시 [확인]. Docker 이미지 제공. 한계: CGO·ZetaSQL 빌드 필요, 서버리스 불가(상시 컨테이너 필요) → Vercel 불가, 별도 호스팅(Fly/Render 등, 비용 발생).
- go-zetasqlite / ZetaSQL(GoogleSQL) 직접 WASM 빌드: 공개된 브라우저용 빌드 미확인. C++ 의존 크고 비현실적.
- BigQuery 근사: DuckDB-WASM이 QUALIFY/STRUCT/UNNEST 등에서 가장 가까움. SAFE_DIVIDE, DATE_DIFF(a,b,DAY), FORMAT_DATE, `SAFE.` 접두, 백틱 식별자, ARRAY_AGG 등은 쿼리 재작성 계층(sqlglot 같은 트랜스파일러는 Python이라 브라우저 불가; sqlglot JS 대체로 `sql-glot` 포트는 미성숙 [추정])이나 DuckDB 매크로로 shim 필요.

### A-3. Vercel 제약

항목별 요약(Hobby 기준):
- 함수 번들 상한: 압축 해제 250MB (함수별) [확인].
- 최대 실행 시간: Fluid compute 시 기본/최대 300초 [확인, docs 2026-07 갱신]. 채점 쿼리에는 충분.
- 메모리: Hobby 2GB / 1 vCPU [확인].
- 요청/응답 페이로드 4.5MB [확인]. 소스 업로드(CLI) 100MB [확인].
- Hobby는 상업적 사용 불가(약관) [추정] - 공개 서비스/수익화 시 Pro 필요.
- DB 연결: 서버리스는 인스턴스 증식 시 연결 폭증 → HTTP 드라이버(Neon, TiDB serverless driver) 또는 풀러 사용. BigQuery는 REST라 영향 없음.
- 환경변수: Vercel 프로젝트 설정, 서버 전용(`VITE_` 접두 금지, 노출됨). 서비스 계정 JSON은 base64 한 줄로.
- Vite SPA + `api/` 폴더: 가능 [확인: 문서상 루트 `api/*.ts`는 프레임워크 무관 서버리스 함수, 단 "Vite 전용 확인 문구"는 검색에서 미확인 → 소규모 PoC로 확인]. 로컬 개발은 `vercel dev` 필요(순수 `vite dev`는 api 미동작). Next.js는 SSR/미들웨어/ISR이 필요 없다면 불필요.
- 권장: 현 구조 유지(Vite SPA) + 필요한 경우에만 `api/run-bq.ts`, `api/run-mysql.ts` 추가. 정적 자산(WASM)은 CDN 캐시, 큰 WASM은 `Cache-Control: immutable`.

### A-4. 방언별 권장 엔진 (초안)

- PostgreSQL: PGlite (브라우저, 무료, 충실도 최고).
- BigQuery: 1순위 DuckDB-WASM + 방언 shim(오프라인 즉시 실행, 근사 채점), 2순위 BigQuery Sandbox 서버리스(진짜 BQ, 지연/한도 있음). 학습용 정답 비교는 DuckDB 근사로 하고 BQ 고유 문법은 "읽고 이해" 문제 형태로 보완하는 절충안 권장.
- MySQL: 브라우저 실행 불가에 가까움 → TiDB Starter(서버) 읽기 전용 시드 방식. 대안으로 PGlite/DuckDB로 MySQL 문법 일부 shim하고 "MySQL 근사" 라벨 표기.
- AlaSQL: 제거 또는 폴백 전용.
- 통합 전략: 문제 데이터는 방언 중립 CSV/INSERT 시드로 보관, 엔진 어댑터 인터페이스(`run(sql) -> {columns, rows}`)로 추상화.

---

## Part B. 방언 차이 치트시트 (MySQL 8 / PostgreSQL 16 / BigQuery)

### 날짜/시간

| 항목           | MySQL 8                                 | PostgreSQL 16                        | BigQuery                                |
|----------------|-----------------------------------------|--------------------------------------|-----------------------------------------|
| 월 단위 절삭   | `DATE_FORMAT(d,'%Y-%m-01')`             | `DATE_TRUNC('month', d)`             | `DATE_TRUNC(d, MONTH)`                  |
| 주 절삭        | `DATE_SUB(d, INTERVAL WEEKDAY(d) DAY)`  | `DATE_TRUNC('week', d)` (월요일)     | `DATE_TRUNC(d, WEEK(MONDAY))`           |
| 포맷 출력      | `DATE_FORMAT(d,'%Y-%m')`                | `TO_CHAR(d,'YYYY-MM')`               | `FORMAT_DATE('%Y-%m', d)`               |
| 일수 차이      | `DATEDIFF(a,b)` (a-b)                   | `a::date - b::date`                  | `DATE_DIFF(a, b, DAY)`                  |
| 단위 차이      | `TIMESTAMPDIFF(HOUR,b,a)`               | `EXTRACT(EPOCH FROM a-b)/3600`       | `TIMESTAMP_DIFF(a, b, HOUR)`            |
| 간격 더하기    | `d + INTERVAL 7 DAY`                    | `d + INTERVAL '7 day'`               | `DATE_ADD(d, INTERVAL 7 DAY)`           |
| 오늘           | `CURDATE()`, `NOW()`                    | `CURRENT_DATE`, `NOW()`              | `CURRENT_DATE()`, `CURRENT_TIMESTAMP()` |
| 추출           | `EXTRACT(YEAR FROM d)`, `YEAR(d)`       | `EXTRACT(YEAR FROM d)`               | `EXTRACT(YEAR FROM d)`                  |
| 문자열 -> 날짜 | `STR_TO_DATE(s,'%Y-%m-%d')`             | `TO_DATE(s,'YYYY-MM-DD')`, `s::date` | `PARSE_DATE('%Y-%m-%d', s)`, `DATE(s)`  |
| 타임존 변환    | `CONVERT_TZ(ts,'UTC','Asia/Seoul')`     | `ts AT TIME ZONE 'Asia/Seoul'`       | `DATETIME(ts, 'Asia/Seoul')`            |
| 타임존 기본    | TIMESTAMP=세션 TZ 변환, DATETIME=무변환 | `timestamptz`=UTC 저장, 세션 TZ 표시 | TIMESTAMP=UTC, DATETIME=TZ 없음         |

비고: PG의 날짜 뺄셈은 integer(일), timestamp 뺄셈은 interval. MySQL `DATEDIFF`는 인자 순서가 BQ `DATE_DIFF`와 반대 방향 감각이 다르므로 주의.

### 산술/NULL/캐스팅

| 항목          | MySQL 8                         | PostgreSQL 16                  | BigQuery                                    |
|---------------|---------------------------------|--------------------------------|---------------------------------------------|
| 0 나눗셈      | NULL 반환(기본 모드)            | 에러                           | 에러 (`SAFE_DIVIDE(a,b)` -> NULL)           |
| 안전 나눗셈   | `a / NULLIF(b,0)`               | `a / NULLIF(b,0)`              | `SAFE_DIVIDE(a,b)`                          |
| 정수 나눗셈   | `/`는 소수, `DIV`는 정수        | `int/int`는 정수 절삭          | `/`는 FLOAT64, `DIV(a,b)`                   |
| 캐스팅        | `CAST(x AS SIGNED)`             | `x::int`, `CAST(x AS INT)`     | `CAST(x AS INT64)`, `SAFE_CAST`             |
| 불리언        | TINYINT(1), `TRUE`=1            | 진짜 `boolean`                 | 진짜 `BOOL`                                 |
| 불리언 합계   | `SUM(cond)` 가능                | `SUM(cond::int)` 필요          | `COUNTIF(cond)`, `SUM(CAST(cond AS INT64))` |
| 조건 집계     | `SUM(cond)` / CASE              | `COUNT(*) FILTER (WHERE cond)` | `COUNTIF(cond)`                             |
| NULL 정렬     | NULL이 가장 작음                | ASC에서 NULL 마지막            | ASC에서 NULL 먼저                           |
| 식별자 인용   | 백틱 `` ` ``                    | 큰따옴표 `"`                   | 백틱 `` ` ``                                |
| 문자열 인용   | `'` (`"`도 허용)                | `'`만                          | `'` 또는 `"`                                |
| 대소문자 비교 | 기본 case-insensitive collation | 기본 case-sensitive            | case-sensitive                              |

### 문자열

| 항목          | MySQL 8                         | PostgreSQL 16                            | BigQuery                   |
|---------------|---------------------------------|------------------------------------------|----------------------------|
| 연결          | `CONCAT(a,b)` (NULL이면 NULL)   | `a \|\| b`, `CONCAT` (NULL 무시)         | `CONCAT(a,b)`, `a \|\| b`  |
| 분리          | 없음 (`SUBSTRING_INDEX`)        | `SPLIT_PART(s,',',2)`, `STRING_TO_ARRAY` | `SPLIT(s,',')[OFFSET(1)]`  |
| 정규식 매치   | `s REGEXP 'p'`                  | `s ~ 'p'`                                | `REGEXP_CONTAINS(s, r'p')` |
| 정규식 추출   | `REGEXP_SUBSTR(s,'p')`          | `SUBSTRING(s FROM 'p')`, `REGEXP_MATCH`  | `REGEXP_EXTRACT(s, r'p')`  |
| 길이          | `CHAR_LENGTH`                   | `LENGTH`, `CHAR_LENGTH`                  | `LENGTH`, `CHAR_LENGTH`    |
| 문자열 집계   | `GROUP_CONCAT(x SEPARATOR ',')` | `STRING_AGG(x, ',')`                     | `STRING_AGG(x, ',')`       |
| LIKE 대소문자 | 비구분(collation)               | `ILIKE`로 비구분                         | `LOWER()` 비교             |

### 구조/집계/윈도우

| 항목             | MySQL 8                         | PostgreSQL 16                       | BigQuery                                            |
|------------------|---------------------------------|-------------------------------------|-----------------------------------------------------|
| LIMIT/OFFSET     | `LIMIT n OFFSET m`, `LIMIT m,n` | `LIMIT n OFFSET m`                  | `LIMIT n OFFSET m`                                  |
| GROUP BY 순번    | 허용                            | 허용                                | 허용 (`GROUP BY ALL`도 지원)                        |
| SELECT 별칭 사용 | GROUP BY/HAVING에서 허용        | GROUP BY/ORDER BY만                 | GROUP BY/HAVING/ORDER BY 허용                       |
| 비집계 컬럼      | `ONLY_FULL_GROUP_BY` 기본 on    | 에러                                | 에러                                                |
| ANY_VALUE        | 지원 (8.0)                      | 없음 (`MIN`/`MAX` 사용)             | 지원                                                |
| DISTINCT ON      | 없음 (ROW_NUMBER 사용)          | `SELECT DISTINCT ON (k) ...`        | 없음 (`QUALIFY ROW_NUMBER()=1`)                     |
| QUALIFY          | 없음 (서브쿼리로 감싸기)        | 없음 (서브쿼리)                     | 지원                                                |
| 윈도우 함수      | 8.0+ 지원                       | 지원                                | 지원                                                |
| 윈도우 프레임    | 기본 RANGE 프레임 주의          | 동일                                | 동일                                                |
| 중앙값           | 없음 (윈도우 조합)              | `PERCENTILE_CONT(0.5) WITHIN GROUP` | `APPROX_QUANTILES`, `PERCENTILE_CONT(x,0.5) OVER()` |
| 재귀 CTE         | `WITH RECURSIVE`                | `WITH RECURSIVE`                    | `WITH RECURSIVE` (지원)                             |
| 배열/UNNEST      | JSON_TABLE/JSON 배열로 대체     | `UNNEST(arr)`, ARRAY 타입           | `UNNEST(arr)`, ARRAY/STRUCT 일급                    |
| 구조체           | 없음 (JSON)                     | composite type, JSONB               | `STRUCT<a INT64>` 점 접근                           |
| FULL OUTER JOIN  | 없음 (UNION 우회)               | 지원                                | 지원                                                |
| 집합 연산        | `INTERSECT/EXCEPT` 8.0.31+      | 지원                                | `INTERSECT DISTINCT` 등 명시 필요                   |
| UPSERT/DML       | `ON DUPLICATE KEY UPDATE`       | `ON CONFLICT`                       | `MERGE`                                             |
| 테이블 지정      | `db.table`                      | `schema.table`                      | `` `project.dataset.table` ``                       |

### DA 실무 빈출 함정
- 날짜 절삭 + 월별 집계: MySQL은 `DATE_FORMAT`이 문자열 반환(정렬은 되나 타입 상이), PG/BQ는 날짜 타입 반환.
- 정수 나눗셈: PG에서 `a/b`가 0으로 절삭 → 비율 계산 시 `::numeric` 캐스팅 필요. 면접 단골.
- MySQL은 `GROUP BY`에서 별칭 허용, PG는 SELECT 별칭을 WHERE에서 불가(모두 WHERE 불가).
- BQ `DATE_DIFF(end, start, DAY)`: 인자 순서가 MySQL `DATEDIFF(end, start)`와 같은 방향이지만 단위 인자 필수.
- 정렬 안정성: LIMIT 사용 시 ORDER BY 동점 처리는 엔진 의존 → 채점 시 동점 규칙 명시.

---

## Part C. 경쟁 환경

조사 한계: 아래 일부는 검색으로 확인하지 못해 `[추정]` 표기. 가격은 변동이 크므로 출시 전 재확인.

### C-1. 요약표

| 서비스               | 엔진/방언                     | 채점                    | 문제 형식                    | 회사 태그        | 가격                          |
|----------------------|-------------------------------|-------------------------|------------------------------|------------------|-------------------------------|
| DataLemur            | PostgreSQL(주) [추정]         | 결과셋 비교             | 쿼리 작성                    | 있음 (실제 면접) | 프리미엄 $10~15/월 [확인]     |
| StrataScratch        | PG/MySQL/MSSQL 등 선택 [추정] | 결과셋 비교             | 쿼리 작성, 파이썬            | 있음, 회사별 풀  | $69/월, $299 평생 [확인: 2차] |
| LeetCode SQL         | MySQL/PG/MSSQL/Oracle [추정]  | 결과셋 비교(+순서 명시) | 쿼리 작성                    | 있음 (프리미엄)  | Premium 월 약 $35 [추정]      |
| HackerRank SQL       | MySQL/Oracle/MSSQL/DB2 [추정] | 결과 비교(히든 케이스)  | 쿼리 작성                    | 일부 기업 시험   | 무료 + 기업용 [추정]          |
| 프로그래머스 SQL Kit | MySQL/Oracle 선택 [추정]      | 결과셋 비교             | 쿼리 작성                    | 없음 (유형별)    | 무료 [추정]                   |
| solvesql.com         | 미확인 (SQLite/PG 추정)       | 미확인                  | 쿼리 작성, 난이도 1~5 [확인] | 없음 [추정]      | 무료 + 회원가입 [확인]        |
| 데이터리안 SQL 캠프  | 미확인                        | 강의/과제 중심          | 강의 + 과제                  | 없음             | 유료 강의 [추정]              |
| SQLZoo               | MySQL/PG/Oracle/MSSQL 선택    | 결과 비교(정답 표시)    | 쿼리 작성                    | 없음             | 무료                          |
| SQLBolt              | SQLite                        | 결과 비교               | 쿼리 작성(인터랙티브)        | 없음             | 무료                          |
| Mode SQL Tutorial    | PostgreSQL(Mode)              | 없음 (실행만)           | 튜토리얼 + 실습              | 없음             | 무료                          |
| pgexercises          | PostgreSQL                    | 결과 비교               | 쿼리 작성                    | 없음             | 무료                          |
| sqlpd                | SQL 면접 문제집 [추정]        | 미확인                  | 미확인                       | 미확인           | 미확인                        |
| Interview Query      | 다방언 [추정]                 | 결과 비교 + 솔루션 해설 | 쿼리, 케이스, 모의면접       | 있음 (회사별)    | 약 $20~30/월 [추정]           |
| DataExpert.io        | 부트캠프/문제 [추정]          | 미확인                  | 부트캠프형                   | 미확인           | 유료 [추정]                   |

### C-2. 주요 관찰

- 채점은 거의 전부 결과셋 비교형. AI 채점은 면접 모의(Interview Query 등) 일부 [추정]. 피드백은 "정답/오답 + 차이 표시" 수준이 일반적이고 "왜 틀렸는지" 설명은 약함.
- 회사 태그 방식: 문제 제목/메타에 "Amazon SQL Interview Question" 식으로 기업 로고 + 난이도 + 주제 태그(DataLemur 패턴) [확인: 사이트 구조는 학습 지식]. 실제 면접 출제 여부는 사용자 제보 기반이라 검증 불가 → 법적/신뢰 이슈 존재.
- 방언: 대부분 단일 방언 고정이며 선택형은 StrataScratch/LeetCode/SQLZoo 정도. BigQuery 지원 서비스는 드묾 [추정].
- 한국 서비스: 프로그래머스(코테 중심, MySQL), solvesql(DA 실무형 + Advent of SQL, 데이터리안 협업 [확인]), 데이터리안 강의. 국내 JD/직무 연계형은 확인되지 않음.
- 한국 앱 "SQL query" 류는 자격증(컴활/정처기) 대비형 [확인: App Store].

### C-3. 차별화 기회 (JD 기반 한국 DA 도구)

1. JD 입력 -> 맞춤 문제 세트: 채용공고 텍스트에서 요구 스킬(윈도우, 코호트, 퍼널, A/B)을 추출해 해당 유형 문제를 구성. 기존 서비스는 회사/주제 고정 목록.
2. 방언 선택/비교 학습: 같은 문제를 MySQL/PG/BigQuery로 풀고 차이 해설. 국내 기업은 BigQuery/MySQL 혼재라 수요 높음.
3. 한국 기업 맥락 데이터셋: 커머스/핀테크/배달/콘텐츠 도메인 시드(한글 컬럼명 옵션, KST 타임존 함정 포함).
4. 오답 원인 해설: 결과셋 diff를 규칙으로 분류(조인 중복, NULL 처리, 타임존 경계, 정수 나눗셈)해 힌트 제공. LLM 비용은 캐시로 통제.
5. 서술형 병행: 결과 해석, 지표 정의, "이 쿼리의 문제점" 문제(쿼리 수정/리뷰형) - 경쟁 서비스는 작성형 위주.
6. 면접 시뮬레이션: 제한 시간 + 후속 질문(성능, 엣지케이스, 지표 해석). 코치 AI 대신 정적 규칙 기반 후속 질문.
7. 서버 없는 무료/프라이버시: 브라우저 실행이라 계정·결제 없이 시작, 진행 상태 localStorage. 데이터 업로드(내 CSV로 연습) 가능.
8. 실무 체크리스트 채점: 정답 외에 "중복 제거 여부, 분모 0 처리, 날짜 경계" 등 DA 품질 항목 점수화(정적 검사).

회사 태그 주의: 실제 면접 출제를 단정하는 문구("Amazon 면접 문제")는 근거 없으면 피하고, "JD 기반 유사 유형"처럼 표기.

---

## Part D. 비용 없는 채점 설계

### D-1. 결과셋 비교 (기본)
- 정규화 순서:
  1. 컬럼 수 일치 확인. 컬럼명은 기본 무시(위치 기준) + 옵션으로 별칭 요구 문제만 이름 검사. 대소문자 무시, 따옴표 제거.
  2. 값 정규화: NULL 통일, 문자열 trim 옵션, 날짜는 ISO 문자열로 직렬화, 불리언 0/1/true 통일.
  3. 숫자: `abs(a-b) <= max(1e-6, 1e-9*|b|)` 또는 문제별 소수 자릿수 round 기준(`tol` 메타). 정수/실수 타입 차이(1 vs 1.0) 허용.
  4. 순서: 기본 order-insensitive(행을 정렬 후 비교 또는 멀티셋 비교). ORDER BY가 요구되는 문제(`ordered: true`)만 순서 비교. 부분 정렬(동점) 허용 옵션.
  5. 행 수, 중복 행 멀티셋 비교(DISTINCT 누락 검출).
- 오답 진단: 행 수 차이, 누락/초과 행 샘플 N개, 컬럼 단위 불일치율 -> 규칙 기반 힌트(예: 행이 정확히 배수로 많음 -> 조인 중복 의심).
- 숨은 테스트: 시드 데이터 2벌(공개 + 숨김) 모두에서 같은 결과를 확인해 하드코딩(`SELECT 42`) 방지. 숨김 시드는 클라이언트에 두면 노출되므로 서버 채점이 필요 -> 클라이언트 전용이면 "시드를 랜덤 생성(seeded)" 방식으로 완화.

### D-2. 복수 정답
- 문제당 `solutions: [sql1, sql2,...]`를 전부 실행해 허용 결과셋 집합으로 보관(빌드 타임 사전 계산). 결과가 같으면 동일 정답으로 취급하므로 보통 1개로 충분.
- 모호 요구(동점 처리, NULL 포함 여부)처럼 결과가 갈리는 경우만 `accepted_results: [rs1, rs2]` 명시.

### D-3. 정적 검사
- 파서(node-sql-parser 또는 방언별 파서)로 AST 검사:
  - 필수 구문: `requires: ['WINDOW', 'CTE', 'LEFT JOIN']`, 금지 구문: `forbids: ['SELECT *', 'subquery']`.
  - 실행 안전: SELECT/WITH 외 거부, 다중 문장 거부, 시스템 테이블 접근 거부.
- 한계: 방언별 파서 커버리지 부족(BQ 특수 문법 파싱 실패 가능) -> 정규식 토큰 검사로 폴백, 실패 시 정적 검사 생략하고 결과 비교만.
- 정적 검사는 "학습 목표 충족" 표시용(점수 감점보다 경고)으로 사용 권장.

### D-4. LLM 해설 캐시
- 키: `hash(문제ID + 방언 + normalize(sql) + 결과 diff 요약)`.
- 정규화: 주석 제거, 공백/대소문자 통일, 키워드 대문자화, 별칭/리터럴 치환 선택, 가능하면 AST 직렬화 후 해시.
- 저장: 빌드 타임에 "정답 쿼리 해설"과 "대표 오답 패턴 해설"을 사전 생성해 정적 JSON으로 번들(런타임 LLM 호출 0). 신규 쿼리만 서버리스 함수에서 호출 후 KV(Vercel KV/Upstash 등)에 캐시, 사용자당 일일 호출 상한과 레이트리밋.
- 오답 유형 코드(D-1 진단 결과)를 캐시 키에 포함하면 적중률이 올라감 -> 개별 쿼리가 아니라 "문제 x 오류 유형" 단위로 해설 재사용.

### D-5. 권장 구성
- 1차: 결과셋 비교 + 규칙 기반 진단(무료, 즉시).
- 2차: 정적 검사(필수 구문 경고).
- 3차: 사전 생성 해설 + 선택적 온디맨드 LLM(캐시 + 상한).

---

## 참고 URL

- PGlite 패키지(unpkg): https://app.unpkg.com/@electric-sql/pglite@0.3.7
- PGlite 미러(mvnpm): https://mvnrepository.com/artifact/org.mvnpm.at.electric-sql/pglite
- DuckDB-WASM npm: https://npmjs.com/@duckdb/duckdb-wasm
- DuckDB WASM 문서: https://www.duckdb.org/docs/current/clients/wasm/overview
- DuckDB-WASM 크기 논의: https://github.com/duckdb/duckdb-wasm/discussions/1469
- gitee mysql-wasm: https://gitee.com/LucasDot/mysql-wasm
- TiDB wasm(DZone 2019): https://dzone.com/articles/how-we-compiled-a-golang-database-in-the-browser-u
- TiDB Cloud Starter 한도: https://docs.pingcap.com/tidbcloud/serverless-limitations/
- TiDB 가격: https://pingcap.com/pricing
- Neon 가격: https://neon.com/pricing
- Neon 무료 한도 FAQ: https://neon.com/faqs/free-plan-limits-and-quotas
- PlanetScale 가격 변경: https://costbench.com/changelog/planetscale-plan-removed-2026-07/
- BigQuery Sandbox: https://cloud.google.com/bigquery/docs/sandbox
- goccy/bigquery-emulator: https://github.com/goccy/bigquery-emulator
- Vercel 함수 제한: https://vercel.com/docs/functions/limitations
- Vercel 플랫폼 한도: https://docs.vercel.com/docs/limits
- AlaSQL 이슈 #1287: https://github.com/agershun/alasql/issues/1287
- DataLemur 가격 정리: https://prachub.com/resources/datalemur-pricing
- DataLemur 대안 비교: https://prachub.com/resources/best-datalemur-alternatives-2026
- StrataScratch 가격: https://platform.stratascratch.com/pricing
- DataLemur vs StrataScratch: https://datalemur.com/blog/datalemur-vs-stratascratch-for-data-science
- solvesql/Advent of SQL(인프런): https://www.inflearn.com/course/sql-problem-solving
- SQL query 앱(App Store): https://apps.apple.com/kr/app/sql-query-sql-쿼리-학습-테스트/id6443757218

## 미확인/후속 조사 필요
- solvesql, 프로그래머스, HackerRank, LeetCode, SQLZoo, Interview Query, DataExpert.io, sqlpd의 현재 방언 및 채점 방식 직접 확인.
- AlaSQL 최신 버전의 윈도우 함수 지원 여부와 MySQL 함수 목록 실측.
- PGlite/DuckDB-WASM 실제 전송 크기(브로틀리/gzip) 실측과 모바일 로드 시간.
- Vite SPA + 루트 `api/` 함수 동작 PoC.
- Aiven/Railway 무료 정책 현재 상태.
