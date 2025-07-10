const express = require('express');
const router = express.Router();
const rssService = require('../services/rssService');
const openaiService = require('../services/openaiService');
const imageService = require('../services/imageService');
const cloudflareService = require('../services/cloudflareService');
const articleStorage = require('../services/articleStorage');

// RSS 관련 API
router.get('/rss/test', async (req, res) => {
  try {
    const rssService = require('../services/rssService');
    const news = await rssService.fetchLatestNews();

    res.json({
      success: true,
      message: `RSS 테스트 성공 - ${news.length}개 기사 발견`,
      data: {
        total_articles: news.length,
        sources: news.map(article => article.source),
        sample_articles: news.slice(0, 3).map(article => ({
          title: article.title,
          source: article.source,
          pubDate: article.pubDate,
          relevanceScore: article.relevanceScore || article.aiQualityScore
        }))
      }
    });
  } catch (error) {
    console.error('RSS 테스트 실패:', error);
    res.status(500).json({
      success: false,
      message: 'RSS 테스트 실패',
      error: error.message
    });
  }
});

// AI 분석 인기 기사 API
router.get('/rss/popular', async (req, res) => {
  try {
    const rssService = require('../services/rssService');
    console.log('🤖 AI 인기 기사 분석 요청');
    
    const news = await rssService.fetchLatestNews();
    
    // AI 분석된 기사들을 점수순으로 정렬하여 반환
    const popularArticles = news
      .filter(article => article.aiQualityScore !== undefined)
      .sort((a, b) => b.aiQualityScore - a.aiQualityScore)
      .slice(0, 15); // 상위 15개

    console.log(`✅ AI 분석 완료: ${news.length}개 중 ${popularArticles.length}개 인기 기사 선별`);
    
    res.json({
      success: true,
      message: `AI 인기 기사 분석 완료`,
      data: {
        total_analyzed: news.length,
        popular_count: popularArticles.length,
        articles: popularArticles.map(article => ({
          id: article.id,
          title: article.title,
          link: article.link,
          description: article.description,
          source: article.source,
          pubDate: article.pubDate,
          aiQualityScore: article.aiQualityScore,
          aiAnalysis: article.aiAnalysis,
          aiCategory: article.aiCategory,
          expectedEngagement: article.expectedEngagement,
          detailedScores: article.detailedScores
        }))
      }
    });
  } catch (error) {
    console.error('AI 인기 기사 분석 실패:', error);
    res.status(500).json({
      success: false,
      message: 'AI 인기 기사 분석 실패',
      error: error.message
    });
  }
});

router.get('/rss/feeds', async (req, res) => {
  try {
    const articles = await rssService.fetchLatestNews();
    
    res.json({
      success: true,
      data: {
        articles: articles,
        total: articles.length,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// OpenAI 테스트 API
router.get('/openai/test', async (req, res) => {
  try {
    const isConnected = await openaiService.testConnection();
    
    res.json({
      success: true,
      message: isConnected ? 'OpenAI 연결 성공' : 'OpenAI 연결 실패',
      data: {
        connected: isConnected,
        configured: openaiService.isConfigured,
        model: 'gpt-4o-mini',
        cost_info: openaiService.getCostInfo()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'OpenAI 테스트 중 오류 발생',
      details: error.message
    });
  }
});

router.post('/openai/generate', async (req, res) => {
  try {
    const { article_url } = req.body;
    
    if (!article_url) {
      return res.status(400).json({
        success: false,
        error: '기사 URL이 필요합니다'
      });
    }

    // RSS에서 최신 기사 가져오기
    const articles = await rssService.fetchLatestNews();
    const sourceArticle = articles.find(a => a.link === article_url) || articles[0];
    
    if (!sourceArticle) {
      return res.status(404).json({
        success: false,
        error: '해당 기사를 찾을 수 없습니다'
      });
    }

    // AI 기사 생성
    const generatedArticle = await openaiService.generateArticle(sourceArticle);
    const qualityScore = openaiService.calculateQualityScore(generatedArticle);
    
    res.json({
      success: true,
      message: 'AI 기사 생성 완료',
      data: {
        ...generatedArticle,
        quality_score: qualityScore,
        cost_info: openaiService.getCostInfo()
      }
    });
    
  } catch (error) {
    console.error('AI 기사 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: 'AI 기사 생성 중 오류 발생',
      details: error.message
    });
  }
});

// 이미지 검색 테스트 API
router.get('/images/test', async (req, res) => {
  try {
    const { query = 'AI 기술 발전' } = req.query;
    
    console.log(`🖼️ 이미지 검색 테스트: "${query}"`);
    
    const images = await imageService.searchImages(query, [], 5);
    const bestImage = imageService.selectBestImage(images);
    
    res.json({
      success: true,
      message: '이미지 검색 테스트 완료',
      data: {
        query: query,
        total_found: images.length,
        images: images,
        best_image: bestImage,
        usage_info: imageService.getUsageInfo()
      }
    });
  } catch (error) {
    console.error('이미지 검색 테스트 오류:', error);
    res.status(500).json({
      success: false,
      error: '이미지 검색 테스트 중 오류 발생',
      details: error.message
    });
  }
});

router.post('/images/search', async (req, res) => {
  try {
    const { title, keywords = [], count = 3 } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: '검색할 제목이 필요합니다'
      });
    }

    const images = await imageService.searchImages(title, keywords, count);
    const bestImage = imageService.selectBestImage(images);
    
    res.json({
      success: true,
      message: '이미지 검색 완료',
      data: {
        title: title,
        keywords: keywords,
        total_found: images.length,
        images: images,
        best_image: bestImage
      }
    });
  } catch (error) {
    console.error('이미지 검색 오류:', error);
    res.status(500).json({
      success: false,
      error: '이미지 검색 중 오류 발생',
      details: error.message
    });
  }
});

// 자동화 관련 API
router.post('/automation/run', async (req, res) => {
  try {
    const { mode = 'auto', limit = 3 } = req.body;
    
    console.log(`🤖 자동화 프로세스 시작 (모드: ${mode})`);
    
    // 1단계: RSS 피드 체크
    const articles = await rssService.fetchLatestNews();
    
    if (articles.length === 0) {
      return res.json({
        success: true,
        message: '새로운 기사가 없습니다',
        data: {
          new_articles: 0,
          created_articles: 0,
          mode: mode
        }
      });
    }
    
    // 2단계: AI 기사 생성 (제한된 수량만)
    const processArticles = articles.slice(0, limit);
    const generatedArticles = [];
    const errors = [];
    
         for (const article of processArticles) {
       try {
         console.log(`🔄 처리 중: ${article.title}`);
         
         let generated;
         let qualityScore;
         
         generated = await openaiService.generateArticle(article);
         qualityScore = openaiService.calculateQualityScore(generated);
         
         // 기사를 저장소에 저장
         const savedArticle = articleStorage.saveArticle({
           ...generated,
           quality_score: qualityScore,
           source_url: article.link,
           source_title: article.title,
           source: article.source,
           category: article.category,
           status: qualityScore >= 80 ? 'published' : 'draft'
         });
         
         generatedArticles.push({
           ...savedArticle,
           auto_publish: qualityScore >= 80 // 80점 이상은 자동 발행 후보
         });
         
         // API 제한을 고려한 딜레이
         await new Promise(resolve => setTimeout(resolve, 500));
         
       } catch (error) {
         console.error(`❌ 기사 생성 실패: ${article.title}`, error.message);
         errors.push({
           article: article.title,
           error: error.message
         });
       }
     }
    
    res.json({
      success: true,
      message: `자동화 프로세스 완료`,
      data: {
        new_articles: articles.length,
        created_articles: generatedArticles.length,
        errors: errors.length,
        mode: mode,
        generated_articles: generatedArticles,
        error_details: errors,
        cost_info: openaiService.getCostInfo()
      }
    });
    
  } catch (error) {
    console.error('자동화 프로세스 오류:', error);
    res.status(500).json({
      success: false,
      error: '자동화 프로세스 실행 중 오류가 발생했습니다',
      details: error.message
    });
  }
});

// 실시간 자동화 실행 API (WebSocket 지원)
router.post('/automation/run-live', async (req, res) => {
  try {
    const { mode = 'auto', limit = 3 } = req.body;
    const sessionId = Date.now().toString();
    
    // 즉시 응답하고 백그라운드에서 실행
    res.json({
      success: true,
      message: '실시간 자동화 프로세스가 시작되었습니다',
      session_id: sessionId
    });
    
    // WebSocket을 통한 실시간 진행 상황 전송
    const emitProgress = (data) => {
      if (global.io) {
        global.io.emit('automation_progress', {
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          ...data
        });
      }
    };
    
    // 백그라운드에서 자동화 실행
    setImmediate(async () => {
      try {
        emitProgress({
          type: 'start',
          message: `🤖 자동화 프로세스 시작 (모드: ${mode})`,
          progress: 0
        });
        
        // 1단계: RSS 피드 체크
        emitProgress({
          type: 'rss_scan',
          message: '📡 RSS 피드 스캔 중...',
          progress: 10
        });
        
        const articles = await rssService.fetchLatestNews();
        
        if (articles.length === 0) {
          emitProgress({
            type: 'complete',
            message: '새로운 기사가 없습니다',
            progress: 100,
            data: { new_articles: 0, created_articles: 0 }
          });
          return;
        }
        
        emitProgress({
          type: 'rss_complete',
          message: `📊 총 ${articles.length}개 기사 발견`,
          progress: 20,
          data: { total_articles: articles.length }
        });
        
        // 2단계: AI 기사 생성
        const processArticles = articles.slice(0, limit);
        const generatedArticles = [];
        const errors = [];
        
        for (let i = 0; i < processArticles.length; i++) {
          const article = processArticles[i];
          const progress = 20 + ((i + 1) / processArticles.length) * 70;
          
          try {
            emitProgress({
              type: 'processing',
              message: `🔄 처리 중 (${i + 1}/${processArticles.length}): ${article.title.substring(0, 50)}...`,
              progress: Math.round(progress),
              current_article: {
                index: i + 1,
                total: processArticles.length,
                title: article.title,
                source: article.source
              }
            });
            
            // AI 기사 생성
            emitProgress({
              type: 'ai_generating',
              message: '✍️ AI 기사 생성 중...',
              progress: Math.round(progress + 10)
            });
            
            const generated = await openaiService.generateArticle(article);
            const qualityScore = openaiService.calculateQualityScore(generated);
            
            emitProgress({
              type: 'ai_complete',
              message: `✅ AI 기사 생성 완료: "${generated.title}"`,
              progress: Math.round(progress + 15)
            });
            
            // 기사 저장
            const savedArticle = articleStorage.saveArticle({
              ...generated,
              quality_score: qualityScore,
              source_url: article.link,
              source_title: article.title,
              source: article.source,
              category: article.category,
              status: qualityScore >= 80 ? 'published' : 'draft'
            });
            
            generatedArticles.push({
              ...savedArticle,
              auto_publish: qualityScore >= 80
            });
            
            emitProgress({
              type: 'article_saved',
              message: `📝 기사 저장 완료 (품질 점수: ${qualityScore}점)`,
              progress: Math.round(progress + 20),
              article: {
                id: savedArticle.id,
                title: generated.title,
                quality_score: qualityScore,
                status: savedArticle.status
              }
            });
            
            // API 제한 고려 딜레이
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error(`❌ 기사 생성 실패: ${article.title}`, error.message);
            errors.push({
              article: article.title,
              error: error.message
            });
            
            emitProgress({
              type: 'error',
              message: `❌ 기사 생성 실패: ${article.title}`,
              progress: Math.round(progress),
              error: error.message
            });
          }
        }
        
        // 완료
        emitProgress({
          type: 'complete',
          message: `🎉 자동화 프로세스 완료! ${generatedArticles.length}개 기사 생성`,
          progress: 100,
          data: {
            new_articles: articles.length,
            created_articles: generatedArticles.length,
            errors: errors.length,
            generated_articles: generatedArticles,
            error_details: errors,
            cost_info: openaiService.getCostInfo()
          }
        });
        
      } catch (error) {
        console.error('실시간 자동화 프로세스 오류:', error);
        emitProgress({
          type: 'error',
          message: '자동화 프로세스 실행 중 오류가 발생했습니다',
          progress: 0,
          error: error.message
        });
      }
    });
    
  } catch (error) {
    console.error('실시간 자동화 시작 오류:', error);
    res.status(500).json({
      success: false,
      error: '실시간 자동화 프로세스 시작 중 오류가 발생했습니다',
      details: error.message
    });
  }
});

// 기사 관리 API
router.get('/articles', (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const result = articleStorage.getArticles({ status, page, limit });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('기사 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '기사 목록을 불러오는데 실패했습니다',
      details: error.message
    });
  }
});

router.get('/articles/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const article = articleStorage.getArticleById(id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: '기사를 찾을 수 없습니다'
      });
    }
    
    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('기사 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '기사 조회 중 오류가 발생했습니다',
      details: error.message
    });
  }
});

router.delete('/articles/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = articleStorage.deleteArticle(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '삭제할 기사를 찾을 수 없습니다'
      });
    }
    
    res.json({
      success: true,
      message: `기사 ID ${id}가 삭제되었습니다`
    });
  } catch (error) {
    console.error('기사 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: '기사 삭제 중 오류가 발생했습니다',
      details: error.message
    });
  }
});

// 시스템 통계 API
router.get('/stats', (req, res) => {
  try {
    const openaiCost = openaiService.getCostInfo();
    const articleStats = articleStorage.getStats();
    
    res.json({
      success: true,
      data: {
        ...articleStats,
        estimated_cost: openaiCost.estimatedCost || 0,
        system_status: 'running',
        last_scan: new Date().toISOString(),
        api_status: {
          openai: openaiService.isConfigured,
          google_search: imageService.isConfigured,
          cloudflare: cloudflareService.isConfigured
        }
      }
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '통계 정보를 불러오는데 실패했습니다',
      details: error.message
    });
  }
});

// 설정 관리 API
router.get('/settings', (req, res) => {
  res.json({
    success: true,
    data: {
      rss_feeds: [
        'https://news.google.com/rss?topic=h&hl=ko&gl=KR&ceid=KR:ko',
        'https://news.google.com/rss?topic=b&hl=ko&gl=KR&ceid=KR:ko'
      ],
      automation_mode: process.env.AUTO_PUBLISH_ENABLED === 'true',
      scan_interval: process.env.SCAN_INTERVAL_MINUTES || 30,
      quality_threshold: process.env.QUALITY_THRESHOLD || 80,
      openai_configured: openaiService.isConfigured,
      google_search_configured: imageService.isConfigured,
      cloudflare_configured: cloudflareService.isConfigured,
      github_configured: !!process.env.GITHUB_TOKEN
    }
  });
});

router.post('/settings/api-keys', (req, res) => {
  try {
    const { 
      openai_api_key, 
      google_search_api_key, 
      google_search_engine_id, 
      cloudflare_account_id, 
      cloudflare_api_token,
      github_token 
    } = req.body;

    const fs = require('fs');
    const path = require('path');
    
    // 현재 .env 파일 읽기
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // 환경변수 업데이트 함수
    const updateEnvVar = (key, value) => {
      if (!value) return;
      
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}=${value}`;
      
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        envContent += envContent.endsWith('\n') ? newLine + '\n' : '\n' + newLine + '\n';
      }
      
      // 실시간으로 process.env 업데이트
      process.env[key] = value;
    };

    // API 키들 환경변수에 저장
    if (openai_api_key) {
      updateEnvVar('OPENAI_API_KEY', openai_api_key);
      openaiService.setApiKey(openai_api_key);
    }

    if (google_search_api_key && google_search_engine_id) {
      updateEnvVar('GOOGLE_SEARCH_API_KEY', google_search_api_key);
      updateEnvVar('GOOGLE_SEARCH_ENGINE_ID', google_search_engine_id);
      imageService.setApiKeys(google_search_api_key, google_search_engine_id);
    }

    if (cloudflare_account_id && cloudflare_api_token) {
      updateEnvVar('CLOUDFLARE_ACCOUNT_ID', cloudflare_account_id);
      updateEnvVar('CLOUDFLARE_API_TOKEN', cloudflare_api_token);
      cloudflareService.setApiKeys(cloudflare_account_id, cloudflare_api_token);
    }

    if (github_token) {
      updateEnvVar('GITHUB_TOKEN', github_token);
    }

    // .env 파일에 저장
    fs.writeFileSync(envPath, envContent);

    res.json({
      success: true,
      message: 'API 키가 성공적으로 설정되고 저장되었습니다',
      data: {
        openai_configured: openaiService.isConfigured,
        google_search_configured: imageService.isConfigured,
        cloudflare_configured: cloudflareService.isConfigured,
        github_configured: !!process.env.GITHUB_TOKEN
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'API 키 설정 중 오류가 발생했습니다',
      details: error.message
    });
  }
});

router.post('/settings', (req, res) => {
  // TODO: 설정 업데이트 구현
  res.json({
    success: true,
    message: '설정 업데이트 기능 구현 예정'
  });
});

module.exports = router; 