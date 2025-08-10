import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import sockets from './sockets/index.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('/health', (_req, res) => res.json({ ok: true }));

sockets(io);

// ✅ catch-all ohne '*'
app.use((_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});

