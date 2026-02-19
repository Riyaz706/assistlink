# PowerShell script to start Expo Go with proper error handling

Write-Host "Starting Expo development server..." -ForegroundColor Green
Write-Host ""

# Change to the correct directory
Set-Location $PSScriptRoot

# Try to start Expo
try {
    # Start Expo - the fetch error is just a warning, Metro will still start
    npx expo start --clear
} catch {
    Write-Host ""
    Write-Host "If you see a 'fetch failed' error, that's OK!" -ForegroundColor Yellow
    Write-Host "Metro bundler should still be starting..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Look for:" -ForegroundColor Cyan
    Write-Host "  - Metro waiting on exp://..." -ForegroundColor Cyan
    Write-Host "  - QR code to scan" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "If Metro doesn't start, try:" -ForegroundColor Yellow
    Write-Host "  npm run start:offline" -ForegroundColor White
}

