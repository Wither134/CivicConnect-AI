import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from './db/database.js';
import { authRouter } from './routes/auth.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { staffRouter } from './routes/staff.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { superAdminRouter } from './routes/superadmin.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { locksRouter } from './routes/locks.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing middlewares
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Initialize database
await Database.init();

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/admin', adminRouter);
app.use('/api/superadmin', superAdminRouter);
app.use('/api/audit', auditRouter);
app.use('/api/locks', locksRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CivicFix API'
  });
});

// Serve frontend in production or if static build exists
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
    return;
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('CivicFix API Server is running.');
    }
  });
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[CivicFix] Backend API server running on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});

export default app;
