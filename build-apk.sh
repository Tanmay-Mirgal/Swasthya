#!/bin/bash
# build-apk.sh - Build Android APK for RehabLens (macOS/Linux)
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
echo -e "\n==> [1/2] Syncing Capacitor configuration..."
npx cap sync android
if [ $? -ne 0 ]; then
    echo -e "\nCapacitor sync failed!"
    exit 1
fi

echo -e "\n==> [2/2] Compiling Debug APK..."
cd android
./gradlew assembleDebug
GRADLE_CODE=$?

if [ $GRADLE_CODE -eq 0 ]; then
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
    echo -e "\n=================================================="
    echo -e " SUCCESS! FRESH APK GENERATED!"
    echo -e " File: android/$APK_PATH"
    echo -e "==================================================\n"
else
    echo -e "\nAPK build failed."
fi

exit $GRADLE_CODE
