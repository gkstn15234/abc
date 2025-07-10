const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 프론트엔드 정적 파일 서빙 (안전하게)
try {
  const staticPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(staticPath));
} catch (error) {
  console.error('정적 파일 서빙 설정 실패:', error);
  // 기본 HTML 제공
  app.use(express.static(path.join(__dirname, '../public')));
}

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '🤖 Hyperion-Press API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      articles: '/api/v1/articles',
      automation: '/api/v1/automation',
      settings: '/api/v1/settings',
      stats: '/api/v1/stats'
    }
  });
});

// API 라우트 연결 (안전한 버전 사용)
try {
  // 먼저 간단한 API 라우트 로드
  const simpleRoutes = require('./simple');
  app.use('/api/v1', simpleRoutes);
  
  console.log('✅ 기본 API 라우트 로드 성공');
  
  // 복잡한 서비스들은 환경변수가 설정된 경우에만 로드
  if (process.env.OPENAI_API_KEY) {
    try {
      const fullApiRoutes = require('../routes/api');
      app.use('/api/v1/full', fullApiRoutes);
      console.log('✅ 전체 API 라우트 로드 성공');
    } catch (fullError) {
      console.warn('⚠️ 전체 API 라우트 로드 실패, 기본 라우트만 사용:', fullError.message);
    }
  } else {
    console.log('🔧 환경변수 미설정으로 기본 라우트만 사용');
  }
  
} catch (error) {
  console.error('❌ API 라우트 로드 완전 실패:', error);
  
  // 최후의 수단: 인라인 API
  app.get('/api/v1/stats', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'running',
        message: 'Hyperion-Press API Server (Fallback Mode)',
        timestamp: new Date().toISOString(),
        note: 'Using fallback API endpoints'
      }
    });
  });
  
  app.get('/api/v1/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      mode: 'fallback',
      timestamp: new Date().toISOString() 
    });
  });
}

// React 라우팅을 위한 catch-all 핸들러 (API 제외)
app.get('*', (req, res) => {
  // API 요청이 아닌 경우에만 index.html 반환
  if (!req.path.startsWith('/api')) {
    try {
      const indexPath = path.join(__dirname, '../frontend/build', 'index.html');
      res.sendFile(indexPath);
    } catch (error) {
      // 프론트엔드 빌드 파일이 없으면 기본 HTML 제공
      try {
        const fallbackPath = path.join(__dirname, '../public', 'index.html');
        res.sendFile(fallbackPath);
      } catch (fallbackError) {
        res.send(`
          <html>
            <head><title>Hyperion-Press</title></head>
            <body>
              <h1>🤖 Hyperion-Press</h1>
              <p>AI-Powered News Automation Platform</p>
              <p>서버가 실행 중입니다!</p>
              <a href="/api/v1/stats">API 상태 확인</a>
            </body>
          </html>
        `);
      }
    }
  } else {
    res.status(404).json({
      error: 'API 엔드포인트를 찾을 수 없습니다',
      path: req.originalUrl
    });
  }
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 