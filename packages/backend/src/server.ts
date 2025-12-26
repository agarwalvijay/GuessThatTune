import express, { Express } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import config from './config/environment';
import gameRoutes, { setSocketIO } from './routes/game.routes';
import spotifyRoutes from './routes/spotify.routes';
import { setupSocketHandlers } from './socket/socketHandler';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@song-quiz/shared';

// Create Express app
const app: Express = express();
const httpServer = createServer(app);

// Create Socket.io server with typed events
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// Pass socket.io instance to routes
setSocketIO(io);

// API Routes
app.use('/api/game', gameRoutes);
app.use('/api/spotify', spotifyRoutes);

// Static file paths
const participantWebPath = path.join(__dirname, '../../participant-web/dist');
const quizMasterWebPath = path.join(__dirname, '../../quiz-master-web/dist');

// Serve static files from both apps (priority order matters)
// Try participant-web assets first, then quiz-master-web
app.use(express.static(participantWebPath));
app.use(express.static(quizMasterWebPath));

// SPA fallback routing
app.get('*', (req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // Serve participant web for /join routes
  if (req.path.startsWith('/join')) {
    return res.sendFile(path.join(participantWebPath, 'index.html'));
  }

  // Serve quiz master web for all other routes
  res.sendFile(path.join(quizMasterWebPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: config.isDevelopment ? err.message : 'Internal server error',
  });
});

// Start server
httpServer.listen(config.port, () => {
  console.log('===========================================');
  console.log('🎵 Song Quiz Game Server');
  console.log('===========================================');
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Server: http://localhost:${config.port}`);
  console.log(`Health: http://localhost:${config.port}/health`);
  console.log(`Spotify: Quiz Master handles auth ✓`);
  console.log(`CORS Origin: ${config.corsOrigin}`);
  console.log('===========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export { app, httpServer, io };
