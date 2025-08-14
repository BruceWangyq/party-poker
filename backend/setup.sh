#!/bin/bash

# Party Poker Backend Setup Script

set -e

echo "🎰 Setting up Party Poker Backend..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating .env file..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration"
fi

# Create logs directory
mkdir -p logs
echo "📁 Created logs directory"

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Check if Redis is available (optional)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is available and running"
    else
        echo "⚠️ Redis is installed but not running. Rate limiting will use memory."
    fi
else
    echo "⚠️ Redis is not installed. Rate limiting will use memory."
fi

echo ""
echo "🚀 Setup complete! You can now start the server:"
echo ""
echo "  Development:  npm run dev"
echo "  Production:   npm start"
echo ""
echo "📊 Health check: http://localhost:3000/api/health"
echo "📖 API docs:     http://localhost:3000"
echo ""
echo "🎮 Happy gaming!"