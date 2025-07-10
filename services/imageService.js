const axios = require('axios');

class ImageService {
  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || 'AIzaSyC0BHxDc-nmMxDFF8SyCP7UCzr_ACyOl8w';
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || 'c685a3cb2a7204e1c';
    this.isConfigured = !!(this.apiKey && this.searchEngineId);
    
    if (!this.isConfigured) {
      console.warn('⚠️ Google Custom Search API가 설정되지 않았습니다. 웹 인터페이스에서 설정해주세요.');
    }
    
    this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
  }

  /**
   * 스마트 이미지 검색 (AI 교차 검증 방식) - 4개 이미지별로 100개씩 총 400개 분석
   * @param {string} title - 기사 제목
   * @param {Array} keywords - 검색 키워드 배열
   * @param {number} count - 검색할 이미지 수 (기본 4개)
   * @param {string} content - 기사 내용 (선택사항)
   * @returns {Promise<Array>} 이미지 검색 결과 배열
   */
  async searchImages(title, keywords = [], count = 4, content = '') {
    if (!this.isConfigured) {
      throw new Error('Google Custom Search API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.');
    }
    
    try {
      console.log(`🎯 각 이미지별로 100개씩 검색하여 총 ${count * 100}개 이미지 분석 시작!`);
      
      const finalSelectedImages = [];
      
      // 각 이미지 위치별로 별도 검색 (썸네일, 본문1, 본문2, 본문3)
      for (let imageIndex = 0; imageIndex < count; imageIndex++) {
        const imageType = imageIndex === 0 ? '썸네일' : `본문${imageIndex}`;
        console.log(`\n🖼️ ===== ${imageType} 이미지 검색 시작 (${imageIndex + 1}/${count}) =====`);
        
        // 각 이미지별로 맞춤 검색어 생성
        const customQuery = await this.generateImageSpecificQuery(title, content, keywords, imageIndex);
        console.log(`🔍 ${imageType} 맞춤 검색어: "${customQuery}"`);
        
        // 해당 이미지를 위한 100개 후보 수집
        const imageCandidates = await this.searchSingleImageCandidates(customQuery, title, content, keywords, imageType);
        
        console.log(`✅ ${imageType}: ${imageCandidates.length}개 후보 수집 완료`);
        
        if (imageCandidates.length > 0) {
          // AI 분석하여 최적의 1개 선택
          const bestImage = await this.selectBestImageWithAI(imageCandidates, title, content, keywords, imageType);
          
          if (bestImage) {
            finalSelectedImages.push({
              ...bestImage,
              imageIndex,
              imageType,
              selectedFrom: imageCandidates.length
            });
            console.log(`🏆 ${imageType} 최종 선택: ${bestImage.title} (점수: ${bestImage.finalScore?.toFixed(1)}점)`);
          }
        } else {
          console.warn(`⚠️ ${imageType}: 적합한 이미지를 찾지 못했습니다`);
        }
      }
      
      console.log(`\n🎯 전체 이미지 검색 완료!`);
      console.log(`📊 총 분석된 이미지: ${count * 100}개 (목표)`);
      console.log(`📊 최종 선택된 이미지: ${finalSelectedImages.length}개`);
      
      return finalSelectedImages;

    } catch (error) {
      console.error('이미지 검색 오류:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * 이미지 위치별 맞춤 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @param {Array} keywords - 키워드 배열
   * @param {number} imageIndex - 이미지 인덱스 (0=썸네일, 1,2,3=본문)
   * @returns {Promise<string>} 맞춤 검색어
   */
  async generateImageSpecificQuery(title, content, keywords, imageIndex) {
    const openaiService = require('./openaiService');
    
    // 이미지 위치별 특성 정의
    const imageSpecs = {
      0: { type: '썸네일', purpose: '기사 전체를 대표하는 주요 이미지', focus: '제목 핵심 키워드' },
      1: { type: '본문1', purpose: '기사 도입부를 설명하는 이미지', focus: '상황 설명' },
      2: { type: '본문2', purpose: '기사 핵심 내용을 보여주는 이미지', focus: '핵심 내용' },
      3: { type: '본문3', purpose: '기사 결론이나 전망을 나타내는 이미지', focus: '결과/전망' }
    };
    
    const spec = imageSpecs[imageIndex] || imageSpecs[0];
    
    if (openaiService.isConfigured) {
      try {
        console.log(`🤖 ${spec.type} 맞춤 검색어 생성 중...`);
        const customQuery = await openaiService.generateImageSpecificSearchQuery(title, content, keywords, spec);
        return customQuery;
      } catch (error) {
        console.warn(`${spec.type} 맞춤 검색어 생성 실패:`, error.message);
      }
    }
    
    // 폴백: 기본 검색어 생성
    return this.generateSearchQuery(title, keywords);
  }

  /**
   * 단일 이미지를 위한 100개 후보 수집
   * @param {string} query - 기본 검색어
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @param {Array} keywords - 키워드 배열
   * @param {string} imageType - 이미지 타입
   * @returns {Promise<Array>} 이미지 후보 배열
   */
  async searchSingleImageCandidates(query, title, content, keywords, imageType) {
    const allImages = [];
    const targetCount = 100;
    
    // 메인 검색 파라미터 (medium과 large 모두 검색)
    const baseParams = {
      key: this.apiKey,
      cx: this.searchEngineId,
      searchType: 'image',
      safe: 'medium',
      imgType: 'photo',
      fileType: 'jpg,png,webp'
    };

    // 1차: 대형 이미지 검색
    try {
      const largeParams = { ...baseParams, q: query, imgSize: 'large', num: 10 };
      console.log(`🔍 ${imageType} 대형 이미지 검색...`);
      
      const largeResponse = await axios.get(this.baseUrl, { params: largeParams, timeout: 15000 });
      if (largeResponse.data.items) {
        const largeImages = largeResponse.data.items
          .filter(item => this.isHighQualityImage(item))
          .map(item => this.formatImageResult(item, query, 'large'));
        allImages.push(...largeImages);
        console.log(`✅ 대형 이미지: ${largeImages.length}개 수집`);
      }
    } catch (error) {
      console.warn(`${imageType} 대형 이미지 검색 실패:`, error.message);
    }

    // 2차: 중형 이미지 검색 (부족할 경우)
    if (allImages.length < targetCount) {
      try {
        const mediumParams = { ...baseParams, q: query, imgSize: 'medium', num: 10 };
        console.log(`🔍 ${imageType} 중형 이미지 검색...`);
        
        const mediumResponse = await axios.get(this.baseUrl, { params: mediumParams, timeout: 15000 });
        if (mediumResponse.data.items) {
          const mediumImages = mediumResponse.data.items
            .filter(item => this.isHighQualityImage(item))
            .filter(item => !allImages.some(img => img.link === item.link))
            .map(item => this.formatImageResult(item, query, 'medium'));
          allImages.push(...mediumImages);
          console.log(`✅ 중형 이미지: ${mediumImages.length}개 수집`);
        }
      } catch (error) {
        console.warn(`${imageType} 중형 이미지 검색 실패:`, error.message);
      }
    }

    // 3차~12차: 다양한 검색 전략
    const strategies = [
      { query: keywords.slice(0, 2).join(' '), name: 'keywords' },
      { query: await this.translateToEnglish(query), name: 'english' },
      { query: this.generateCategoryBasedQuery(title, keywords), name: 'category' },
      { query: this.extractBrandQuery(title), name: 'brand' },
      { query: this.extractObjectQuery(title, content), name: 'object' },
      { query: this.generateVisualQuery(title, content), name: 'visual' },
      { query: this.generateIndustryQuery(title, content), name: 'industry' },
      { query: this.generateEmotionalQuery(title, content), name: 'emotional' },
      { query: this.generateSceneQuery(title, content), name: 'scene' },
      { query: this.generateAdvancedQuery(title, content, keywords), name: 'advanced' }
    ];

    for (const strategy of strategies) {
      if (allImages.length >= targetCount) break;
      if (!strategy.query || strategy.query.trim().length === 0) continue;
      
      console.log(`🔍 ${imageType} ${strategy.name}: "${strategy.query}"`);
      
      try {
        // large, medium, 그리고 사이즈 제한 없이 모두 시도
        for (const size of ['large', 'medium', 'any']) {
          if (allImages.length >= targetCount) break;
          
          const strategyParams = {
            ...baseParams,
            q: strategy.query,
            num: Math.min(10, targetCount - allImages.length)
          };

          // 사이즈 파라미터 조건부 추가
          if (size !== 'any') {
            strategyParams.imgSize = size;
          }

          const response = await axios.get(this.baseUrl, { params: strategyParams, timeout: 10000 });
          if (response.data.items) {
            const newImages = response.data.items
              .filter(item => this.isHighQualityImage(item))
              .filter(item => !allImages.some(img => img.link === item.link))
              .map(item => this.formatImageResult(item, strategy.query, `${strategy.name}-${size}`));
            
            allImages.push(...newImages);
          }
          
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
        }
        
        console.log(`✅ ${strategy.name}: 총 ${allImages.length}개 수집`);
        
      } catch (error) {
        console.warn(`${imageType} ${strategy.name} 검색 실패:`, error.message);
      }
    }

    // 중복 제거 및 점수 정렬
    const uniqueImages = allImages
      .filter((img, index, self) => index === self.findIndex(t => t.link === img.link))
      .sort((a, b) => b.score - a.score)
      .slice(0, targetCount);

    console.log(`📊 ${imageType} 최종 후보: ${uniqueImages.length}개 (목표: ${targetCount}개)`);
    
    return uniqueImages;
  }

  /**
   * 이미지 결과 포맷팅
   * @param {Object} item - Google 검색 결과
   * @param {string} query - 검색어
   * @param {string} source - 검색 소스
   * @returns {Object} 포맷된 이미지 정보
   */
  formatImageResult(item, query, source) {
    return {
      title: item.title,
      link: item.link,
      thumbnail: item.image.thumbnailLink,
      contextLink: item.image.contextLink,
      width: item.image.width,
      height: item.image.height,
      size: item.image.byteSize,
      format: this.getImageFormat(item.link),
      score: this.calculateRelevanceScore(item, query),
      source: source
    };
  }

  /**
   * 검색 쿼리 생성
   * @param {string} title - 기사 제목
   * @param {Array} keywords - 키워드 배열
   * @returns {string} 최적화된 검색 쿼리
   */
  generateSearchQuery(title, keywords) {
    // 제목에서 핵심 키워드 추출
    const titleKeywords = this.extractKeywords(title);
    
    // 모든 키워드 결합
    const allKeywords = [...titleKeywords, ...keywords];
    
    // 중복 제거 및 정리
    const uniqueKeywords = [...new Set(allKeywords)]
      .filter(keyword => keyword.length > 1)
      .slice(0, 3); // 최대 3개 키워드
    
    return uniqueKeywords.join(' ');
  }

  /**
   * 제목에서 핵심 키워드 추출
   * @param {string} title - 기사 제목
   * @returns {Array} 추출된 키워드 배열
   */
  extractKeywords(title) {
    // 불용어 목록
    const stopWords = [
      '이', '그', '저', '것', '들', '의', '가', '에', '을', '를', '과', '와',
      '는', '은', '도', '만', '라', '이나', '나', '부터', '까지', '로', '으로',
      '에서', '에게', '한테', '보다', '처럼', '같이', '함께', '통해', '위해',
      '때문에', '따라', '위해서', '그래서', '하지만', '그러나', '따라서',
      '뉴스', '기사', '보도', '발표', '공개', '밝혀', '전해', '알려',
      '테스트', 'AI', '인공지능'
    ];

    return title
      .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.includes(word))
      .slice(0, 5);
  }

  /**
   * 이미지 관련성 점수 계산
   * @param {Object} item - Google 검색 결과 아이템
   * @param {string} query - 검색 쿼리
   * @returns {number} 관련성 점수 (0-100)
   */
  calculateRelevanceScore(item, query) {
    let score = 50; // 기본 점수

    // 제목 관련성
    const titleMatch = this.calculateTextSimilarity(item.title.toLowerCase(), query.toLowerCase());
    score += titleMatch * 30;

    // 이미지 크기 보너스 (너무 작거나 큰 이미지 페널티)
    const width = item.image.width || 0;
    const height = item.image.height || 0;
    
    if (width >= 300 && width <= 1200 && height >= 200 && height <= 800) {
      score += 10;
    } else if (width < 200 || height < 150) {
      score -= 20;
    }

    // 파일 형식 보너스
    const format = this.getImageFormat(item.link);
    if (['jpg', 'jpeg', 'png', 'webp'].includes(format)) {
      score += 5;
    }

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 텍스트 유사도 계산 (간단한 버전)
   * @param {string} text1 - 첫 번째 텍스트
   * @param {string} text2 - 두 번째 텍스트
   * @returns {number} 유사도 (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * 이미지 파일 형식 추출
   * @param {string} url - 이미지 URL
   * @returns {string} 파일 형식
   */
  getImageFormat(url) {
    const match = url.match(/\.([^.?]+)(\?|$)/);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * 고품질 이미지 필터링 (완화된 기준)
   * @param {Object} item - Google 검색 결과 아이템
   * @returns {boolean} 고품질 여부
   */
  isHighQualityImage(item) {
    const width = item.image.width || 0;
    const height = item.image.height || 0;
    const size = item.image.byteSize || 0;

    // 최소 크기 기준 대폭 완화 (400x300 이상)
    if (width < 400 || height < 300) {
      return false;
    }

    // 크기 제한 완화 (20MB 이하)
    if (size > 20000000) { // 20MB
      return false;
    }

    // 파일 형식 제한 (jpg, png, webp, gif 허용)
    const format = this.getImageFormat(item.link);
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(format)) {
      return false;
    }

    // 아주 작은 아이콘만 제외 (200x150 이하)
    if (width < 200 || height < 150) {
      return false;
    }

    return true;
  }

  /**
   * 소스 분포 통계 반환
   * @param {Array} images - 이미지 배열
   * @returns {string} 소스별 분포 문자열
   */
  getSourceDistribution(images) {
    const sourceCounts = {};
    images.forEach(img => {
      sourceCounts[img.source] = (sourceCounts[img.source] || 0) + 1;
    });

    return Object.entries(sourceCounts)
      .map(([source, count]) => `${source}: ${count}개`)
      .join(', ');
  }

  /**
   * 영어 검색어로 번역
   * @param {string} query - 한국어 검색어
   * @returns {Promise<string>} 영어 검색어
   */
  async translateToEnglish(query) {
    const openaiService = require('./openaiService');
    if (!openaiService.isConfigured) {
      console.warn('OpenAI 미설정, 영어 번역 불가');
      return query;
    }

    try {
      console.log('🔄 한국어 검색어를 영어로 번역 중...');
      const translatedQuery = await openaiService.translateToEnglish(query);
      console.log(`✅ 번역된 영어 검색어: "${translatedQuery}"`);
      return translatedQuery;
    } catch (error) {
      console.warn('영어 번역 실패, 원본 검색어 사용:', error.message);
      return query;
    }
  }

  /**
   * 카테고리 기반 검색어 생성
   * @param {string} title - 기사 제목
   * @param {Array} keywords - 키워드 배열
   * @returns {string} 카테고리 기반 검색어
   */
  generateCategoryBasedQuery(title, keywords) {
    // 자동차 관련
    if (title.includes('자동차') || title.includes('차') || title.includes('자율주행')) {
      return `자동차 vehicle car ${keywords.join(' ')}`.trim();
    }
    // 경제 관련
    if (title.includes('주가') || title.includes('투자') || title.includes('경제')) {
      return `stock market chart graph ${keywords.join(' ')}`.trim();
    }
    // 기술 관련
    if (title.includes('AI') || title.includes('인공지능') || title.includes('기술')) {
      return `technology artificial intelligence ${keywords.join(' ')}`.trim();
    }
    
    return `${title} ${keywords.join(' ')}`.trim();
  }

  /**
   * 브랜드명 중심 검색어 생성
   * @param {string} title - 기사 제목
   * @returns {string} 브랜드명 중심 검색어
   */
  extractBrandQuery(title) {
    const brands = {
      '현대': 'Hyundai Motor',
      '기아': 'KIA Motors',
      '테슬라': 'Tesla',
      '삼성': 'Samsung',
      '애플': 'Apple',
      'LG': 'LG Electronics',
      'SK': 'SK Group',
      '네이버': 'Naver',
      '카카오': 'Kakao',
      '현대차': 'Hyundai Motor',
      '기아차': 'KIA Motors'
    };
    
    for (const [korean, english] of Object.entries(brands)) {
      if (title.includes(korean)) {
        return `${english} ${korean}`;
      }
    }
    
    return title.replace(/[^\w\s가-힣]/g, ' ').trim();
  }

  /**
   * 제품/객체 중심 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @returns {string} 제품/객체 중심 검색어
   */
  extractObjectQuery(title, content) {
    // 구체적 제품명 추출 시도
    const productKeywords = [
      '아이폰', '갤럭시', '아이패드', '맥북',
      '아이오닉', '모델', '소나타', 'EV6',
      '스마트폰', '노트북', '전기차', '태블릿'
    ];
    
    const foundProduct = productKeywords.find(keyword => 
      title.includes(keyword) || content.includes(keyword)
    );
    
    if (foundProduct) {
      return `${foundProduct} product device`;
    }
    
    // 일반적인 객체 키워드
    if (title.includes('자동차') || title.includes('차')) {
      return 'car automobile vehicle';
    }
    if (title.includes('건물') || title.includes('건설')) {
      return 'building construction architecture';
    }
    if (title.includes('음식') || title.includes('요리')) {
      return 'food cooking restaurant';
    }
    
    return title.split(' ').slice(0, 3).join(' ');
  }

  /**
   * 시각적 요소 중심 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @returns {string} 시각적 요소 중심 검색어
   */
  generateVisualQuery(title, content) {
    // 차트나 그래프가 필요한 경우
    if (title.includes('상승') || title.includes('하락') || title.includes('증가') || title.includes('감소')) {
      return 'chart graph statistics data visualization';
    }
    
    // 실제 현장 사진이 필요한 경우
    if (title.includes('현장') || title.includes('사고') || title.includes('공사')) {
      return 'real scene actual photo documentary';
    }
    
    // 인물 사진이 필요한 경우
    if (title.includes('CEO') || title.includes('대표') || title.includes('사장')) {
      return 'business person executive professional';
    }
    
    // 제품 사진이 필요한 경우
    if (title.includes('출시') || title.includes('신제품') || title.includes('새로운')) {
      return 'product launch new release';
    }
    
    return 'professional photo high quality image';
  }

  /**
   * 업계 용어 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @returns {string} 업계 용어 검색어
   */
  generateIndustryQuery(title, content) {
    const combinedText = `${title} ${content}`.toLowerCase();
    
    // 자동차 업계
    if (combinedText.includes('자동차') || combinedText.includes('자율주행')) {
      return 'automotive industry car manufacturing';
    }
    
    // IT 업계
    if (combinedText.includes('it') || combinedText.includes('소프트웨어') || combinedText.includes('앱')) {
      return 'technology IT software development';
    }
    
    // 금융 업계
    if (combinedText.includes('은행') || combinedText.includes('금융') || combinedText.includes('투자')) {
      return 'finance banking investment';
    }
    
    // 건설 업계
    if (combinedText.includes('건설') || combinedText.includes('부동산')) {
      return 'construction real estate building';
    }
    
    return 'industry business corporate';
  }

  /**
   * 감정/상황 기반 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @returns {string} 감정/상황 기반 검색어
   */
  generateEmotionalQuery(title, content) {
    const combinedText = `${title} ${content}`.toLowerCase();
    
    // 긍정적 상황
    if (combinedText.includes('성공') || combinedText.includes('증가') || combinedText.includes('상승')) {
      return 'success growth positive achievement';
    }
    
    // 부정적 상황
    if (combinedText.includes('위기') || combinedText.includes('감소') || combinedText.includes('하락')) {
      return 'crisis decline negative problem';
    }
    
    // 혁신적 상황
    if (combinedText.includes('혁신') || combinedText.includes('새로운') || combinedText.includes('첫')) {
      return 'innovation breakthrough new revolutionary';
    }
    
    // 경쟁적 상황
    if (combinedText.includes('경쟁') || combinedText.includes('vs') || combinedText.includes('비교')) {
      return 'competition comparison rivalry';
    }
    
    return 'business situation modern';
  }

  /**
   * 구체적 장면 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @returns {string} 구체적 장면 검색어
   */
  generateSceneQuery(title, content) {
    const combinedText = `${title} ${content}`.toLowerCase();
    
    // 회의 장면
    if (combinedText.includes('회의') || combinedText.includes('미팅') || combinedText.includes('논의')) {
      return 'business meeting conference discussion';
    }
    
    // 공장 장면
    if (combinedText.includes('생산') || combinedText.includes('제조') || combinedText.includes('공장')) {
      return 'factory manufacturing production line';
    }
    
    // 도로 장면
    if (combinedText.includes('도로') || combinedText.includes('교통') || combinedText.includes('운전')) {
      return 'road traffic driving street';
    }
    
    // 오피스 장면
    if (combinedText.includes('사무실') || combinedText.includes('업무') || combinedText.includes('직장')) {
      return 'office workplace business environment';
    }
    
    return 'real life scene actual situation';
  }

  /**
   * 고급 조합 검색어 생성
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @param {Array} keywords - 키워드 배열
   * @returns {string} 고급 조합 검색어
   */
  generateAdvancedQuery(title, content, keywords) {
    // 핵심 키워드 추출
    const coreKeywords = this.extractKeywords(title);
    
    // 브랜드명 추출
    const brandQuery = this.extractBrandQuery(title);
    
    // 카테고리 키워드 추출
    const categoryQuery = this.generateCategoryBasedQuery(title, keywords);
    
    // 모든 요소를 조합하여 최적 검색어 생성
    const combinedKeywords = [
      ...coreKeywords.slice(0, 2),
      brandQuery.split(' ')[0], // 첫 번째 브랜드 키워드만
      ...keywords.slice(0, 1)
    ].filter(keyword => keyword && keyword.length > 1);
    
    return [...new Set(combinedKeywords)].slice(0, 5).join(' ');
  }

  /**
   * 이미지 위치별 최적 이미지 선택 (AI 분석 포함)
   * @param {Array} images - 이미지 후보 배열
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @param {Array} keywords - 키워드 배열
   * @param {string} imageType - 이미지 타입
   * @returns {Promise<Object|null>} 선택된 이미지 또는 null
   */
  async selectBestImageWithAI(images, title, content, keywords, imageType) {
    const openaiService = require('./openaiService');
    if (!openaiService.isConfigured) {
      console.warn('OpenAI 미설정, 이미지 AI 분석 불가');
      return this.selectBestImage(images, { minWidth: 800, minHeight: 600 }); // 기본 선택
    }

    const articleContext = `제목: ${title}\n내용: ${content || '내용 없음'}\n태그: ${keywords.join(', ')}`;
    const analyzedImages = [];

    // 모든 이미지 분석 (최대 100개)
    const imagesToAnalyze = images.slice(0, Math.min(100, images.length));
    
    console.log(`🔍 총 ${imagesToAnalyze.length}개 이미지 AI 분석 시작...`);
    
    for (let i = 0; i < imagesToAnalyze.length; i++) {
      const image = imagesToAnalyze[i];
      try {
        console.log(`🔍 이미지 분석 중 [${i+1}/${imagesToAnalyze.length}] (${image.source}): ${image.title.substring(0, 50)}...`);
        const analysis = await openaiService.analyzeImageWithHumanThinking(image.link, articleContext, title);
        analyzedImages.push({
          ...image,
          analysis: analysis.analysis,
          relevanceScore: analysis.score,
          aiRecommended: analysis.recommended,
          humanThinking: analysis.humanThinking,
          // AI 점수를 90% 비중으로 최종 점수 계산
          finalScore: (image.score * 0.1) + (analysis.score * 0.9)
        });
        
        // 매우 높은 점수(95점 이상)가 나오면 조기 종료 옵션
        if (analysis.score >= 95 && analyzedImages.length >= 10) {
          console.log(`🎯 최고 점수(${analysis.score}점) 발견! 분석 최적화를 위해 조기 완료`);
          break;
        }
        
      } catch (error) {
        console.warn(`이미지 분석 실패 [${i+1}/${imagesToAnalyze.length}] ${image.link}:`, error.message);
        // 분석 실패한 이미지도 낮은 점수로 포함
        analyzedImages.push({
          ...image,
          analysis: '분석 실패',
          relevanceScore: 20,
          aiRecommended: false,
          humanThinking: '분석 불가',
          finalScore: image.score * 0.3 // 분석 실패 시 낮은 점수
        });
      }
      
      // API 호출 간격 (OpenAI rate limit 방지)
      if (i < imagesToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 나머지 분석되지 않은 이미지들도 기본 점수로 추가
    const remainingImages = images.slice(analyzedImages.length).map(img => ({
      ...img,
      analysis: '분석 안함 (우선순위 낮음)',
      relevanceScore: img.score,
      aiRecommended: false,
      humanThinking: '미분석',
      finalScore: img.score * 0.5 // 미분석 이미지는 낮은 점수
    }));

    const finalImages = [...analyzedImages, ...remainingImages];
    
    // 최종 점수 기준으로 정렬
    finalImages.sort((a, b) => b.finalScore - a.finalScore);
    
    console.log(`🎯 AI 분석 완료: 최고 점수 ${finalImages[0]?.finalScore || 0}점`);
    console.log(`📊 분석 통계: 총 ${finalImages.length}개 중 ${analyzedImages.length}개 AI 분석 완료`);
    console.log(`🏆 상위 5개 이미지 점수: ${finalImages.slice(0, 5).map(img => `${img.finalScore.toFixed(1)}점`).join(', ')}`);
    
    return finalImages[0]; // 최고 점수 이미지 반환
  }

  /**
   * 이미지 URL 유효성 검사
   * @param {string} url - 검사할 이미지 URL
   * @returns {Promise<boolean>} 유효성 여부
   */
  async validateImageUrl(url) {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      const contentType = response.headers['content-type'] || '';
      
      return contentType.startsWith('image/');
    } catch (error) {
      return false;
    }
  }

  /**
   * 최적 이미지 선택
   * @param {Array} images - 이미지 검색 결과 배열
   * @param {Object} criteria - 선택 기준
   * @returns {Object|null} 선택된 이미지 또는 null
   */
  selectBestImage(images, criteria = {}) {
    if (!images || images.length === 0) {
      return null;
    }

    const {
      minWidth = 300,
      minHeight = 200,
      maxSize = 500000, // 500KB
      preferredFormats = ['jpg', 'jpeg', 'png', 'webp']
    } = criteria;

    // 기준에 맞는 이미지 필터링
    const validImages = images.filter(img => {
      return img.width >= minWidth &&
             img.height >= minHeight &&
             img.size <= maxSize &&
             preferredFormats.includes(img.format);
    });

    // 필터링된 이미지가 없으면 원본에서 최고 점수 선택
    const candidates = validImages.length > 0 ? validImages : images;
    
    // 점수 순으로 정렬 후 첫 번째 선택
    return candidates.sort((a, b) => b.score - a.score)[0];
  }

  /**
   * API 키 설정
   * @param {string} apiKey - Google Search API 키
   * @param {string} searchEngineId - Google Search Engine ID
   */
  setApiKeys(apiKey, searchEngineId) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
    this.isConfigured = !!(apiKey && searchEngineId);
    
    if (this.isConfigured) {
      console.log('✅ Google Custom Search API 키가 설정되었습니다.');
    }
  }

  /**
   * API 사용량 정보 반환
   * @returns {Object} 사용량 정보
   */
  getUsageInfo() {
    return {
      isConfigured: this.isConfigured,
      hasApiKey: !!this.apiKey,
      hasSearchEngineId: !!this.searchEngineId,
      dailyQuotaLimit: 100, // Google Custom Search 무료 할당량
      estimatedCostPerSearch: 0.005 // $5 per 1000 searches
    };
  }
}

module.exports = new ImageService(); 