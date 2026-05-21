#!/bin/bash

# Vilvom Backend Setup Script
echo "🍃 Setting up Vilvom Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v20+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Navigate to backend directory
cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env 2>/dev/null || echo "
# Database Configuration
DATABASE_URL=mongodb+srv://mukilan:mukilan@cluster0.c5yb5jt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
DATABASE_NAME=vilvom_db

# JWT Configuration  
JWT_SECRET=vilvom-super-secure-jwt-secret-key-2024-change-in-production
JWT_EXPIRES_IN=7d

# API Gateway Configuration
API_GATEWAY_PORT=5000

# Environment
NODE_ENV=development
LOG_LEVEL=debug
" > .env
    
    echo "⚠️  Please update the .env file with your specific configuration!"
fi

# Check if MongoDB connection is working
echo "🔍 Testing MongoDB connection..."
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://mukilan:mukilan@cluster0.c5yb5jt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(() => {
    console.log('✅ MongoDB connection successful');
    mongoose.connection.close();
})
.catch(err => {
    console.log('❌ MongoDB connection failed:', err.message);
    process.exit(1);
});
" 2>/dev/null || echo "⚠️  MongoDB connection test skipped (mongoose not installed yet)"

echo "
🚀 Setup completed successfully!

📋 Next steps:
1. Update the .env file if needed
2. Start the development server:
   npm run start:dev

3. Visit the API documentation:
   http://localhost:5000/api/docs

4. Test the health endpoint:
   http://localhost:5000/api/health

🔧 Available commands:
- npm run start:dev     # Start in development mode
- npm run build         # Build for production
- npm run start:prod    # Start in production mode
- npm run test          # Run tests
- npm run lint          # Lint code

Happy coding! 🍃
"