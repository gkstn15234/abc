import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  FileText, 
  DollarSign, 
  TrendingUp,
  RefreshCw,
  Play,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  ExternalLink,
  Brain
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState({
    today_published: 0,
    month_published: 0,
    estimated_cost: 0,
    system_status: 'loading'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [popularArticles, setPopularArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rssLoading, setRssLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [chartData, setChartData] = useState([]);

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/v1/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('통계 로딩 실패:', error);
    }
  };

  const loadActivity = async () => {
    try {
      // 실제 활동 로그 API 호출 (현재는 비어있음)
      // const response = await axios.get('/api/v1/activity');
      // if (response.data.success) {
      //   setRecentActivity(response.data.data.activities);
      // }
      
      // 실제 데이터가 없으면 빈 배열
      setRecentActivity([]);
    } catch (error) {
      console.error('활동 로그 로딩 실패:', error);
      setRecentActivity([]);
    }
  };

  const loadPopularArticles = async () => {
    try {
      setRssLoading(true);
      const response = await axios.get('/api/v1/rss/popular');
      if (response.data.success) {
        setPopularArticles(response.data.data.articles.slice(0, 10)); // 상위 10개만
      }
    } catch (error) {
      console.error('인기 기사 로딩 실패:', error);
      setPopularArticles([]);
    } finally {
      setRssLoading(false);
    }
  };

  const runAutomation = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/automation/run', {
        mode: 'test',
        limit: 2
      });
      
      if (response.data.success) {
        // 성공 메시지 추가
        const newActivity = {
          id: Date.now(),
          type: 'success',
          message: `자동화 완료: ${response.data.data.created_articles}개 기사 생성`,
          time: new Date(),
          source: 'Automation'
        };
        setRecentActivity(prev => [newActivity, ...prev.slice(0, 4)]);
        
        // 통계 업데이트
        setStats(prev => ({
          ...prev,
          today_published: prev.today_published + response.data.data.created_articles
        }));
      }
    } catch (error) {
      console.error('자동화 실행 실패:', error);
      const errorActivity = {
        id: Date.now(),
        type: 'error',
        message: '자동화 실행 중 오류 발생',
        time: new Date(),
        source: 'Automation'
      };
      setRecentActivity(prev => [errorActivity, ...prev.slice(0, 4)]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // RSS 인기 기사 자동 로드 제거 - 수동으로만 실행
      await Promise.all([loadStats(), loadActivity()]);
      setLoading(false);
      setLastUpdate(new Date());
    };

    loadData();
    
    // 30초마다 자동 새로고침 (RSS 제외)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getEngagementBadge = (engagement) => {
    const badges = {
      high: { color: 'bg-red-100 text-red-800', text: '높음' },
      medium: { color: 'bg-yellow-100 text-yellow-800', text: '보통' },
      low: { color: 'bg-gray-100 text-gray-800', text: '낮음' }
    };
    return badges[engagement] || badges.medium;
  };

  return (
    <div className="space-y-6">
      {/* 상단 액션 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={runAutomation}
            disabled={loading}
            className="btn-primary flex items-center"
          >
            {loading ? (
              <div className="loading-spinner mr-2"></div>
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            수동 실행
          </button>
          <button
            onClick={() => { loadStats(); loadActivity(); }}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </button>
        </div>
        <div className="text-sm text-gray-500">
          마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">오늘 발행</p>
              <p className="text-3xl font-bold text-gray-900">{stats.today_published}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">이번 달</p>
              <p className="text-3xl font-bold text-gray-900">{stats.month_published}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">월 예상 비용</p>
              <p className="text-3xl font-bold text-gray-900">${stats.estimated_cost.toFixed(2)}</p>
              <p className="text-sm text-gray-500">실제 사용량 기준</p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">시스템 상태</p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.system_status === 'running' ? '정상 운영' : stats.system_status === 'loading' ? '확인 중' : '점검 중'}
              </p>
            </div>
            <Activity className={`w-8 h-8 ${stats.system_status === 'running' ? 'text-green-600' : 'text-gray-400'}`} />
          </div>
        </div>
      </div>

      {/* AI 분석 인기 기사 섹션 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI 분석 인기 기사</h3>
            <span className="text-sm text-gray-500">실시간 품질 분석</span>
          </div>
          <button
            onClick={loadPopularArticles}
            disabled={rssLoading}
            className="btn-secondary text-sm flex items-center"
          >
            {rssLoading ? (
              <div className="loading-spinner mr-1 w-3 h-3"></div>
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            새로고침
          </button>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
          {popularArticles.map((article, index) => (
            <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScoreColor(article.aiQualityScore)}`}>
                      AI 점수: {article.aiQualityScore?.toFixed(1) || 'N/A'}점
                    </span>
                    {article.expectedEngagement && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEngagementBadge(article.expectedEngagement).color}`}>
                        {getEngagementBadge(article.expectedEngagement).text}
                      </span>
                    )}
                    <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                      {article.aiCategory || '일반'}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                    {article.title}
                  </h4>
                  
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {article.description}
                  </p>
                  
                  {article.aiAnalysis && (
                    <p className="text-xs text-purple-600 mb-2 italic">
                      💡 {article.aiAnalysis.substring(0, 100)}...
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-3">
                      <span>{article.source}</span>
                      <span>•</span>
                      <span>{formatTime(new Date(article.pubDate))}</span>
                    </div>
                    
                    {article.detailedScores && (
                      <div className="flex items-center space-x-2">
                        <span title="뉴스가치">📰 {article.detailedScores.newsValue}</span>
                        <span title="인기도">🔥 {article.detailedScores.popularity}</span>
                        <span title="제목품질">📝 {article.detailedScores.titleQuality}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => window.open(article.link, '_blank')}
                  className="ml-3 p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="원문 보기"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          
          {popularArticles.length === 0 && !rssLoading && (
            <div className="text-center text-gray-500 py-8">
              <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>인기 기사를 분석 중입니다...</p>
              <button
                onClick={loadPopularArticles}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                지금 분석하기
              </button>
            </div>
          )}
          
          {rssLoading && (
            <div className="text-center text-gray-500 py-8">
              <div className="loading-spinner mx-auto mb-2"></div>
              <p>AI가 기사를 분석하고 있습니다...</p>
            </div>
          )}
        </div>
      </div>

      {/* 차트와 활동 로그 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 월별 통계 차트 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">월별 발행 통계</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="articles" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="발행된 기사"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <TrendingUp className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">통계 데이터 없음</p>
              <p className="text-sm">기사가 발행되면 차트가 표시됩니다</p>
            </div>
          )}
        </div>

        {/* 최근 활동 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h3>
          <div className="space-y-3 custom-scrollbar max-h-80 overflow-y-auto">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500">{activity.source}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{formatTime(activity.time)}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>아직 활동 내역이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">빠른 액션</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => window.open('/api/v1/rss/test', '_blank')}
            className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <span className="text-sm font-medium">RSS 테스트</span>
          </button>
          
          <button
            onClick={() => window.open('/api/v1/openai/test', '_blank')}
            className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Activity className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <span className="text-sm font-medium">AI 연결 테스트</span>
          </button>
          
          <button
            onClick={() => window.open('/api/v1/stats', '_blank')}
            className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <span className="text-sm font-medium">상세 통계</span>
          </button>
          
          <button
            onClick={() => window.open('/api/v1/settings', '_blank')}
            className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
            <span className="text-sm font-medium">설정 확인</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 