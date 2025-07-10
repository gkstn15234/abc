const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 환경변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Socket.io는 서버리스에서 제외 (로컬 개발시에만 사용)
let io = null;
let server = null;

if (process.env.NODE_ENV !== 'production') {
  const { createServer } = require('http');
  const { Server } = require('socket.io');
  
  server = createServer(app);
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.io 연결 관리
  io.on('connection', (socket) => {
    console.log('🔌 클라이언트 연결됨:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('🔌 클라이언트 연결 해제됨:', socket.id);
    });
  });
}

// 전역 Socket.io 인스턴스 (서버리스에서는 null)
global.io = io;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '🤖 Hyperion-Press API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      articles: '/api/v1/articles',
      automation: '/api/v1/automation',
      settings: '/api/v1/settings',
      stats: '/api/v1/stats'
    }
  });
});

// API 라우트 연결
const apiRoutes = require('./routes/api');
app.use('/api/v1', apiRoutes);

// 프론트엔드 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'frontend/build')));

// React 라우팅을 위한 catch-all 핸들러 (API 제외)
app.get('*', (req, res) => {
  // API 요청이 아닌 경우에만 index.html 반환
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
  } else {
    res.status(404).json({
      error: 'API 엔드포인트를 찾을 수 없습니다',
      path: req.originalUrl
    });
  }
});



// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 서버 시작 (로컬 개발시에만)
if (process.env.NODE_ENV !== 'production' && server) {
  server.listen(PORT, () => {
    console.log(`🚀 Hyperion-Press 서버가 포트 ${PORT}에서 실행 중입니다`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📊 API 문서: http://localhost:${PORT}/api/v1`);
  });
}

// Vercel 서버리스 함수로 내보내기
module.exports = app; 