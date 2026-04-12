# HomePokerClub - Startup Script

$root = Get-Location
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

# 1. Start Backend in a new window
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; .\.venv\Scripts\Activate.ps1; uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001"

# 2. Start Frontend in a new window
Write-Host "Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"

Write-Host "`nBoth Backend and Frontend are starting in separate windows." -ForegroundColor Yellow
Write-Host "Backend: http://localhost:8001"
Write-Host "Frontend: http://localhost:5173"
