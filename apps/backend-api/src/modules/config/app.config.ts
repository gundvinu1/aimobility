import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: 'AI-MOS',
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),
}));
