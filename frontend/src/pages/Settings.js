import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Key, 
  Rss, 
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

const Settings = () => {
  const [settings, setSettings] = useState({
    rss_feeds: [],
    automation_mode: false,
    scan_interval: 30,
    quality_threshold: 80,
    openai_configured: false,
    google_search_configured: false,
    github_configured: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [message, setMessage] = useState(null);

  const [apiKeys, setApiKeys] = useState({
    openai_api_key: '',
    google_search_api_key: '',
    google_search_engine_id: '',
    cloudflare_account_id: '',
    cloudflare_api_token: '',
    github_token: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await axios.get('/api/v1/settings');
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('설정 로딩 실패:', error);
      showMessage('설정을 불러오는데 실패했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // API 키 저장
      if (Object.values(apiKeys).some(key => key.trim() !== '')) {
        const apiKeyResponse = await axios.post('/api/v1/settings/api-keys', apiKeys);
        if (apiKeyResponse.data.success) {
          showMessage('API 키가 저장되었습니다', 'success');
          // 설정 상태 다시 로드
          await loadSettings();
        }
      }
      
      // 일반 설정 저장
      const response = await axios.post('/api/v1/settings', settings);
      
      if (response.data.success) {
        showMessage('설정이 저장되었습니다', 'success');
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      showMessage('설정 저장에 실패했습니다', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const addRssFeed = () => {
    setSettings(prev => ({
      ...prev,
      rss_feeds: [...prev.rss_feeds, '']
    }));
  };

  const updateRssFeed = (index, value) => {
    setSettings(prev => ({
      ...prev,
      rss_feeds: prev.rss_feeds.map((feed, i) => i === index ? value : feed)
    }));
  };

  const removeRssFeed = (index) => {
    setSettings(prev => ({
      ...prev,
      rss_feeds: prev.rss_feeds.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">설정을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 메시지 */}
      {message && (
        <div className={`p-4 rounded-md flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* API 키 설정 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">API 키 설정</h3>
          </div>
          <button
            onClick={() => setShowApiKeys(!showApiKeys)}
            className="btn-secondary flex items-center"
          >
            {showApiKeys ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showApiKeys ? '숨기기' : '보기'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${settings.openai_configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">OpenAI API</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${settings.google_search_configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">Google Search API</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${settings.cloudflare_configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">Cloudflare API</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${settings.github_configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">GitHub Token</span>
          </div>
        </div>

        {showApiKeys && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={apiKeys.openai_api_key}
                onChange={(e) => setApiKeys(prev => ({ ...prev, openai_api_key: e.target.value }))}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                https://platform.openai.com/api-keys 에서 발급받으세요
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Search API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.google_search_api_key}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, google_search_api_key: e.target.value }))}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Engine ID
                </label>
                <input
                  type="text"
                  value={apiKeys.google_search_engine_id}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, google_search_engine_id: e.target.value }))}
                  placeholder="검색 엔진 ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cloudflare Account ID
                </label>
                <input
                  type="password"
                  value={apiKeys.cloudflare_account_id}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, cloudflare_account_id: e.target.value }))}
                  placeholder="Cloudflare 계정 ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cloudflare API Token
                </label>
                <input
                  type="password"
                  value={apiKeys.cloudflare_api_token}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, cloudflare_api_token: e.target.value }))}
                  placeholder="Cloudflare API 토큰"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Token
              </label>
              <input
                type="password"
                value={apiKeys.github_token}
                onChange={(e) => setApiKeys(prev => ({ ...prev, github_token: e.target.value }))}
                placeholder="ghp_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                자동 발행을 위한 GitHub Personal Access Token
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RSS 피드 설정 */}
      <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Rss className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">RSS 피드 설정</h3>
        </div>

        <div className="space-y-3">
          {settings.rss_feeds.map((feed, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="url"
                value={feed}
                onChange={(e) => updateRssFeed(index, e.target.value)}
                placeholder="https://news.google.com/rss?..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => removeRssFeed(index)}
                className="px-3 py-2 text-red-600 hover:text-red-700"
              >
                제거
              </button>
            </div>
          ))}
          <button
            onClick={addRssFeed}
            className="btn-secondary"
          >
            RSS 피드 추가
          </button>
        </div>
      </div>

      {/* 자동화 설정 */}
      <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <SettingsIcon className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">자동화 설정</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">자동화 모드</label>
              <p className="text-xs text-gray-500">시스템이 자동으로 기사를 생성하고 발행합니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.automation_mode}
                onChange={(e) => setSettings(prev => ({ ...prev, automation_mode: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                스캔 주기 (분)
              </label>
              <input
                type="number"
                value={settings.scan_interval}
                onChange={(e) => setSettings(prev => ({ ...prev, scan_interval: parseInt(e.target.value) }))}
                min="5"
                max="1440"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                품질 임계값
              </label>
              <input
                type="number"
                value={settings.quality_threshold}
                onChange={(e) => setSettings(prev => ({ ...prev, quality_threshold: parseInt(e.target.value) }))}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                이 점수 이상의 기사만 자동 발행됩니다
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={loadSettings}
          className="btn-secondary flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          다시 로드
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary flex items-center"
        >
          {saving ? (
            <div className="loading-spinner mr-2"></div>
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          설정 저장
        </button>
      </div>
    </div>
  );
};

export default Settings; 