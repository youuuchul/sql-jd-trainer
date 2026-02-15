---
name: sql-jd-trainer-mysql-mode
description: Set up MySQL backend mode for SQL JD Trainer (server/.env, health checks, init, query tests).
---

# SQL JD Trainer MySQL Mode

## Goal
실제 MySQL 엔진으로 `DATE_FORMAT`, `WITH (CTE)` 등 문법을 그대로 실행한다.

## Setup
1) MySQL 서버 실행
2) `server/.env` 설정

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=YOUR_PASSWORD
MYSQL_DATABASE=sql_jd_trainer
MYSQL_SQL_MODE=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION
PORT=8787
```

3) 백엔드 실행
```bash
npm run server
```

4) 헬스 체크
```bash
curl http://localhost:8787/api/health
```

## Frontend usage
- `npm run dev` 실행 후 **DB: MySQL** 배지 확인
- JD 분석 → `/api/init`으로 스키마/샘플 데이터 주입

## Query tests
```sql
WITH base AS (SELECT join_date FROM Users)
SELECT DATE_FORMAT(join_date, '%Y-%m') AS ym, COUNT(*) AS cnt
FROM base
GROUP BY 1;
```

## Notes
- 서버는 **SELECT/CTE만 허용**
- 타입 추론은 컬럼명+데이터 기반 (DATE/DATETIME/INT/DECIMAL 등)
