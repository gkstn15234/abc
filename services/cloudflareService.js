const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class CloudflareService {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.isConfigured = !!(this.accountId && this.apiToken);
    
    if (!this.isConfigured) {
      console.warn('⚠️ Cloudflare Images API가 설정되지 않았습니다. 웹 인터페이스에서 설정해주세요.');
      console.log('계정 ID:', this.accountId ? '설정됨' : '미설정');
      console.log('API 토큰:', this.apiToken ? '설정됨' : '미설정');
    } else {
      console.log('✅ Cloudflare Images API 설정 완료');
    }
    
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
  }

  /**
   * 이미지 URL에서 다운로드 후 Cloudflare Images에 업로드
   * @param {string} imageUrl - 다운로드할 이미지 URL
   * @param {string} filename - 저장할 파일명 (선택사항)
   * @param {Object} metadata - 이미지 메타데이터
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadFromUrl(imageUrl, filename = null, metadata = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudflare Images API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.');
    }
    
    try {
      console.log(`☁️ Cloudflare Images 업로드 시작: ${imageUrl}`);

      // 1. 이미지 다운로드
      const downloadedImage = await this.downloadImage(imageUrl);
      
      // 2. Cloudflare Images에 업로드
      const uploadResult = await this.uploadToCloudflare(downloadedImage, filename, metadata);
      
      // 3. 임시 파일 삭제
      if (downloadedImage.tempPath) {
        fs.unlinkSync(downloadedImage.tempPath);
      }

      // 최적화된 URL 생성 (variants가 비어있을 수 있음)
      const optimizedUrl = uploadResult.result.variants && uploadResult.result.variants.length > 0 
        ? uploadResult.result.variants[0]
        : `https://imagedelivery.net/${this.accountId}/${uploadResult.result.id}/public`;

      console.log(`✅ Cloudflare 업로드 완료: ${optimizedUrl}`);
      
      return {
        success: true,
        cloudflare_id: uploadResult.result.id,
        cloudflare_url: optimizedUrl,
        original_url: imageUrl,
        filename: uploadResult.result.filename,
        uploaded_at: new Date().toISOString(),
        metadata: metadata
      };

    } catch (error) {
      console.error('Cloudflare 업로드 오류:', error.message);
      throw error;
    }
  }

  /**
   * 이미지 URL에서 파일 다운로드
   * @param {string} imageUrl - 다운로드할 이미지 URL
   * @returns {Promise<Object>} 다운로드된 파일 정보
   */
  async downloadImage(imageUrl) {
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // 파일 확장자 추출
      const urlPath = new URL(imageUrl).pathname;
      const extension = path.extname(urlPath) || '.jpg';
      
      // 임시 파일 경로 생성
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`;
      const tempPath = path.join(tempDir, tempFilename);

      // 파일 저장
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(tempPath);
          resolve({
            tempPath: tempPath,
            filename: tempFilename,
            size: stats.size,
            extension: extension
          });
        });
        writer.on('error', reject);
      });

    } catch (error) {
      throw new Error(`이미지 다운로드 실패: ${error.message}`);
    }
  }

  /**
   * Cloudflare Images에 파일 업로드
   * @param {Object} fileInfo - 다운로드된 파일 정보
   * @param {string} filename - 업로드할 파일명
   * @param {Object} metadata - 메타데이터
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadToCloudflare(fileInfo, filename = null, metadata = {}) {
    try {
      const form = new FormData();
      
      // 파일 스트림 추가
      form.append('file', fs.createReadStream(fileInfo.tempPath));
      
      // 메타데이터 추가
      if (filename) {
        form.append('id', filename.replace(/[^a-zA-Z0-9-_]/g, '_'));
      }
      
      if (Object.keys(metadata).length > 0) {
        form.append('metadata', JSON.stringify(metadata));
      }

      const response = await axios.post(this.baseUrl, form, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          ...form.getHeaders()
        },
        timeout: 60000
      });

      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(`Cloudflare API 오류: ${response.data.errors?.[0]?.message || 'Unknown error'}`);
      }

    } catch (error) {
      if (error.response) {
        throw new Error(`Cloudflare 업로드 실패: ${error.response.status} - ${error.response.data?.errors?.[0]?.message || error.message}`);
      }
      throw new Error(`Cloudflare 업로드 실패: ${error.message}`);
    }
  }



  /**
   * Cloudflare Images에서 이미지 삭제
   * @param {string} imageId - 삭제할 이미지 ID
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async deleteImage(imageId) {
    if (!this.isConfigured) {
      throw new Error('Cloudflare Images API 키가 설정되지 않았습니다.');
    }
    
    try {
      const response = await axios.delete(`${this.baseUrl}/${imageId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });

      return response.data.success;
    } catch (error) {
      console.error(`이미지 삭제 실패 ${imageId}:`, error.message);
      return false;
    }
  }

  /**
   * 이미지 최적화 URL 생성
   * @param {string} cloudflareId - Cloudflare 이미지 ID
   * @param {Object} options - 최적화 옵션
   * @returns {string} 최적화된 이미지 URL
   */
  generateOptimizedUrl(cloudflareId, options = {}) {
    const {
      width = 800,
      height = 600,
      format = 'webp',
      quality = 85,
      fit = 'scale-down'
    } = options;

    return `https://imagedelivery.net/${this.accountId}/${cloudflareId}/w=${width},h=${height},f=${format},q=${quality},fit=${fit}`;
  }

  /**
   * 업로드 가능한 파일 형식 확인
   * @param {string} filename - 파일명
   * @returns {boolean} 업로드 가능 여부
   */
  isSupportedFormat(filename) {
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const extension = path.extname(filename.toLowerCase());
    return supportedFormats.includes(extension);
  }

  /**
   * API 키 설정
   * @param {string} accountId - Cloudflare Account ID
   * @param {string} apiToken - Cloudflare API Token
   */
  setApiKeys(accountId, apiToken) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.isConfigured = !!(accountId && apiToken);
    
    if (this.isConfigured) {
      this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
      console.log('✅ Cloudflare Images API 키가 설정되었습니다.');
    }
  }

  /**
   * API 사용량 정보 반환
   * @returns {Object} 사용량 정보
   */
  getUsageInfo() {
    return {
      isConfigured: this.isConfigured,
      hasAccountId: !!this.accountId,
      hasApiToken: !!this.apiToken,
      monthlyQuota: 100000, // Cloudflare Images 무료 할당량
      estimatedCostPerImage: 0.001, // $1 per 1000 images delivered
      supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
    };
  }
}

module.exports = new CloudflareService(); 