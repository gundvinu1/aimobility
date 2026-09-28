#!/usr/bin/env bash
# =============================================================================
# AI-MOS Setup Script
# Run this script to set up the development environment from scratch
# =============================================================================

set -e

echo "🚀 Setting up AI-MOS development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Run: npm install -g pnpm@9"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required. Install from https://docker.com"; exit 1; }

echo "✅ Prerequisites check passed"

# Copy env file
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example"
else
  echo "ℹ️  .env already exists, skipping"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
pnpm db:generate

# Run migrations
echo "🗄️  Running database migrations..."
pnpm db:migrate

echo ""
echo "✅ AI-MOS setup complete!"
echo ""
echo "Start development with: pnpm dev"
echo ""
echo "  Frontend:  http://localhost:3000/dashboard"
echo "  Backend:   http://localhost:4000/api/v1"
echo "  Swagger:   http://localhost:4000/api/v1/docs"
echo ""
