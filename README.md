# SQL JD Trainer

**채용 공고(JD) 분석 기반 맞춤형 SQL 문제 생성 및 실습 플랫폼**

SQL JD Trainer는 사용자가 목표로 하는 기업의 채용 공고(Job Description)를 입력하면,  
AI가 해당 직무에 요구되는 SQL 역량을 분석하여 가상 데이터베이스와 실습 문제를 자동으로 생성해주는 학습 도구입니다.

단순 문제 풀이가 아니라, 실제 JD에 기반한 SQL 사고력과 문제 해결 능력을 훈련하는 것을 목표로 합니다.

## 주요 기능

- **JD 분석**  
  Google Gemini API를 활용하여 채용 공고에서 핵심 SQL 요구사항 및 도메인 키워드 추출

- **자동 스키마 생성**  
  분석된 도메인(이커머스, 핀테크 등)에 맞는 가상 테이블 구조 및 샘플 데이터 자동 생성

- **브라우저 내 SQL 실행**  
  AlaSQL(In-memory DB)을 사용하여 서버 없이 브라우저에서 즉시 쿼리 실행

- **AI 코드 리뷰**  
  제출한 SQL 쿼리에 대해 정답 여부 판단 및 성능·가독성 관점의 개선 피드백 제공

## 🛠 Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide React  
- **SQL Engine**: AlaSQL (In-memory Database)  
- **AI**: Google Gemini API  

## 시작하기

### 설치

```bash
git clone https://github.com/youuuchul/sql-jd-trainer.git
cd sql-jd-trainer
npm install
```

### 환경 설정

루트에 `.env.local`을 만들고 Gemini API 키를 지정하세요.

```
VITE_GEMINI_API_KEY=YOUR_KEY
```

키가 없거나 네트워크가 막힌 경우, 앱 내에서 제공하는 **샘플 JD 불러오기(오프라인)** 버튼으로 데모를 바로 사용할 수 있습니다.

### MySQL 모드 (DATE_FORMAT/CTE 지원)

브라우저 내장 DB(AlaSQL)는 MySQL과 100% 호환이 아니므로, `DATE_FORMAT`, `WITH (CTE)` 같은 문법을 사용하려면 **MySQL 모드**를 권장합니다.

1) MySQL 8.x 실행 (로컬 설치 또는 Docker)
2) `server/.env.example`을 복사해 `server/.env` 생성 후 접속 정보 입력
3) 서버 실행

```bash
npm run server
```

4) 프론트 실행

```bash
npm run dev
```

프론트는 `/api` 경로로 백엔드에 연결되며, 연결 성공 시 상단에 **DB: MySQL** 표시가 뜹니다.

### 실행

```bash
npm run dev
```

## 라이선스 (License)

이 프로젝트는 CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International) 라이선스를 따릅니다.

- **개인적 학습 및 연구 목적**: 자유롭게 이용 가능
- **상업적 목적 이용**: 금지 (영리 목적으로의 재배포, 판매, 유료 강의 활용 등 불가)
자세한 내용은 아래 링크를 참고하세요.
https://creativecommons.org/licenses/by-nc/4.0/

Developed by youuuchul
