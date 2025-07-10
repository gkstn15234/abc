import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  Tag, 
  ExternalLink, 
  Edit3, 
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import axios from 'axios';

const ArticleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    try {
      const response = await axios.get(`/api/v1/articles/${id}`);
      if (response.data.success) {
        setArticle(response.data.data);
      } else {
        setError('기사를 찾을 수 없습니다');
      }
    } catch (error) {
      console.error('기사 로딩 실패:', error);
      setError('기사 로딩 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            발행완료
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            초안
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            실패
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            알 수 없음
          </span>
        );
    }
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const deleteArticle = async () => {
    if (!window.confirm('정말로 이 기사를 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await axios.delete(`/api/v1/articles/${id}`);
      
      if (response.data.success) {
        alert('기사가 삭제되었습니다');
        navigate('/articles');
      } else {
        throw new Error(response.data.error || '삭제 실패');
      }
    } catch (error) {
      console.error('기사 삭제 실패:', error);
      alert(`기사 삭제에 실패했습니다: ${error.response?.data?.error || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">기사를 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">오류 발생</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/articles')}
          className="btn-primary"
        >
          기사 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <Eye className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">기사를 찾을 수 없습니다</h2>
        <p className="text-gray-600 mb-4">요청하신 기사가 존재하지 않거나 삭제되었을 수 있습니다.</p>
        <button
          onClick={() => navigate('/articles')}
          className="btn-primary"
        >
          기사 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/articles')}
          className="btn-secondary flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          기사 목록으로
        </button>
        
        <div className="flex space-x-2">
          {article.status === 'draft' && (
            <button className="btn-secondary flex items-center">
              <Edit3 className="w-4 h-4 mr-2" />
              편집
            </button>
          )}
          <button 
            onClick={deleteArticle}
            disabled={deleting}
            className="btn-danger flex items-center"
          >
            {deleting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            삭제
          </button>
        </div>
      </div>

      {/* 기사 정보 */}
      <div className="card">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatTime(article.created_at)}
                </div>
                <span>•</span>
                <span>출처: {article.source}</span>
                <span>•</span>
                <span className={getQualityColor(article.quality_score)}>
                  품질점수: {article.quality_score}점
                </span>
              </div>

              <div className="flex items-center space-x-2 mb-4">
                {getStatusBadge(article.status)}
                {article.auto_publish && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    자동발행
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 원본 기사 링크 */}
          {article.source_url && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">원본 기사</h3>
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                {article.source_title || article.source_url}
              </a>
            </div>
          )}

          {/* 기사 내용 */}
          <div className="prose prose-lg max-w-none">
            <div 
              className="text-gray-800 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ 
                __html: article.content
                  ?.replace(/\n/g, '<br />')
                  ?.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="w-full max-w-2xl mx-auto my-4 rounded-lg shadow-lg" onerror="console.error(\'이미지 로딩 실패:\', this.src); this.style.display=\'none\';" />')
                  || '내용이 없습니다.' 
              }}
            />
          </div>

          {/* 태그 */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Tag className="w-4 h-4 mr-1" />
                태그
              </h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 오류 정보 */}
          {article.error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-medium text-red-900 mb-2">오류 정보</h3>
              <p className="text-red-700 text-sm">{article.error}</p>
            </div>
          )}

          {/* 메타데이터 */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">생성일:</span> {formatTime(article.created_at)}
              </div>
              <div>
                <span className="font-medium">수정일:</span> {formatTime(article.updated_at)}
              </div>
              <div>
                <span className="font-medium">기사 ID:</span> {article.id}
              </div>
              <div>
                <span className="font-medium">카테고리:</span> {article.category || '미분류'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetail; 