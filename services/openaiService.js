const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const imageService = require('./imageService');
const cloudflareService = require('./cloudflareService');

class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.isConfigured = !!this.apiKey;
    
    if (this.isConfigured) {
      this.openai = new OpenAI({
        apiKey: this.apiKey
      });
    } else {
      console.warn('⚠️ OpenAI API 키가 설정되지 않았습니다. 웹 인터페이스에서 설정해주세요.');
    }
    
    this.model = 'gpt-4o-mini'; // 비용 효율적인 모델 (이미지 분석도 포함)
    this.maxTokens = 16384; // GPT-4o-mini 최대 토큰 (16K)
    this.costTracker = {
      totalRequests: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
  }

  /**
   * 원본 기사에서 상세 내용 추출
   * @param {string} url - 기사 URL
   * @returns {Promise<string>} 추출된 본문 내용
   */
  async extractArticleContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // 다양한 뉴스 사이트의 본문 선택자
      const contentSelectors = [
        'article',
        '.article-content',
        '.news-content', 
        '.post-content',
        '[data-module="ArticleBody"]',
        '.story-body',
        'main p'
      ];

      let content = '';
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length && element.text().length > 200) {
          content = element.text();
          break;
        }
      }

      // 기본 정리
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, 3000); // 토큰 절약을 위해 길이 제한

      return content || '본문을 추출할 수 없습니다';
    } catch (error) {
      console.error(`콘텐츠 추출 실패 ${url}:`, error.message);
      return '본문 추출 실패';
    }
  }

  /**
   * AI를 사용해 고품질 기사 생성
   * @param {Object} sourceArticle - 원본 기사 정보
   * @returns {Promise<Object>} 생성된 기사 정보
   */
  async generateArticle(sourceArticle) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.');
    }
    
    try {
      console.log(`✍️ AI 기사 생성 시작: "${sourceArticle.title}"`);

      // 원본 기사 본문 추출
      const fullContent = await this.extractArticleContent(sourceArticle.link);
      
      // 프롬프트 생성
      const prompt = this.createArticlePrompt(sourceArticle, fullContent);
      
      // OpenAI API 호출
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "당신은 전문 기자입니다. 뉴스를 재작성하여 더 흥미롭고 이해하기 쉬운 기사를 만들어주세요."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7
      });

      // 비용 추적
      this.updateCostTracker(response.usage);

      // 응답 파싱
      const generatedContent = response.choices[0].message.content;
      const article = this.parseGeneratedArticle(generatedContent, sourceArticle);

      console.log(`✅ AI 기사 생성 완료: "${article.title}"`);

      // 이미지 검색 및 처리 (오류 시 기사 생성 계속 진행)
      let finalContent = article.content;
      let cloudflareImage = null;
      let images = [];
      let uploadedImages = [];
      
      try {
        console.log(`🖼️ 관련 이미지 검색 중...`);
        images = await imageService.searchImages(article.title, article.tags, 4, article.content);
        
        if (images && images.length > 0) {
          console.log(`☁️ 이미지들 Cloudflare 업로드 중...`);
          
          const uploadedImages = [];
          const maxUploads = Math.min(4, images.length); // 최대 4개 업로드
          
          // 각 이미지를 Cloudflare에 업로드
          for (let i = 0; i < maxUploads; i++) {
            try {
              const uploadResult = await cloudflareService.uploadFromUrl(
                images[i].link,
                `article_${Date.now()}_${i}`,
                {
                  title: article.title,
                  source: sourceArticle.source,
                  article_id: sourceArticle.id,
                  image_index: i,
                  image_type: i === 0 ? 'thumbnail' : 'content'
                }
              );
              
              if (uploadResult.success) {
                uploadedImages.push({
                  index: i,
                  type: i === 0 ? 'thumbnail' : 'content',
                  cloudflare_url: uploadResult.cloudflare_url,
                  original_url: images[i].link,
                  alt_text: i === 0 ? `${article.title} 썸네일` : `${article.title} 본문 이미지 ${i}`
                });
                console.log(`✅ 이미지 ${i + 1} 업로드 완료`);
              }
            } catch (uploadError) {
              console.warn(`⚠️ 이미지 ${i + 1} 업로드 실패:`, uploadError.message);
            }
          }
          
          if (uploadedImages.length > 0) {
            // 이미지 플레이스홀더를 실제 URL로 교체
            console.log(`🤖 이미지 플레이스홀더 교체 중...`);
            finalContent = await this.replaceImagePlaceholders(article.content, uploadedImages);
            cloudflareImage = uploadedImages[0]; // 첫 번째 이미지를 대표 이미지로
          }
        }
      } catch (imageError) {
        console.warn(`⚠️ 이미지 처리 실패 (기사 생성은 계속): ${imageError.message}`);
        // 이미지 처리 실패해도 기사 생성은 계속 진행
      }
      
      return {
        ...article,
        content: finalContent,
        source_url: sourceArticle.link,
        source_title: sourceArticle.title,
        generated_at: new Date().toISOString(),
        tokens_used: response.usage.total_tokens,
        model_used: this.model,
        images: images,
        uploaded_images: uploadedImages || [],
        cloudflare_image: cloudflareImage,
        image_search_count: images.length,
        uploaded_image_count: uploadedImages ? uploadedImages.length : 0,
        has_images: !!(uploadedImages && uploadedImages.length > 0),
        structured_data: article.structuredData || '{}',
        slug: article.slug || 'news-article'
      };

    } catch (error) {
      console.error('AI 기사 생성 오류:', error);
      throw new Error(`기사 생성 실패: ${error.message}`);
    }
  }

  /**
   * 기사 생성용 프롬프트 생성
   * @param {Object} sourceArticle - 원본 기사
   * @param {string} fullContent - 추출된 본문
   * @returns {string} 생성된 프롬프트
   */
  createArticlePrompt(sourceArticle, fullContent) {
    // 카테고리 분류 로직
    const category = this.determineCategory(sourceArticle.title, fullContent, sourceArticle.category);
    
    // 감성 키워드 데이터베이스 - 카테고리별로 구분
    const emotionalKeywords = {
      '경제 뉴스': ['충격', '깜짝', '돌파', '폭등', '폭락', '대박', '급등', '급락', '흔들', '뒤집힌', '주목', '열풍', '비상', '파란불', '빨간불', '불안한', '역대급', '격변', '요동', '쏟아진'],
      '자동차 뉴스': ['파격', '역대급', '신차', '놀라운', '혁신', '전격', '출시', '완판', '돌풍', '대기록', '돌파', '신기록', '반전', '기대', '논란', '대반전', '대변신', '완벽', '압도적', '화제의'],
      '일반': ['놀라운', '주목', '화제', '특별한', '새로운', '혁신적', '중요한', '흥미로운', '독특한', '의미있는']
    };

    // 이미지 플레이스홀더 (썸네일 1개 + 본문 3개)
    const imgTags = [
      '<img src="IMG_THUMBNAIL" alt="썸네일 이미지"/>',
      '<img src="IMG_URL_1" alt="본문 이미지 1"/>',
      '<img src="IMG_URL_2" alt="본문 이미지 2"/>',
      '<img src="IMG_URL_3" alt="본문 이미지 3"/>'
    ];

    // E-E-A-T 강화를 위한 구조화된 데이터 템플릿
    const structuredDataTemplate = `{
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "${this.escapeJsonString(sourceArticle.title)}",
      "description": "${this.escapeJsonString(fullContent.substring(0, 200))}",
      "datePublished": "${new Date().toISOString()}",
      "dateModified": "${new Date().toISOString()}",
      "author": {
        "@type": "Person",
        "name": "Hyperion-Press ${category} 에디터"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Hyperion-Press",
        "logo": {
          "@type": "ImageObject",
          "url": "https://hyperion-press.com/logo.png"
        }
      },
      "image": ["IMG_THUMBNAIL", "IMG_URL_1", "IMG_URL_2"],
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://hyperion-press.com/articles/ARTICLE_SLUG"
      }
    }`;

    const selectedEmotionalKeywords = this.getRandomItems(emotionalKeywords[category] || emotionalKeywords['일반'], 3);

    return `다음 기사를 Hyperion-Press 스타일로 재작성해 주세요. 반드시 아래 HTML 구조를 따릅니다.

1) <h1>제목</h1>
2) <div class="vertical-bar-text">소제목1<br>소제목2</div>
3) ${imgTags[0]}
4) <p>단락1 (3~4문장)</p>
5) <p>단락2 (3~4문장)</p>
6) <h2>요약 소제목 (간결하게)</h2>
7) ${imgTags[1]}
8) <p>단락3 (3~4문장)</p>
9) <p>단락4 (3~4문장)</p>
10) <h2>요약 소제목 (간결하게)</h2>
11) ${imgTags[2]}
12) <p>단락5 (3~4문장)</p>
13) <p>단락6 (3~4문장)</p>
14) <h2>요약 소제목 (간결하게)</h2>
15) ${imgTags[3]}
16) <p>단락7 (3~4문장)</p>
17) <p>단락8 (3~4문장)</p>

원본 정보:
제목: ${sourceArticle.title}
내용: ${fullContent.substring(0, 1000)}
출처: ${sourceArticle.source}
카테고리: ${category}

필수 작성 규칙:
- 제목은 '"감성어+핵심사항"…보충설명' 형태로 작성 (예: "깜짝 실적 발표"…현대차 3분기 영업이익 2조 돌파)
- 감성 키워드는 ${selectedEmotionalKeywords.join(', ')} 등을 활용
- 큰따옴표 안에 짧고 강렬한 문구, 문장 끝 말줄임표(…) 필수
- 수직 막대 텍스트는 기사의 핵심을 짧게 2줄로 요약
- 문단은 3-4문장으로, 마지막 문장은 흥미/호기심을 유발하는 질문이나 흥미로운 사실로 마무리
- 각 소제목(h2)은 '어떻게', '왜', '얼마나' 등의 의문형이나 감탄형으로 작성
- 일반 독자도 이해하기 쉽게 전문용어는 풀어서 설명
- 각 단락 내 핵심 문구는 <strong> 태그로 강조
- 통계, 수치 등 구체적 정보를 포함하여 신뢰성 확보
- 첫 단락에 기사의 핵심을 요약하되, 흥미를 끌 수 있는 내용으로 구성
- 맨 마지막 단락은 향후 전망이나 소비자/독자에게 유용한 조언으로 마무리
- <img> 태그의 src 값은 IMG_THUMBNAIL, IMG_URL_1~3 플레이스홀더를 그대로 사용하고 수정·삭제하지 마세요
- 태그 섹션, 관련 기사 섹션, SNS 공유 버튼을 포함하지 마세요
- 코드 아이콘(</>)이나 기타 HTML 태그를 콘텐츠의 시작이나 끝에 추가하지 마세요

또한, 아래 한글 제목을 SEO 최적화된 영어 슬러그로 변환해 주세요:
- 최대 5-6단어 이내 (짧을수록 좋음)
- 주요 키워드를 맨 앞에 배치
- 특수문자·따옴표 제거, 소문자, 띄어쓰기→하이픈, 중복 하이픈 제거
- 영문 슬러그 예시: hyundai-motor-record-profit, stock-market-crash, new-ev-revolution

응답 형식(JSON 문자열만):
{
  "title": "<h1>...</h1>",
  "content": "<div class='vertical-bar-text'>...</div><img>...",
  "slug": "seo-friendly-slug",
  "structuredData": "${this.escapeJsonString(structuredDataTemplate)}",
  "category": "${category}",
  "tags": ["태그1", "태그2", "태그3"]
}`;
  }

  /**
   * 카테고리 분류 함수
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @param {string} defaultCategory - 기본 카테고리
   * @returns {string} 분류된 카테고리
   */
  determineCategory(title, content, defaultCategory) {
    const combinedText = (title + ' ' + content).toLowerCase();
    
    // 경제 관련 키워드
    const economyKeywords = [
      '주식', '경제', '금리', '투자', '시장', '펀드', '주가', '재테크', '돈', '비트코인', '부동산', '증시',
      '금융', '은행', '외환', '환율', '원화', '달러', '기업', '실적', '수익', '매출', '영업이익', 'AI',
      '채권', '상장', '코스피', '코스닥', '나스닥', '다우', 'S&P', '기준금리', '인플레', '디플레이션',
      '세금', '유가', '물가', '가상화폐', '암호화폐', '전망', '실적', 'ETF', '채권', '테마주'
    ];
    
    // 자동차 관련 키워드
    const automotiveKeywords = [
      '자동차', '신차', '전기차', '테슬라', '현대', '기아', 'BMW', '벤츠', '도요타', '폭스바겐', 'SUV', '세단',
      '하이브리드', '자율주행', '모빌리티', '충전', '배터리', '출시', '엔진', '제네시스', '내연기관',
      '트렁크', '휠', '타이어', '연비', '주행', '운전', '정비', '마력', '토크', '판매량', '모델',
      '디젤', '가솔린', 'LPG', '스포츠카', 'EV', '리콜', '시승', '튜닝', '옵션', '트림'
    ];
    
    // 경제 키워드 매칭 확인
    const economyMatches = economyKeywords.filter(keyword => combinedText.includes(keyword)).length;
    
    // 자동차 키워드 매칭 확인
    const automotiveMatches = automotiveKeywords.filter(keyword => combinedText.includes(keyword)).length;
    
    // 매칭된 키워드가 많은 카테고리 반환
    if (economyMatches > automotiveMatches) {
      return '경제 뉴스';
    } else if (automotiveMatches > 0) {
      return '자동차 뉴스';
    }
    
    // 기본값은 제공된 카테고리 또는 일반
    return defaultCategory || '일반';
  }

  /**
   * JSON 문자열 이스케이프 처리
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  escapeJsonString(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * 배열에서 랜덤 아이템 선택
   * @param {Array} array - 선택할 배열
   * @param {number} count - 선택할 개수
   * @returns {Array} 선택된 아이템들
   */
  getRandomItems(array, count) {
    if (!array || array.length === 0) return [];
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * 생성된 기사 내용 파싱 (JSON 형식)
   * @param {string} content - AI가 생성한 JSON 문자열
   * @param {Object} sourceArticle - 원본 기사 정보
   * @returns {Object} 파싱된 기사 객체
   */
  parseGeneratedArticle(content, sourceArticle) {
    try {
      // JSON 형식으로 파싱 시도
      const parsed = JSON.parse(content);
      
      return {
        title: parsed.title ? parsed.title.replace(/<\/?h1>/g, '') : sourceArticle.title,
        content: parsed.content || '기사 생성에 실패했습니다.',
        tags: parsed.tags || ['뉴스', '일반'],
        category: parsed.category || sourceArticle.category,
        slug: parsed.slug || 'news-article',
        structuredData: parsed.structuredData || '{}',
        status: 'draft'
      };
    } catch (error) {
      console.warn('JSON 파싱 실패, 기존 방식으로 파싱:', error.message);
      
      // 기존 방식으로 파싱
      const lines = content.split('\n').filter(line => line.trim());
      
      let title = '';
      let body = '';
      let tags = [];
      
      let currentSection = '';
      
      for (const line of lines) {
        if (line.startsWith('제목:')) {
          title = line.replace('제목:', '').trim();
        } else if (line.startsWith('본문:')) {
          currentSection = 'body';
          continue;
        } else if (line.startsWith('태그:')) {
          const tagLine = line.replace('태그:', '').trim();
          tags = tagLine.split('#').filter(tag => tag.trim()).map(tag => tag.trim());
        } else if (currentSection === 'body' && line.trim()) {
          body += line.trim() + '\n\n';
        }
      }

      // 기본값 처리
      if (!title) {
        title = sourceArticle.title;
      }
      
      if (!body) {
        body = '기사 생성에 실패했습니다.';
      }

      if (tags.length === 0) {
        tags = ['뉴스', '일반'];
      }

      return {
        title: title,
        content: body.trim(),
        tags: tags,
        category: sourceArticle.category,
        status: 'draft'
      };
    }
  }

  /**
   * API 사용량 및 비용 추적
   * @param {Object} usage - OpenAI usage 정보
   */
  updateCostTracker(usage) {
    this.costTracker.totalRequests++;
    this.costTracker.totalTokens += usage.total_tokens;
    
    // GPT-4o-mini 가격 (2024년 기준)
    const inputCost = (usage.prompt_tokens / 1000) * 0.00015;
    const outputCost = (usage.completion_tokens / 1000) * 0.0006;
    
    this.costTracker.estimatedCost += inputCost + outputCost;
    
    console.log(`💰 토큰 사용량: ${usage.total_tokens} (누적: ${this.costTracker.totalTokens})`);
    console.log(`💰 예상 비용: $${(inputCost + outputCost).toFixed(4)} (누적: $${this.costTracker.estimatedCost.toFixed(4)})`);
  }

  /**
   * 기사 품질 점수 계산
   * @param {Object} article - 생성된 기사
   * @returns {number} 품질 점수 (0-100)
   */
  calculateQualityScore(article) {
    let score = 0;
    
    // 제목 품질 (30점)
    if (article.title && article.title.length >= 5 && article.title.length <= 20) {
      score += 30;
    } else if (article.title && article.title.length > 0) {
      score += 15;
    }
    
    // 본문 품질 (50점)
    if (article.content) {
      const wordCount = article.content.length;
      if (wordCount >= 800 && wordCount <= 1500) {
        score += 50;
      } else if (wordCount >= 500) {
        score += 35;
      } else if (wordCount >= 200) {
        score += 20;
      }
    }
    
    // 태그 품질 (10점)
    if (article.tags && article.tags.length >= 3 && article.tags.length <= 7) {
      score += 10;
    } else if (article.tags && article.tags.length > 0) {
      score += 5;
    }
    
    // 구조 품질 (10점)
    const paragraphs = article.content.split('\n\n').filter(p => p.trim());
    if (paragraphs.length >= 3) {
      score += 10;
    } else if (paragraphs.length >= 2) {
      score += 5;
    }
    
    return Math.min(score, 100);
  }

  /**
   * 비용 추적 정보 반환
   * @returns {Object} 현재 비용 정보
   */
  getCostInfo() {
    return {
      ...this.costTracker,
      averageCostPerRequest: this.costTracker.totalRequests > 0 
        ? this.costTracker.estimatedCost / this.costTracker.totalRequests 
        : 0
    };
  }

  /**
   * 이미지 플레이스홀더를 실제 URL로 교체
   * @param {string} content - 플레이스홀더가 포함된 기사 내용
   * @param {Array} uploadedImages - 업로드된 이미지 정보 배열
   * @returns {Promise<string>} 이미지가 교체된 최종 내용
   */
  async replaceImagePlaceholders(content, uploadedImages) {
    let finalContent = content;
    
    try {
      // 플레이스홀더 매핑
      const placeholders = [
        'IMG_THUMBNAIL',
        'IMG_URL_1',
        'IMG_URL_2', 
        'IMG_URL_3'
      ];
      
      // 각 플레이스홀더를 실제 이미지 URL로 교체
      uploadedImages.forEach((image, index) => {
        if (index < placeholders.length) {
          const placeholder = placeholders[index];
          const regex = new RegExp(placeholder, 'g');
          finalContent = finalContent.replace(regex, image.cloudflare_url);
          
          // alt 텍스트도 업데이트
          const altRegex = new RegExp(`alt="[^"]*"`, 'g');
          if (finalContent.includes(image.cloudflare_url)) {
            finalContent = finalContent.replace(
              new RegExp(`<img([^>]*src="${image.cloudflare_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*)alt="[^"]*"`, 'g'),
              `<img$1alt="${image.alt_text}"`
            );
          }
          
          console.log(`🔄 ${placeholder} → ${image.cloudflare_url.substring(0, 50)}...`);
        }
      });
      
      // 사용되지 않은 플레이스홀더 제거 (이미지가 부족한 경우)
      placeholders.forEach(placeholder => {
        const regex = new RegExp(`<img[^>]*src="${placeholder}"[^>]*>`, 'g');
        finalContent = finalContent.replace(regex, '');
      });
      
      return finalContent;
      
    } catch (error) {
      console.error('이미지 플레이스홀더 교체 오류:', error.message);
      return content; // 오류 시 원본 반환
    }
  }

  /**
   * 기사 내용에 이미지를 최적 위치에 삽입 (레거시 메서드)
   * @param {string} content - 원본 기사 내용
   * @param {string} imageUrl - 삽입할 이미지 URL
   * @param {string} title - 기사 제목
   * @returns {Promise<string>} 이미지가 삽입된 최종 내용
   */
  async insertImageIntoContent(content, imageUrl, title) {
    if (!this.isConfigured) {
      // API 키 없을 때 기본 삽입 방식 사용
      const paragraphs = content.split('\n\n');
      if (paragraphs.length >= 2) {
        paragraphs.splice(1, 0, `![${title}](${imageUrl})`);
        return paragraphs.join('\n\n');
      }
      return content + `\n\n![${title}](${imageUrl})`;
    }

    try {
      const prompt = `
다음 기사 내용에 이미지를 가장 적절한 위치에 삽입해주세요:

**기사 제목**: ${title}
**이미지 URL**: ${imageUrl}

**기사 내용**:
${content}

**요구사항**:
1. 이미지를 마크다운 형식으로 삽입: ![alt text](${imageUrl})
2. 이미지가 내용의 흐름을 자연스럽게 보완하는 위치에 배치
3. 일반적으로 첫 번째 단락 이후가 효과적
4. 이미지 설명(alt text)은 기사 내용과 관련되게 작성
5. 원본 내용은 그대로 유지하고 이미지만 추가

**출력**: 이미지가 삽입된 완전한 기사 내용만 반환
`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "당신은 기사 편집 전문가입니다. 기사에 이미지를 자연스럽게 삽입하여 가독성을 높이는 것이 목표입니다."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.3
      });

      const optimizedContent = response.choices[0].message.content;
      
      // 비용 추적
      this.updateCostTracker(response.usage);
      
      return optimizedContent;

    } catch (error) {
      console.error('이미지 삽입 최적화 오류:', error.message);
      
      // 실패시 기본 삽입 방식 사용
      const paragraphs = content.split('\n\n');
      if (paragraphs.length >= 2) {
        paragraphs.splice(1, 0, `![${title}](${imageUrl})`);
        return paragraphs.join('\n\n');
      }
      return content + `\n\n![${title}](${imageUrl})`;
    }
  }

  /**
   * API 키 설정
   * @param {string} apiKey - OpenAI API 키
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.isConfigured = !!apiKey;
    
    if (this.isConfigured) {
      this.openai = new OpenAI({
        apiKey: this.apiKey
      });
      console.log('✅ OpenAI API 키가 설정되었습니다.');
    }
  }

  /**
   * 스마트 검색어 생성 (이미지 검색용)
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용 (선택사항)
   * @param {Array} tags - 기사 태그들
   * @returns {Promise<string>} 최적화된 검색어
   */
  async generateSmartSearchQuery(title, content = '', tags = []) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const prompt = `다음 기사에 가장 적합한 구글 이미지 검색어를 생성해주세요. 
모호하지 않고 구체적이며, 기사 내용과 정확히 일치하는 이미지를 찾을 수 있는 검색어를 만들어주세요.

기사 제목: ${title}
${content ? `기사 내용: ${content.substring(0, 500)}...` : ''}
${tags.length > 0 ? `태그: ${tags.join(', ')}` : ''}

검색어 생성 원칙:
1. 모호한 단어 피하기 (예: "애플" → "애플 회사" 또는 "아이폰")
2. 구체적인 맥락 포함하기 (예: "주가 상승" → "주식 차트 상승 그래프")
3. 시각적 요소 고려하기 (로고, 제품, 그래프, 건물 등)
4. 한국어와 영어 키워드 조합 가능
5. 3-5개 단어로 구성

최적의 검색어만 답변해주세요:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '당신은 이미지 검색 전문가입니다. 기사 내용에 가장 적합한 구글 이미지 검색어를 생성합니다.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      const searchQuery = response.choices[0].message.content.trim();
      
      // 토큰 사용량 추적
      this.updateCostTracker(response.usage);

      console.log(`🔍 스마트 검색어 생성: "${searchQuery}"`);
      
      return searchQuery;
    } catch (error) {
      console.error('스마트 검색어 생성 실패:', error);
      // 폴백: 기본 검색어 생성
      return `${title} ${tags.slice(0, 2).join(' ')}`.trim();
    }
  }

  /**
   * 이미지 분석 및 검증 (GPT-4 Vision 사용)
   * @param {string} imageUrl - 분석할 이미지 URL
   * @param {string} articleContext - 기사 맥락
   * @returns {Promise<Object>} 이미지 분석 결과
   */
  async analyzeImage(imageUrl, articleContext) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const prompt = `이 이미지를 분석하고, 다음 기사 내용과 얼마나 일치하는지 평가해주세요.

기사 맥락: ${articleContext}

다음 형식으로 답변해주세요:
1. 이미지 설명: [이미지에 무엇이 보이는지 상세히 설명]
2. 관련성 점수: [0-100점, 기사 내용과의 일치도]
3. 선택 이유: [점수를 준 이유]
4. 추천 여부: [YES/NO]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 4096, // 이미지 분석 고품질을 위해 증가
        temperature: 0.1
      });

      const analysis = response.choices[0].message.content;
      
      // 토큰 사용량 추적
      this.updateCostTracker(response.usage);

      // 관련성 점수 추출
      const scoreMatch = analysis.match(/관련성 점수[:\s]*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      // 추천 여부 추출
      const recommendMatch = analysis.match(/추천 여부[:\s]*(YES|NO)/i);
      const recommended = recommendMatch ? recommendMatch[1].toUpperCase() === 'YES' : false;

      console.log(`🖼️ 이미지 분석 완료: 점수 ${score}점, 추천 ${recommended ? 'YES' : 'NO'}`);

      return {
        analysis,
        score,
        recommended,
        imageUrl
      };
    } catch (error) {
      console.error('이미지 분석 실패:', error);
      // GPT-4 Vision 실패 시 기본 점수 반환
      return {
        analysis: '이미지 분석에 실패했습니다.',
        score: 50, // 중간 점수
        recommended: true, // 기본적으로 추천
        imageUrl
      };
    }
  }

  /**
   * 인간적 사고 기반 이미지 분석 (개선된 버전)
   * @param {string} imageUrl - 분석할 이미지 URL
   * @param {string} articleContext - 기사 맥락
   * @param {string} title - 기사 제목
   * @returns {Promise<Object>} 향상된 이미지 분석 결과
   */
  async analyzeImageWithHumanThinking(imageUrl, articleContext, title) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const prompt = `당신은 뉴스 기사 편집자입니다. 다음 기사에 가장 적합한 이미지를 선택해야 합니다.

기사 정보:
${articleContext}

인간적 사고 과정으로 이 이미지를 평가해주세요:

1단계: 독자 관점 생각하기
- 이 기사를 읽는 독자가 이 이미지를 보면 어떤 느낌일까?
- 기사 이해에 도움이 될까?

2단계: 이미지-기사 연관성 분석
- 이미지가 기사의 핵심 내용을 시각적으로 표현하는가?
- 단순한 키워드 매칭이 아닌 실질적 관련성이 있는가?

3단계: 품질 및 적합성 평가
- 뉴스 기사에 적합한 전문적인 이미지인가?
- 스크린샷, 텍스트 이미지, 로고만 있는 이미지는 부적절

다음 형식으로 답변:
이미지 설명: [무엇이 보이는지 구체적으로]
독자 관점: [독자가 어떻게 느낄지]
연관성 분석: [기사와의 실질적 관련성]
적합성 평가: [뉴스 이미지로서의 품질]
관련성 점수: [0-100점]
추천 여부: [YES/NO]
선택 이유: [점수 근거]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 경험 많은 뉴스 에디터입니다. 독자의 관점에서 생각하며, 기사와 이미지의 실질적 연관성을 중요하게 평가합니다.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 4096, // 이미지 분석 고품질을 위해 증가
        temperature: 0.2
      });

      const analysis = response.choices[0].message.content;
      
      // 토큰 사용량 추적
      this.updateCostTracker(response.usage);

      // 관련성 점수 추출 (더 정확한 패턴)
      const scoreMatch = analysis.match(/관련성\s*점수[:\s]*(\d+)/i) || 
                        analysis.match(/점수[:\s]*(\d+)/i) ||
                        analysis.match(/(\d+)점/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      // 추천 여부 추출
      const recommendMatch = analysis.match(/추천\s*여부[:\s]*(YES|NO)/i) ||
                            analysis.match(/(YES|NO)/i);
      const recommended = recommendMatch ? recommendMatch[1].toUpperCase() === 'YES' : false;

      // 인간적 사고 과정 추출
      const humanThinking = {
        readerPerspective: this.extractSection(analysis, '독자 관점'),
        relevanceAnalysis: this.extractSection(analysis, '연관성 분석'),
        suitabilityEvaluation: this.extractSection(analysis, '적합성 평가')
      };

      console.log(`🧠 인간적 분석 완료: 점수 ${score}점, 추천 ${recommended ? 'YES' : 'NO'}`);

      return {
        analysis,
        score,
        recommended,
        humanThinking,
        imageUrl
      };
    } catch (error) {
      console.error('인간적 이미지 분석 실패:', error);
      // 실패 시 기본 분석으로 폴백
      return await this.analyzeImage(imageUrl, articleContext);
    }
  }

  /**
   * 분석 결과에서 특정 섹션 추출
   * @param {string} text - 전체 분석 텍스트
   * @param {string} section - 추출할 섹션명
   * @returns {string} 추출된 섹션 내용
   */
  extractSection(text, section) {
    const regex = new RegExp(`${section}[:\s]*([^\n]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '추출 실패';
  }

  /**
   * 영어로 번역
   * @param {string} koreanText - 한국어 텍스트
   * @returns {Promise<string>} 영어 번역 결과
   */
  async translateToEnglish(koreanText) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const prompt = `다음 한국어 텍스트를 자연스러운 영어로 번역해주세요. 
이미지 검색에 최적화된 간단하고 명확한 영어 키워드로 변환하세요.

한국어: ${koreanText}

영어 번역 (3-6단어):`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '당신은 전문 번역가입니다. 이미지 검색에 적합한 간단하고 정확한 영어 키워드로 번역합니다.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      const translation = response.choices[0].message.content.trim();
      
      // 토큰 사용량 추적
      this.updateCostTracker(response.usage);

      // 불필요한 문구 제거
      const cleanTranslation = translation
        .replace(/영어 번역[:\s]*/gi, '')
        .replace(/영어[:\s]*/gi, '')
        .replace(/번역[:\s]*/gi, '')
        .replace(/["""]/g, '')
        .trim();

      return cleanTranslation;
    } catch (error) {
      console.error('영어 번역 실패:', error);
      return koreanText; // 실패 시 원본 반환
    }
  }

  /**
   * 이미지 위치별 맞춤 검색어 생성 (400개 이미지 분석 시스템용)
   * @param {string} title - 기사 제목
   * @param {string} content - 기사 내용
   * @param {Array} keywords - 키워드 배열
   * @param {Object} imageSpec - 이미지 스펙 정보
   * @returns {Promise<string>} 맞춤 검색어
   */
  async generateImageSpecificSearchQuery(title, content, keywords, imageSpec) {
    if (!this.isConfigured) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const prompt = `다음 기사의 ${imageSpec.type}에 가장 적합한 구글 이미지 검색어를 생성해주세요.

기사 제목: ${title}
기사 내용: ${content.substring(0, 500)}...
키워드: ${keywords.join(', ')}

이미지 위치: ${imageSpec.type}
이미지 목적: ${imageSpec.purpose}
이미지 초점: ${imageSpec.focus}

${imageSpec.type}별 맞춤 검색 전략:

${imageSpec.type === '썸네일' ? `
[썸네일 이미지 요구사항]
- 기사 전체를 대표하는 강력한 첫인상
- 독자의 관심을 즉시 끌 수 있는 시각적 임팩트
- 제목의 핵심 키워드를 시각적으로 표현
- 뉴스 썸네일에 적합한 전문적 품질
` : ''}

${imageSpec.type === '본문1' ? `
[본문1 이미지 요구사항]  
- 기사 도입부 내용을 구체적으로 설명
- 상황이나 배경을 명확히 보여주는 이미지
- 독자의 이해를 돕는 설명적 역할
` : ''}

${imageSpec.type === '본문2' ? `
[본문2 이미지 요구사항]
- 기사의 핵심 내용을 시각적으로 증명
- 가장 중요한 포인트를 강조하는 이미지
- 실질적 증거나 구체적 사례를 보여줌
` : ''}

${imageSpec.type === '본문3' ? `
[본문3 이미지 요구사항]
- 기사 결론이나 미래 전망을 암시
- 희망적이거나 발전적인 방향성 표현
- 마무리에 적합한 완성도 높은 이미지
` : ''}

인간적 사고 과정:
1. 독자가 ${imageSpec.type}에서 기대하는 것은?
2. 이 위치에서 어떤 이미지가 가장 효과적일까?
3. 기사 내용을 가장 잘 표현하는 시각적 요소는?

검색어 생성 원칙:
- 구체적이고 명확한 키워드 사용
- 모호한 단어 배제
- 영어와 한국어 조합 가능
- 실제 사물/장면/개념 중심
- 3-6개 단어로 구성

최적의 검색어만 답변해주세요:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: `당신은 뉴스 이미지 전문가입니다. 각 이미지 위치의 목적에 맞는 최적의 검색어를 생성합니다. 
            독자의 관점에서 생각하고, 해당 위치에서 가장 효과적인 이미지를 찾을 수 있는 구체적인 검색어를 만듭니다.` 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.2
      });

      let searchQuery = response.choices[0].message.content.trim();
      
      // 검색어 후처리
      searchQuery = this.refineSearchQuery(searchQuery, title, imageSpec.type);
      
      // 토큰 사용량 추적
      this.updateCostTracker(response.usage);

      console.log(`🔍 ${imageSpec.type} 맞춤 검색어 생성: "${searchQuery}"`);
      
      return searchQuery;
    } catch (error) {
      console.error(`${imageSpec.type} 맞춤 검색어 생성 실패:`, error);
      // 폴백: 기본 검색어 생성
      return `${title} ${keywords.slice(0, 2).join(' ')}`.trim();
    }
  }

  /**
   * 검색어 후처리 (카테고리별)
   * @param {string} searchQuery - AI가 생성한 검색어
   * @param {string} title - 기사 제목
   * @param {string} imageType - 이미지 타입
   * @returns {string} 정제된 검색어
   */
  refineSearchQuery(searchQuery, title, imageType) {
    // 불필요한 문구 제거
    const unnecessaryPhrases = [
      '검색어:', '최적의 검색어:', '답변:', '키워드:', '이미지 검색어:',
      '구글 검색어:', '추천 검색어:', '최적화된 검색어:', '맞춤 검색어:'
    ];
    
    let refined = searchQuery;
    unnecessaryPhrases.forEach(phrase => {
      refined = refined.replace(new RegExp(phrase, 'gi'), '');
    });
    
    // 따옴표 제거
    refined = refined.replace(/["""'']/g, '');
    
    // 공백 정리
    refined = refined.trim().replace(/\s+/g, ' ');
    
    // 너무 긴 검색어 단축 (7단어 이하로)
    const words = refined.split(' ');
    if (words.length > 7) {
      refined = words.slice(0, 7).join(' ');
    }
    
    // 이미지 타입별 필수 키워드 보완
    if (imageType === '썸네일' && !refined.includes('high quality') && !refined.includes('professional')) {
      refined = `${refined} professional photo`;
    }
    
    return refined.trim();
  }

  /**
   * OpenAI 연결 테스트
   * @returns {Promise<boolean>} 연결 가능 여부
   */
  async testConnection() {
    if (!this.isConfigured) {
      return false;
    }
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5
      });
      
      return response.choices && response.choices.length > 0;
    } catch (error) {
      console.error('OpenAI 연결 테스트 실패:', error.message);
      return false;
    }
  }
}

module.exports = new OpenAIService(); 