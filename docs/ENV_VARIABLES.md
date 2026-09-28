# Environment Variables Reference

All environment variables are configured in `.env` (copy from `.env.example`).

## Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `4000` | Backend API port |
| `API_URL` | No | `http://localhost:4000` | Backend API base URL |
| `WEB_URL` | No | `http://localhost:3000` | Frontend base URL |

## Database

| Variable | **Required** | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |

Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`

## Redis

| Variable | **Required** | Description |
|---|---|---|
| `REDIS_URL` | ✅ | Redis connection URL |

Format: `redis://HOST:PORT` or `redis://:PASSWORD@HOST:PORT`

## Security

| Variable | Description | Module |
|---|---|---|
| `CORS_ORIGINS` | Comma-separated list of allowed origins | Foundation |
| `JWT_SECRET` | JWT signing secret (placeholder) | Auth module (future) |
| `JWT_REFRESH_SECRET` | JWT refresh signing secret (placeholder) | Auth module (future) |

> **Note**: JWT variables are placeholders only. They will be validated strictly when the Authentication module is implemented.

## Application Fails on Invalid Config

The backend validates all required environment variables at startup using Zod.
If required variables are missing or invalid, the application will exit with a clear error message.
