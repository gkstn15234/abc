const Parser = require('rss-parser');
const axios = require('axios');

class RSSService {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      customFields: {
        item: ['pubDate', 'creator', 'category']
      }
    });
    
    // 기본 RSS 피드 목록 (요청 시에만 생성)
    this.defaultFeeds = null;
  }

  /**
   * 모든 RSS 피드 생성
   * @returns {Array} 전체 RSS 피드 URL 배열
   */
  generateAllFeeds() {
    const baseFeeds = [
      'https://news.google.com/rss?topic=h&hl=ko&gl=KR&ceid=KR:ko', // Google 뉴스 헤드라인
      'https://news.google.com/rss?topic=b&hl=ko&gl=KR&ceid=KR:ko', // 비즈니스
      'https://news.google.com/rss?topic=tc&hl=ko&gl=KR&ceid=KR:ko'  // 기술
    ];

    const economyFeeds = this.generateEconomyKeywordFeeds();
    const automotiveFeeds = this.generateAutomotiveKeywordFeeds();

    console.log(`📡 RSS 피드 구성: 기본 ${baseFeeds.length}개 + 경제 ${economyFeeds.length}개 + 자동차 ${automotiveFeeds.length}개`);

    return [
      ...baseFeeds,
      ...economyFeeds,
      ...automotiveFeeds
    ];
  }

  /**
   * 경제 관련 키워드 RSS 피드 생성 (로테이션)
   * @returns {Array} 경제 키워드 RSS URL 배열
   */
  generateEconomyKeywordFeeds() {
    const economyKeywords = [
      '주식', '증시', '코스피', '금리', '투자', '부동산', 
      '비트코인', '환율', '경제', '금융', '기업실적', '영업이익'
    ];
    
    // 포그라운드 테스트용으로 2개씩만 선택 (로테이션)
    const selectedKeywords = this.selectRotatingKeywords(economyKeywords, 2, 'economy');
    
    return selectedKeywords.map(keyword => 
      `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`
    );
  }

  /**
   * 자동차 관련 키워드 RSS 피드 생성 (로테이션)
   * @returns {Array} 자동차 키워드 RSS URL 배열
   */
  generateAutomotiveKeywordFeeds() {
    const automotiveKeywords = [
      '현대자동차', '기아', '테슬라', '전기차', '자율주행', '신차',
      'BMW', '벤츠', '폭스바겐', '도요타', '배터리', '모빌리티'
    ];
    
    // 포그라운드 테스트용으로 2개씩만 선택 (로테이션)
    const selectedKeywords = this.selectRotatingKeywords(automotiveKeywords, 2, 'automotive');
    
    return selectedKeywords.map(keyword => 
      `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`
    );
  }

  /**
   * 로테이션 키워드 선택 (시간 기반)
   * @param {Array} keywords - 전체 키워드 배열
   * @param {number} count - 선택할 개수
   * @param {string} category - 카테고리 (로테이션 시드용)
   * @returns {Array} 선택된 키워드 배열
   */
  selectRotatingKeywords(keywords, count, category) {
    // 시간 기반 시드 생성 (1시간마다 변경)
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
    const categorySeed = category.charCodeAt(0);
    const seed = hourSeed + categorySeed;
    
    // 시드 기반 셔플
    const shuffled = [...keywords].sort(() => {
      return ((seed * 9301 + 49297) % 233280) / 233280 - 0.5;
    });
    
    return shuffled.slice(0, count);
  }

  /**
   * RSS 피드에서 최신 뉴스 가져오기
   * @param {string[]} feedUrls - RSS 피드 URL 배열
   * @returns {Promise<Array>} 파싱된 뉴스 기사 배열
   */
  async fetchLatestNews(feedUrls = null) {
    // 피드가 없으면 이제 생성
    if (!this.defaultFeeds) {
      this.defaultFeeds = this.generateAllFeeds();
    }
    
    const feeds = feedUrls || this.defaultFeeds;
    const allArticles = [];

    console.log(`📡 RSS 피드 스캔 시작: ${feeds.length}개 소스`);

    for (const feedUrl of feeds) {
      try {
        const articles = await this.parseSingleFeed(feedUrl);
        allArticles.push(...articles);
        console.log(`✅ ${feedUrl}: ${articles.length}개 기사 발견`);
      } catch (error) {
        console.error(`❌ RSS 파싱 실패 ${feedUrl}:`, error.message);
        continue;
      }
    }

    // 중복 제거 및 필터링
    const uniqueArticles = this.removeDuplicates(allArticles);
    const filteredArticles = await this.filterArticles(uniqueArticles);

    console.log(`📊 총 ${allArticles.length}개 발견 → ${filteredArticles.length}개 처리 대상`);
    
    return filteredArticles;
  }

  /**
   * 단일 RSS 피드 파싱
   * @param {string} feedUrl - RSS 피드 URL
   * @returns {Promise<Array>} 파싱된 기사 배열
   */
  async parseSingleFeed(feedUrl) {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      
      return feed.items.map(item => ({
        id: this.generateArticleId(item.link),
        title: this.cleanTitle(item.title),
        link: item.link,
        description: item.contentSnippet || item.description || '',
        pubDate: new Date(item.pubDate || item.isoDate),
        source: feed.title || 'Unknown',
        category: item.category || 'General',
        creator: item.creator || 'Unknown',
        feedUrl: feedUrl
      }));
    } catch (error) {
      throw new Error(`RSS 파싱 오류: ${error.message}`);
    }
  }

  /**
   * 중복 기사 제거 (URL 기준)
   * @param {Array} articles - 기사 배열
   * @returns {Array} 중복이 제거된 기사 배열
   */
  removeDuplicates(articles) {
    const seen = new Set();
    return articles.filter(article => {
      if (seen.has(article.link)) {
        return false;
      }
      seen.add(article.link);
      return true;
    });
  }

  /**
   * 기사 필터링 (품질 및 관련성 기준) - AI 판단 시스템 적용
   * @param {Array} articles - 기사 배열
   * @returns {Array} 필터링된 기사 배열
   */
  async filterArticles(articles) {
    // 1차 필터링: 기본 조건
    const basicFiltered = articles.filter(article => {
      // 기본 필터링 조건
      if (!article.title || article.title.length < 10) return false;
      if (!article.link || !article.link.startsWith('http')) return false;
      if (!article.description || article.description.length < 20) return false;
      
      // 최근 48시간 내 기사만 (키워드 검색으로 더 많은 소스가 있으므로 확장)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      if (article.pubDate < twoDaysAgo) return false;
      
      // 제외할 키워드
      const excludeKeywords = ['광고', '프로모션', '이벤트', 'AD', '스폰서', '협찬'];
      const titleLower = article.title.toLowerCase();
      if (excludeKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()))) {
        return false;
      }
      
      return true;
    });

    // 2차 필터링: AI 기반 종합 품질 점수 계산
    const scoredArticles = await this.calculateAIQualityScores(basicFiltered);

    // AI 점수와 최신순으로 정렬 (AI 점수 70%, 최신성 30%)
    const sortedArticles = scoredArticles.sort((a, b) => {
      const scoreA = (a.aiQualityScore * 0.7) + (this.calculateFreshnessScore(a) * 0.3);
      const scoreB = (b.aiQualityScore * 0.7) + (this.calculateFreshnessScore(b) * 0.3);
      
      return scoreB - scoreA;
    });

    console.log(`🎯 AI 품질 분석 완료: ${articles.length}개 → ${basicFiltered.length}개 → 상위 ${Math.min(5, sortedArticles.length)}개 선별`);
    console.log(`🏆 상위 5개 기사 AI 점수: ${sortedArticles.slice(0, 5).map(a => `${a.aiQualityScore.toFixed(1)}점`).join(', ')}`);
    
    return sortedArticles.slice(0, 5); // 최대 5개까지 (포그라운드 빠른 테스트용)
  }

  /**
   * AI 기반 기사 품질 점수 계산 (배치 처리)
   * @param {Array} articles - 기사 배열
   * @returns {Promise<Array>} AI 점수가 추가된 기사 배열
   */
  async calculateAIQualityScores(articles) {
    const openaiService = require('./openaiService');
    
    if (!openaiService.isConfigured) {
      console.warn('⚠️ OpenAI 미설정 - 기본 관련성 점수 사용');
      return articles.map(article => ({
        ...article,
        aiQualityScore: this.calculateRelevanceScore(article),
        aiAnalysis: '기본 점수 (AI 분석 불가)'
      }));
    }

    console.log(`🤖 ${articles.length}개 기사 AI 품질 분석 시작...`);
    
    // 배치 사이즈 (API 비용 고려) - 포그라운드 테스트용으로 축소
    const batchSize = 5;
    const analyzedArticles = [];
    
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      console.log(`🔍 기사 품질 분석 중 [${i + 1}-${Math.min(i + batchSize, articles.length)}/${articles.length}]`);
      
      try {
        const batchResults = await this.analyzeArticleBatch(batch);
        analyzedArticles.push(...batchResults);
        
        // API 호출 간격 (rate limit 방지)
        if (i + batchSize < articles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn(`배치 [${i + 1}-${Math.min(i + batchSize, articles.length)}] 분석 실패:`, error.message);
        // 실패한 배치는 기본 점수로 처리
        const fallbackBatch = batch.map(article => ({
          ...article,
          aiQualityScore: this.calculateRelevanceScore(article),
          aiAnalysis: '분석 실패 - 기본 점수'
        }));
        analyzedArticles.push(...fallbackBatch);
      }
    }
    
    return analyzedArticles;
  }

  /**
   * 기사 배치 AI 분석
   * @param {Array} articles - 분석할 기사 배열
   * @returns {Promise<Array>} 분석된 기사 배열
   */
  async analyzeArticleBatch(articles) {
    const openaiService = require('./openaiService');
    
    const prompt = `다음 뉴스 기사들을 분석하여 각각의 품질과 인기도를 0-100점으로 평가해주세요.

평가 기준:
1. 📰 뉴스가치 (30점): 독창성, 시의성, 사회적 영향력
2. 🔥 인기도 예상 (25점): 독자 관심도, 화제성, 검색량 예상
3. 📝 제목 품질 (20점): 명확성, 매력도, 클릭베이트 여부 
4. 📄 내용 품질 (15점): 정보성, 구체성, 신뢰성
5. ⚡ 시급성 (10점): 실시간성, 속보성, 트렌드 연관성

기사 목록:
${articles.map((article, index) => `
[기사 ${index + 1}]
제목: ${article.title}
요약: ${article.description.substring(0, 200)}...
출처: ${article.source}
발행: ${this.formatTimeAgo(article.pubDate)}
`).join('\n')}

JSON 형식으로 응답해주세요:
{
  "analyses": [
    {
      "index": 1,
      "score": 85,
      "newsValue": 27,
      "popularity": 22,
      "titleQuality": 18,
      "contentQuality": 13,
      "urgency": 5,
      "reason": "구체적인 평가 이유",
      "category": "경제/자동차/기술/정치/사회",
      "expectedEngagement": "high/medium/low"
    }
  ]
}`;

    try {
      const response = await openaiService.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: '당신은 뉴스 품질 분석 전문가입니다. 기사의 뉴스가치, 인기도, 품질을 정확하게 평가합니다.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const analysisText = response.choices[0].message.content.trim();
      console.log('🤖 AI 분석 응답:', analysisText.substring(0, 200) + '...');
      
      // JSON 파싱
      const analysisData = this.parseAIAnalysis(analysisText);
      
      // 토큰 사용량 추적
      openaiService.updateCostTracker(response.usage);
      
      // 기사에 AI 점수 추가
      return articles.map((article, index) => {
        const analysis = analysisData.analyses?.[index] || {
          score: this.calculateRelevanceScore(article),
          reason: '분석 실패 - 기본 점수',
          category: 'Unknown',
          expectedEngagement: 'medium'
        };
        
        return {
          ...article,
          aiQualityScore: analysis.score,
          aiAnalysis: analysis.reason,
          aiCategory: analysis.category,
          expectedEngagement: analysis.expectedEngagement,
          detailedScores: {
            newsValue: analysis.newsValue || 15,
            popularity: analysis.popularity || 12,
            titleQuality: analysis.titleQuality || 10,
            contentQuality: analysis.contentQuality || 8,
            urgency: analysis.urgency || 5
          }
        };
      });
      
    } catch (error) {
      console.error('AI 분석 실패:', error.message);
      throw error;
    }
  }

  /**
   * AI 분석 결과 파싱
   * @param {string} analysisText - AI 응답 텍스트
   * @returns {Object} 파싱된 분석 결과
   */
  parseAIAnalysis(analysisText) {
    try {
      // JSON 추출
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없음');
      }
      
      const jsonText = jsonMatch[0];
      return JSON.parse(jsonText);
    } catch (error) {
      console.warn('AI 분석 파싱 실패:', error.message);
      return { analyses: [] };
    }
  }

  /**
   * 신선도 점수 계산
   * @param {Object} article - 기사 객체
   * @returns {number} 신선도 점수 (0-100)
   */
  calculateFreshnessScore(article) {
    const now = Date.now();
    const articleTime = new Date(article.pubDate).getTime();
    const ageHours = (now - articleTime) / (1000 * 60 * 60);
    
    // 시간별 신선도 점수 (최신일수록 높은 점수)
    if (ageHours <= 1) return 100;      // 1시간 이내
    if (ageHours <= 3) return 90;       // 3시간 이내  
    if (ageHours <= 6) return 80;       // 6시간 이내
    if (ageHours <= 12) return 70;      // 12시간 이내
    if (ageHours <= 24) return 60;      // 24시간 이내
    if (ageHours <= 48) return 40;      // 48시간 이내
    
    return 20; // 48시간 초과
  }

  /**
   * 시간 경과 표시 (AI 분석용)
   * @param {Date} date - 날짜
   * @returns {string} 시간 경과 문자열
   */
  formatTimeAgo(date) {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  }

  /**
   * 기사 관련성 점수 계산
   * @param {Object} article - 기사 객체
   * @returns {number} 관련성 점수 (0-100)
   */
  calculateRelevanceScore(article) {
    let score = 50; // 기본 점수

    const titleLower = article.title.toLowerCase();
    const descLower = article.description.toLowerCase();
    const combinedText = titleLower + ' ' + descLower;

    // 경제 키워드 점수
    const economyKeywords = ['주식', '증시', '코스피', '금리', '투자', '부동산', '비트코인', '환율', '경제', '금융', '기업', '실적'];
    const economyMatches = economyKeywords.filter(keyword => combinedText.includes(keyword)).length;
    score += economyMatches * 5;

    // 자동차 키워드 점수
    const autoKeywords = ['현대', '기아', '테슬라', '전기차', '자율주행', '신차', 'bmw', '벤츠', '자동차', '모빌리티'];
    const autoMatches = autoKeywords.filter(keyword => combinedText.includes(keyword)).length;
    score += autoMatches * 5;

    // 최신성 보너스 (6시간 이내)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    if (article.pubDate > sixHoursAgo) {
      score += 10;
    }

    // 제목 길이 적정성
    if (article.title.length >= 15 && article.title.length <= 50) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * 제목 정리 (HTML 태그 제거 등)
   * @param {string} title - 원본 제목
   * @returns {string} 정리된 제목
   */
  cleanTitle(title) {
    if (!title) return '';
    
    return title
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 기사 ID 생성 (URL 기반 해시)
   * @param {string} url - 기사 URL
   * @returns {string} 고유 ID
   */
  generateArticleId(url) {
    return Buffer.from(url).toString('base64').slice(0, 12);
  }

  /**
   * RSS 피드 유효성 검사
   * @param {string} feedUrl - 검사할 RSS URL
   * @returns {Promise<boolean>} 유효성 여부
   */
  async validateFeed(feedUrl) {
    try {
      const response = await axios.get(feedUrl, { timeout: 5000 });
      const contentType = response.headers['content-type'] || '';
      
      return contentType.includes('xml') || contentType.includes('rss');
    } catch (error) {
      console.error(`RSS 피드 검증 실패 ${feedUrl}:`, error.message);
      return false;
    }
  }
}

module.exports = new RSSService(); 