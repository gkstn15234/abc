# 🤖 Hyperion-Press

AI 기반 자동 뉴스 발행 및 관리 대시보드

## 🎯 프로젝트 개요

Hyperion-Press는 RSS 피드에서 뉴스를 자동으로 수집하고, AI를 활용해 고품질 기사로 재작성한 후, 자동으로 웹사이트에 발행하는 완전 자동화된 뉴스 출판 시스템입니다.

### 주요 기능
- 🔄 RSS 피드 자동 모니터링
- 🤖 OpenAI를 활용한 기사 자동 생성
- 🖼️ 구글 이미지 검색 연동
- 📊 실시간 대시보드 모니터링
- ✏️ 수동 편집 및 검토 기능
- 🚀 GitHub 자동 발행

## 🚀 빠른 시작

### 1. 설치
```bash
# 의존성 설치
npm install

# 환경변수 설정
cp env.example .env
# .env 파일을 열어 API 키들을 입력하세요
```

### 2. 데이터베이스 설정
```bash
# PostgreSQL 설치 및 데이터베이스 생성
createdb hyperion_press
```

### 3. 서버 실행
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 4. 접속 확인
- API 서버: http://localhost:3000
- 대시보드: http://localhost:3000 (프론트엔드 구현 후)

## ⚙️ 필수 API 키 설정

### OpenAI API Key
1. https://platform.openai.com/api-keys 접속
2. API 키 생성
3. .env 파일의 `OPENAI_API_KEY`에 입력

### Google Custom Search API
1. https://developers.google.com/custom-search/v1/introduction 접속
2. API 키와 검색 엔진 ID 생성
3. .env 파일에 설정

### GitHub Token
1. GitHub Settings > Developer settings > Personal access tokens
2. 토큰 생성 (repo 권한 필요)
3. .env 파일에 설정

## 📁 프로젝트 구조

```
hyperion-press/
├── server.js           # 메인 서버 파일
├── package.json        # 의존성 관리
├── env.example         # 환경변수 템플릿
├── routes/             # API 라우트
├── models/             # 데이터베이스 모델
├── services/           # 비즈니스 로직
├── utils/              # 유틸리티 함수
├── frontend/           # React 프론트엔드
└── tests/              # 테스트 파일
```

## 🔧 개발 진행 상황

### ✅ 완료됨
- [x] 프로젝트 초기 설정
- [x] Express 서버 기본 구조
- [x] 환경변수 설정

### 🚧 진행 중
- [ ] 데이터베이스 스키마 설계
- [ ] RSS 파싱 모듈
- [ ] OpenAI 통합

### 📋 예정
- [ ] 웹 대시보드 UI
- [ ] 자동화 스케줄러
- [ ] GitHub 자동 발행

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 새로운 기능 브랜치를 만듭니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 생성해 주세요. 