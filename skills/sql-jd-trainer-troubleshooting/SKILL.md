---
name: sql-jd-trainer-troubleshooting
description: Troubleshoot SQL JD Trainer runtime issues (Vite proxy/port, cache, backend health, editor loading).
---

# SQL JD Trainer Troubleshooting

## When to use
- 화면이 빈 페이지로 보이거나, 문제/쿼리 결과가 안 나올 때
- `/api/health` 프록시 에러(ECONNREFUSED) 발생 시
- SQL 에디터가 안 보이거나 입력이 안 될 때

## Quick checks
1) **백엔드 상태**
- 터미널 A: `npm run server` (종료 금지)
- 헬스 체크: `curl http://localhost:8787/api/health`

2) **프론트 상태**
- 터미널 B: `npm run dev`
- Vite가 **다른 포트**로 뜰 수 있으니 출력된 URL로 접속

3) **캐시 문제**
- dev 환경: 새로고침 또는 dev 재시작
- dist 환경: `rm -rf dist && npm run build` 후 강력 새로고침

## Known issues & fixes
- **Vite proxy error (/api/health)**: 백엔드 미실행, 포트 충돌, 잘못된 실행 위치
- **DB unknown**: `/api/health`는 DB 자동 생성 로직 포함됨
- **SQL 에디터 안 보임**: CDN 로딩 실패 시 콘솔 확인

## Diagnostics
- Safari/Chrome 콘솔 에러 확인
- 네트워크 탭에서 JS/CSS 로딩 실패 확인
