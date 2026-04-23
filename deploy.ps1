param (
    [string]$Message = "Update codebase"
)

Write-Host "🚀 Starting deployment to GitHub and Firebase..." -ForegroundColor Cyan

# 1. Git Changes
Write-Host "📦 Committing changes to Git..." -ForegroundColor Yellow
git add .
git commit -m $Message
git push

# 2. Build
Write-Host "🏗️ Building the application..." -ForegroundColor Yellow
npm run build

# 3. Firebase Deploy
Write-Host "🔥 Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy

Write-Host "✅ Deployment successful!" -ForegroundColor Green
