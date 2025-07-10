const fs = require('fs');
const path = require('path');

class ArticleStorage {
  constructor() {
    this.dataFile = path.join(__dirname, '..', 'data', 'articles.json');
    this.ensureDataDirectory();
    this.loadArticles();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadArticles() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(data);
        this.articles = parsed.articles || [];
        this.nextId = parsed.nextId || 1;
      } else {
        this.articles = [];
        this.nextId = 1;
      }
    } catch (error) {
      console.error('기사 데이터 로드 실패:', error);
      this.articles = [];
      this.nextId = 1;
    }
  }

  saveToFile() {
    try {
      const data = {
        articles: this.articles,
        nextId: this.nextId,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('기사 데이터 저장 실패:', error);
    }
  }

  /**
   * 새 기사 저장
   * @param {Object} article - 저장할 기사 데이터
   * @returns {Object} 저장된 기사 (ID 포함)
   */
  saveArticle(article) {
    const savedArticle = {
      id: this.nextId++,
      ...article,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: article.status || 'draft'
    };
    
    this.articles.unshift(savedArticle); // 최신 기사가 맨 위에 오도록
    this.saveToFile(); // 파일에 저장
    
    console.log(`📝 기사 저장됨: ID ${savedArticle.id} - "${savedArticle.title}"`);
    
    return savedArticle;
  }

  /**
   * 모든 기사 조회 (페이지네이션 지원)
   * @param {Object} options - 조회 옵션
   * @returns {Object} 기사 목록과 메타 정보
   */
  getArticles(options = {}) {
    const { status, page = 1, limit = 10 } = options;
    
    let filteredArticles = this.articles;
    
    // 상태별 필터링
    if (status) {
      filteredArticles = this.articles.filter(article => article.status === status);
    }
    
    // 페이지네이션
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
    
    return {
      articles: paginatedArticles,
      total: filteredArticles.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filteredArticles.length / limit)
    };
  }

  /**
   * 특정 기사 조회
   * @param {number} id - 기사 ID
   * @returns {Object|null} 기사 데이터 또는 null
   */
  getArticleById(id) {
    return this.articles.find(article => article.id === parseInt(id)) || null;
  }

  /**
   * 기사 업데이트
   * @param {number} id - 기사 ID
   * @param {Object} updates - 업데이트할 데이터
   * @returns {Object|null} 업데이트된 기사 또는 null
   */
  updateArticle(id, updates) {
    const index = this.articles.findIndex(article => article.id === parseInt(id));
    
    if (index === -1) {
      return null;
    }
    
    this.articles[index] = {
      ...this.articles[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    this.saveToFile(); // 파일에 저장
    console.log(`📝 기사 업데이트됨: ID ${id}`);
    
    return this.articles[index];
  }

  /**
   * 기사 삭제
   * @param {number} id - 기사 ID
   * @returns {boolean} 삭제 성공 여부
   */
  deleteArticle(id) {
    const index = this.articles.findIndex(article => article.id === parseInt(id));
    
    if (index === -1) {
      return false;
    }
    
    const deletedArticle = this.articles.splice(index, 1)[0];
    this.saveToFile(); // 파일에 저장
    console.log(`🗑️ 기사 삭제됨: ID ${id} - "${deletedArticle.title}"`);
    
    return true;
  }

  /**
   * 기사 상태 업데이트
   * @param {number} id - 기사 ID
   * @param {string} status - 새 상태 (draft, published, archived)
   * @returns {Object|null} 업데이트된 기사 또는 null
   */
  updateStatus(id, status) {
    return this.updateArticle(id, { status });
  }

  /**
   * 통계 정보 반환
   * @returns {Object} 기사 통계
   */
  getStats() {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    const todayPublished = this.articles.filter(article => 
      article.status === 'published' && 
      article.created_at.startsWith(today)
    ).length;
    
    const monthPublished = this.articles.filter(article => 
      article.status === 'published' && 
      article.created_at.startsWith(thisMonth)
    ).length;
    
    const statusCounts = this.articles.reduce((acc, article) => {
      acc[article.status] = (acc[article.status] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: this.articles.length,
      today_published: todayPublished,
      month_published: monthPublished,
      status_counts: statusCounts,
      latest_article: this.articles[0] || null
    };
  }

  /**
   * 모든 기사 삭제 (개발용)
   */
  clearAll() {
    this.articles = [];
    this.nextId = 1;
    console.log('🗑️ 모든 기사가 삭제되었습니다');
  }
}

module.exports = new ArticleStorage(); 