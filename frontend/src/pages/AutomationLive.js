import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileText,
  Activity,
  Zap,
  TrendingUp,
  Download
} from 'lucide-react';
import axios from 'axios';

const AutomationLive = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logs, setLogs] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [statistics, setStatistics] = useState({
    totalArticles: 0,
    processedArticles: 0,
    generatedArticles: 0,
    errors: 0,
    costInfo: null
  });
  const [settings, setSettings] = useState({
    mode: 'test',
    limit: 3
  });
  
  const socketRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    // Socket.io 연결
    socketRef.current = io('http://localhost:3000');
    
    socketRef.current.on('connect', () => {
      console.log('🔌 서버에 연결됨');
      addLog('system', '🔌 서버에 연결됨', 'success');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('🔌 서버 연결 해제됨');
      addLog('system', '🔌 서버 연결 해제됨', 'warning');
    });
    
    socketRef.current.on('automation_progress', (data) => {
      handleProgressUpdate(data);
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // 로그가 추가될 때마다 스크롤을 맨 아래로
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type, message, level = 'info') => {
    const newLog = {
      id: Date.now() + Math.random(),
      type,
      message,
      level,
      timestamp: new Date().toLocaleTimeString('ko-KR')
    };
    setLogs(prev => [...prev, newLog]);
  };

  const handleProgressUpdate = (data) => {
    setProgress(data.progress || 0);
    setCurrentStep(data.message || '');
    
    // 로그 추가
    const logLevel = data.type === 'error' ? 'error' : 
                    data.type === 'complete' ? 'success' : 'info';
    addLog(data.type, data.message, logLevel);
    
    // 통계 업데이트
    if (data.data) {
      setStatistics(prev => ({
        ...prev,
        totalArticles: data.data.total_articles || prev.totalArticles,
        generatedArticles: data.data.created_articles || prev.generatedArticles,
        errors: data.data.errors || prev.errors,
        costInfo: data.data.cost_info || prev.costInfo
      }));
    }
    
    if (data.current_article) {
      setStatistics(prev => ({
        ...prev,
        processedArticles: data.current_article.index
      }));
    }
    
    // 완료 또는 오류 시 실행 상태 해제
    if (data.type === 'complete' || data.type === 'error') {
      setIsRunning(false);
    }
  };

  const startAutomation = async () => {
    try {
      setIsRunning(true);
      setProgress(0);
      setLogs([]);
      setStatistics({
        totalArticles: 0,
        processedArticles: 0,
        generatedArticles: 0,
        errors: 0,
        costInfo: null
      });
      
      addLog('system', '🚀 자동화 시작 요청...', 'info');
      
      const response = await axios.post('/api/v1/automation/run-live', settings);
      
      if (response.data.success) {
        setSessionId(response.data.session_id);
        addLog('system', `✅ 자동화 세션 시작됨 (ID: ${response.data.session_id})`, 'success');
      } else {
        throw new Error(response.data.error || '자동화 시작 실패');
      }
    } catch (error) {
      console.error('자동화 시작 오류:', error);
      addLog('system', `❌ 자동화 시작 실패: ${error.message}`, 'error');
      setIsRunning(false);
    }
  };

  const stopAutomation = () => {
    setIsRunning(false);
    addLog('system', '⏹️ 자동화 중지됨', 'warning');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (type, level) => {
    if (level === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (level === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (level === 'warning') return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    
    switch (type) {
      case 'rss_scan':
      case 'rss_complete':
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'processing':
      case 'ai_generating':
        return <Zap className="w-4 h-4 text-purple-500" />;
      case 'article_saved':
        return <FileText className="w-4 h-4 text-indigo-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getProgressColor = () => {
    if (progress === 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-indigo-500';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">실시간 자동화 실행</h1>
          <p className="text-gray-600">자동화 프로세스를 실시간으로 모니터링하고 제어할 수 있습니다.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 컨트롤 패널 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 실행 컨트롤 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">실행 제어</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">실행 모드</label>
                  <select
                    value={settings.mode}
                    onChange={(e) => setSettings(prev => ({ ...prev, mode: e.target.value }))}
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="test">테스트 모드</option>
                    <option value="auto">자동 모드</option>
                    <option value="manual">수동 모드</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">처리할 기사 수</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.limit}
                    onChange={(e) => setSettings(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="flex space-x-3">
                  {!isRunning ? (
                    <button
                      onClick={startAutomation}
                      className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      시작
                    </button>
                  ) : (
                    <button
                      onClick={stopAutomation}
                      className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      중지
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 진행 상황 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">진행 상황</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>전체 진행률</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    {currentStep || '대기 중...'}
                  </div>
                </div>
                
                {sessionId && (
                  <div className="text-xs text-gray-500">
                    세션 ID: {sessionId}
                  </div>
                )}
              </div>
            </div>

            {/* 통계 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">실시간 통계</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{statistics.totalArticles}</div>
                  <div className="text-xs text-gray-500">발견된 기사</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{statistics.processedArticles}</div>
                  <div className="text-xs text-gray-500">처리 중인 기사</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{statistics.generatedArticles}</div>
                  <div className="text-xs text-gray-500">생성된 기사</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{statistics.errors}</div>
                  <div className="text-xs text-gray-500">오류</div>
                </div>
              </div>
              
              {statistics.costInfo && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>예상 비용:</span>
                      <span className="font-medium">${statistics.costInfo.estimatedCost?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>토큰 사용량:</span>
                      <span className="font-medium">{statistics.costInfo.totalTokens || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 실시간 로그 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-12rem)]">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">실시간 로그</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={exportLogs}
                    disabled={logs.length === 0}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    내보내기
                  </button>
                  <button
                    onClick={clearLogs}
                    disabled={logs.length === 0}
                    className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    지우기
                  </button>
                </div>
              </div>
              
              <div className="p-4 h-full overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>자동화를 시작하면 실시간 로그가 여기에 표시됩니다.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg ${
                          log.level === 'error' ? 'bg-red-50 border border-red-200' :
                          log.level === 'success' ? 'bg-green-50 border border-green-200' :
                          log.level === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                          'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getLogIcon(log.type, log.level)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900">{log.message}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {log.timestamp} • {log.type}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationLive; 