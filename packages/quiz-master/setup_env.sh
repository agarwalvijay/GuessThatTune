#!/bin/bash
# Quiz Master App Environment Setup

# Set Java 17
export JAVA_HOME="/usr/local/Cellar/openjdk@17/17.0.17/libexec/openjdk.jdk/Contents/Home"

# Set Android SDK
export ANDROID_HOME="/Users/vijayagarwal/Library/Android/sdk"

# Add Android tools to PATH
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$PATH"

# Verify setup
echo "🔧 Environment Setup:"
echo "Java Home: $JAVA_HOME"
echo "Android Home: $ANDROID_HOME"
echo ""

# Check Java version
echo "☕ Java Version:"
$JAVA_HOME/bin/java -version
echo ""

# Check ADB
echo "📱 ADB Status:"
adb devices
echo ""

echo "✅ Environment ready! You can now run: npx react-native run-android"
