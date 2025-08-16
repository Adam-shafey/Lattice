@echo off

REM Build script for AccessControlUI integration

echo 🏗️  Building AccessControlUI...

REM Navigate to AccessControlUI directory
cd AccessControlUI

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Build the React app
echo 🔨 Building React app...
npm run build

REM Check if build was successful
if %ERRORLEVEL% EQU 0 (
    echo ✅ AccessControlUI built successfully!
    echo 📁 Build output: AccessControlUI/dist/
    echo 🌐 Admin UI will be available at: http://localhost:3000/admin
) else (
    echo ❌ Build failed!
    exit /b 1
)

REM Go back to root
cd ..

echo 🎉 Setup complete! Run 'npm run dev' to start the server with admin UI.
