# Expedition Planner - Deployment Script
# This script builds the app, deploys it to Firebase Hosting, and pushes changes to GitHub.

Write-Host "Starting Deployment Process..." -ForegroundColor Cyan

# 1. Build
Write-Host "Building application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Firebase Deploy
Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    Write-Host "Firebase deployment failed. Continuing with Git push..." -ForegroundColor Magenta
}

# 3. Git Push
Write-Host "Committing and Pushing to GitHub..." -ForegroundColor Yellow
git add .
$date = Get-Date
git commit -m "Deployment update: $date"
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed." -ForegroundColor Red
}

Write-Host "Process complete!" -ForegroundColor Green
