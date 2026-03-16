import express, { Request, Response, Application } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telnet } from 'telnet-client';

dotenv.config();

const app: Application = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const LIQUIDSOAP_HOST = '127.0.0.1';
const LIQUIDSOAP_PORT = 1234;

// --- Telnet Client for Liquidsoap ---
const telnet = new Telnet();

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function resolveYoutubeUrl(url: string): Promise<string | null> {
  try {
    // -g returns the direct stream URL
    // -f bestaudio selects the best audio-only stream
    const { stdout } = await execPromise(`yt-dlp -f bestaudio -g "${url}"`);
    return stdout.trim();
  } catch (err) {
    console.error('yt-dlp Error:', err);
    return null;
  }
}

// --- Routes ---

app.post('/api/request', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  console.log(`Received request: ${url}`);
  
  const streamUrl = await resolveYoutubeUrl(url);
  
  if (!streamUrl) {
    return res.status(500).json({ error: 'Failed to resolve YouTube URL' });
  }

  const command = `requests.push ${streamUrl}`;
  const result = await sendToLiquidsoap(command);

  if (result) {
    res.json({ message: 'Song queued successfully', result });
  } else {
    res.status(500).json({ error: 'Failed to queue song' });
  }
});

async function sendToLiquidsoap(command: string) {
  try {
    await telnet.connect({
      host: LIQUIDSOAP_HOST,
      port: LIQUIDSOAP_PORT,
      shellPrompt: '>',
      timeout: 1500
    });
    const res = await telnet.send(command);
    await telnet.end();
    return res;
  } catch (err) {
    console.error('Liquidsoap Telnet Error:', err);
    return null;
  }
}

// --- Socket.io for Messaging ---

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('send_message', (data: { user: string; text: string }) => {
    console.log('Message received:', data);
    io.emit('receive_message', data); // Broadcast to all
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
