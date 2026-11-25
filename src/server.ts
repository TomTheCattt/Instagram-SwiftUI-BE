import { serve } from '@hono/node-server';
import app from './index';
import { env } from './config/env';
import { setupWebSocketServer } from './websocket';
import type { Server } from 'http';

const port = env.PORT;

console.log(`Server starting on port ${port}...`);

const server = serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
}) as unknown as Server;

setupWebSocketServer(server);
