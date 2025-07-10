const express = require('express');
const path = require('path');

const app = express();

// 기본 미들웨어만
app.use(express.json());

// 기본 상태 확인
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hyperion-Press - AI 뉴스 자동화</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0; 
                padding: 40px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: white;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                background: rgba(255,255,255,0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
            }
            h1 { 
                font-size: 3em; 
                margin: 0 0 20px 0; 
                text-align: center;
            }
            .status {
                background: rgba(255,255,255,0.2);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
            }
            .api-link {
                display: inline-block;
                background: rgba(255,255,255,0.2);
                padding: 15px 30px;
                margin: 10px;
                border-radius: 8px;
                text-decoration: none;
                color: white;
                transition: all 0.3s ease;
            }
            .api-link:hover {
                background: rgba(255,255,255,0.3);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 Hyperion-Press</h1>
            <p style="text-align: center; font-size: 1.2em;">AI-Powered News Automation Platform</p>
            
            <div class="status">
                <h3>✅ 서버 상태: 정상 운영 중</h3>
                <p>서버리스 함수가 성공적으로 실행되고 있습니다!</p>
                <p><strong>타임스탬프:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            </div>
            
            <h3 style="text-align: center;">📡 API 테스트:</h3>
            <div style="text-align: center;">
                <a href="/api/v1/health" class="api-link">🏥 Health Check</a>
                <a href="/api/v1/stats" class="api-link">📊 시스템 통계</a>
                <a href="/api/v1/test" class="api-link">🧪 테스트</a>
            </div>
            
            <div class="status">
                <h3>🚀 Hyperion-Press 기능:</h3>
                <ul>
                    <li>✅ 서버리스 함수 정상 작동</li>
                    <li>🔄 RSS 피드 자동 스캔 (준비 중)</li>
                    <li>🤖 GPT-4o-mini AI 기사 생성 (준비 중)</li>
                    <li>🖼️ 이미지 자동 검색 및 분석 (준비 중)</li>
                    <li>☁️ Cloudflare CDN 자동 업로드 (준비 중)</li>
                    <li>📊 실시간 진행 상황 모니터링 (준비 중)</li>
                </ul>
            </div>
            
            <p style="text-align: center; margin-top: 40px; opacity: 0.7;">
                🌐 Powered by Vercel Serverless • Node.js • Express
            </p>
        </div>
    </body>
    </html>
  `);
});

// 간단한 API 엔드포인트들
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Hyperion-Press is running perfectly!'
  });
});

app.get('/api/v1/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      message: 'Hyperion-Press AI News Automation',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      platform: process.platform,
      node_version: process.version,
      deployment: 'Vercel Serverless Functions'
    }
  });
});

app.get('/api/v1/test', (req, res) => {
  res.json({
    success: true,
    message: '🎉 API 테스트 성공!',
    data: {
      server: 'Express.js',
      environment: 'Vercel Serverless',
      timestamp: new Date().toISOString(),
      random_number: Math.floor(Math.random() * 1000),
      status: 'All systems operational'
    }
  });
});

// favicon 처리
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 404 처리
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    available_endpoints: [
      '/',
      '/api/v1/health',
      '/api/v1/stats', 
      '/api/v1/test'
    ]
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

module.exports = app; 