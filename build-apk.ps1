# build-apk.ps1 — Reliable Android APK build for RehabLens
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$env:CAPACITOR_BUILD = "true"

Write-Host "`n==> [1/3] Exporting fresh static web assets..." -ForegroundColor Cyan

# Temporarily move server API routes outside app/ so Next.js static export generates client SPA bundle
$hasApi = Test-Path "app\api"
if ($hasApi) {
    Move-Item -Path "app\api" -Destination "api_temp_backup" -Force
}

try {
    npx next build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nNext.js build failed!" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    if (Test-Path "api_temp_backup") {
        Move-Item -Path "api_temp_backup" -Destination "app\api" -Force
    }
}

Write-Host "`n==> [2/3] Syncing fresh web assets into Android project..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nCapacitor sync failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n==> [3/3] Compiling fresh Debug APK..." -ForegroundColor Cyan
Push-Location android
.\gradlew assembleDebug
$gradleCode = $LASTEXITCODE
Pop-Location

if ($gradleCode -eq 0) {
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    $apkItem = Get-Item $apkPath
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host " SUCCESS! FRESH APK GENERATED!" -ForegroundColor Green
    Write-Host " File: $($apkItem.FullName)" -ForegroundColor Yellow
    Write-Host " Time: $($apkItem.LastWriteTime)" -ForegroundColor Yellow
    Write-Host " Size: $([math]::Round($apkItem.Length / 1MB, 2)) MB" -ForegroundColor Yellow
    Write-Host "==================================================`n" -ForegroundColor Green
} else {
    Write-Host "`nAPK build failed." -ForegroundColor Red
}

exit $gradleCode
