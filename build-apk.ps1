# build-apk.ps1 — Helper script to build RehabLens Android APK
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"

Write-Host "==> [1/3] Building Next.js static export..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> [2/3] Syncing Capacitor Android..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> [3/3] Assembling Debug APK..." -ForegroundColor Cyan
Push-Location android
.\gradlew assembleDebug
$gradleCode = $LASTEXITCODE
Pop-Location

if ($gradleCode -eq 0) {
    Write-Host "`nSUCCESS! APK generated at:" -ForegroundColor Green
    Write-Host "android\app\build\outputs\apk\debug\app-debug.apk`n" -ForegroundColor Yellow
} else {
    Write-Host "`nAPK build failed." -ForegroundColor Red
}
exit $gradleCode
