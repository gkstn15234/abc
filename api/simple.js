const express = require('express');
const router = express.Router();

// 기본 상태 확인 API (서비스 의존성 없음)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Hyperion-Press API Server is running'
  });
});

// 시스템 통계 API (안전한 버전)
router.get('/stats', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'running',
        message: 'Hyperion-Press AI News Automation',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        server_info: {
          platform: process.platform,
          node_version: process.version,
          uptime: process.uptime()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Stats API error',
      details: error.message
    });
  }
});

// 기본 설정 정보 API
router.get('/settings', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        server_status: 'running',
        features: [
          'RSS 피드 스캔',
          'AI 기사 생성 (GPT-4o-mini)',
          '이미지 자동 검색',
          'Cloudflare CDN 업로드',
          '실시간 자동화'
        ],
        environment: process.env.NODE_ENV || 'development',
        deployment: 'Vercel Serverless'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Settings API error',
      details: error.message
    });
  }
});

// 기본 기사 목록 API (Mock 데이터)
router.get('/articles', (req, res) => {
  try {
    const mockArticles = [
      {
        id: 1,
        title: 'AI 뉴스 자동화 시스템 구축 완료',
        content: 'Hyperion-Press AI 뉴스 자동화 시스템이 성공적으로 구축되었습니다.',
        status: 'published',
        created_at: new Date().toISOString(),
        source: 'System Generated'
      }
    ];

    res.json({
      success: true,
      data: {
        articles: mockArticles,
        total: mockArticles.length,
        page: 1,
        limit: 10
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Articles API error',
      details: error.message
    });
  }
});

// 테스트용 자동화 API
router.post('/automation/test', (req, res) => {
  try {
    const { mode = 'test' } = req.body;
    
    res.json({
      success: true,
      message: '자동화 테스트 완료',
      data: {
        mode: mode,
        timestamp: new Date().toISOString(),
        status: 'Serverless function is working',
        note: '실제 자동화는 환경변수 설정 후 가능합니다'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Automation test error',
      details: error.message
    });
  }
});

module.exports = router; 