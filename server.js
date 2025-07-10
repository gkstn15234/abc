const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// 환경변수 로드
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Socket.io 연결 관리
io.on('connection', (socket) => {
  console.log('🔌 클라이언트 연결됨:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 클라이언트 연결 해제됨:', socket.id);
  });
});

// 전역 Socket.io 인스턴스를 다른 모듈에서 사용할 수 있도록 설정
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

// 서버 시작
server.listen(PORT, () => {
  console.log(`🚀 Hyperion-Press 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📊 API 문서: http://localhost:${PORT}/api/v1`);
});

module.exports = { app, server, io }; 