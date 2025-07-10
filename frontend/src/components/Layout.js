import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Settings, 
  Bot, 
  Menu,
  X,
  Play,
  Pause,
  Activity
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemRunning, setSystemRunning] = useState(true);
  const location = useLocation();

  const navigation = [
    { name: '대시보드', href: '/', icon: Home },
    { name: '기사 관리', href: '/articles', icon: FileText },
    { name: '실시간 자동화', href: '/automation', icon: Activity },
    { name: '설정', href: '/settings', icon: Settings },
  ];

  const toggleSystem = () => {
    setSystemRunning(!systemRunning);
    // TODO: 실제 API 호출
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 사이드바 */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Bot className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Hyperion-Press</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 transition-colors`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* 시스템 제어 */}
        <div className="absolute bottom-6 left-3 right-3">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">시스템 상태</span>
              <div className={`status-dot ${systemRunning ? 'online' : 'offline'}`}></div>
            </div>
            <button
              onClick={toggleSystem}
              className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                systemRunning
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {systemRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  일시정지
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  시작
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden mr-4"
              >
                <Menu className="w-6 h-6 text-gray-500" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">
                {navigation.find(item => item.href === location.pathname)?.name || '대시보드'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`status-dot ${systemRunning ? 'online' : 'offline'}`}></div>
                <span className="text-sm text-gray-600">
                  {systemRunning ? '자동 운영 중' : '일시 정지됨'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleString('ko-KR')}
              </div>
            </div>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 