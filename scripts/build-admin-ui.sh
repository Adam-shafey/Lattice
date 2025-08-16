#!/bin/bash

# Build script for AccessControlUI integration

echo "🏗️  Building AccessControlUI..."

# Navigate to AccessControlUI directory
cd AccessControlUI

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the React app
echo "🔨 Building React app..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ AccessControlUI built successfully!"
    echo "📁 Build output: AccessControlUI/dist/"
    echo "🌐 Admin UI will be available at: http://localhost:3000/admin"
else
    echo "❌ Build failed!"
    exit 1
fi

# Go back to root
cd ..

echo "🎉 Setup complete! Run 'npm run dev' to start the server with admin UI."
