import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(JSON.stringify({ level: 'info', message: 'API listening', port: env.PORT }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: `${signal} received; shutting down` }));
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
