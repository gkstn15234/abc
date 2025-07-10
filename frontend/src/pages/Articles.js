import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import axios from 'axios';

const Articles = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);

  // 실제 API에서 데이터를 가져옵니다

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      // 실제 API 호출
      const response = await axios.get('/api/v1/articles');
      if (response.data.success) {
        setArticles(response.data.data.articles || []);
      } else {
        setArticles([]);
      }
    } catch (error) {
      console.error('기사 로딩 실패:', error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span className="badge-success">발행완료</span>;
      case 'draft':
        return <span className="badge-warning">초안</span>;
      case 'failed':
        return <span className="badge-error">실패</span>;
      default:
        return <span className="badge">알 수 없음</span>;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'draft':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const deleteArticle = async (articleId) => {
    if (!window.confirm('정말로 이 기사를 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(articleId);
    try {
      // 실제 API 호출
      const response = await axios.delete(`/api/v1/articles/${articleId}`);
      
      if (response.data.success) {
        // 로컬 상태에서도 제거
        setArticles(prev => prev.filter(article => article.id !== articleId));
        
        // 성공 메시지
        alert('기사가 삭제되었습니다');
        console.log('기사가 삭제되었습니다');
      } else {
        throw new Error(response.data.error || '삭제 실패');
      }
    } catch (error) {
      console.error('기사 삭제 실패:', error);
      alert(`기사 삭제에 실패했습니다: ${error.response?.data?.error || error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">기사 목록을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="기사 제목으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="published">발행완료</option>
            <option value="draft">초안</option>
            <option value="failed">실패</option>
          </select>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            loadArticles();
          }}
          className="btn-secondary flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </button>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {articles.filter(a => a.status === 'published').length}
          </div>
          <div className="text-sm text-gray-600">발행완료</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-yellow-600">
            {articles.filter(a => a.status === 'draft').length}
          </div>
          <div className="text-sm text-gray-600">검토대기</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {articles.filter(a => a.status === 'failed').length}
          </div>
          <div className="text-sm text-gray-600">실패</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {articles.length > 0 ? Math.round(articles.reduce((sum, a) => sum + a.quality_score, 0) / articles.length) : 0}
          </div>
          <div className="text-sm text-gray-600">평균 품질점수</div>
        </div>
      </div>

      {/* 기사 목록 */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            기사 목록 ({filteredArticles.length}개)
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredArticles.map((article) => (
            <div key={article.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    {getStatusIcon(article.status)}
                    <h4 
                      className="text-lg font-medium text-gray-900 truncate hover:text-blue-600 cursor-pointer transition-colors"
                      onClick={() => navigate(`/articles/${article.id}`)}
                    >
                      {article.title}
                    </h4>
                    {getStatusBadge(article.status)}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                    <span>출처: {article.source}</span>
                    <span>•</span>
                    <span>{formatTime(article.created_at)}</span>
                    <span>•</span>
                    <span className={getQualityColor(article.quality_score)}>
                      품질점수: {article.quality_score}점
                    </span>
                    {article.auto_publish && (
                      <>
                        <span>•</span>
                        <span className="text-green-600">자동발행</span>
                      </>
                    )}
                  </div>

                  {article.content && (
                    <div className="mb-3">
                      {/* 이미지 미리보기 */}
                      {article.content.includes('![') && (
                        <div className="mb-2">
                          {(() => {
                            const imageMatch = article.content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                            if (imageMatch) {
                              return (
                                <img 
                                  src={imageMatch[2]} 
                                  alt={imageMatch[1]} 
                                  className="w-20 h-20 object-cover rounded border float-right ml-3 mb-2"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      <p className="text-gray-700 text-sm line-clamp-2">
                        {article.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim()}
                      </p>
                    </div>
                  )}

                  {article.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-3">
                      <p className="text-red-700 text-sm">오류: {article.error}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button 
                    onClick={() => navigate(`/articles/${article.id}`)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="기사 보기"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {article.status === 'draft' && (
                    <button 
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="편집"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteArticle(article.id)}
                    disabled={deleting === article.id}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="삭제"
                  >
                    {deleting === article.id ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {filteredArticles.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? '검색 조건에 맞는 기사가 없습니다' 
                  : '아직 생성된 기사가 없습니다'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Articles; 