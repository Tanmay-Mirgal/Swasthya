import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // App identity
  appId: "com.tanmay.rehablens",
  appName: "RehabLens",

  // Points Capacitor to the Next.js static export output directory
  webDir: "out",

  // Android-specific configuration
  android: {
    // Allow cleartext traffic to Groq API (HTTPS so this is just for safety)
    allowMixedContent: false,
    // Capture console.log from WebView in Android logcat for debugging
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },

  // Server configuration for live dev (only used with `npx cap run android --livereload`)
  server: {
    // Allow CORS for external API calls (Groq API)
    allowNavigation: [
      "api.groq.com",
      "cdn.jsdelivr.net",
      "storage.googleapis.com",
    ],
    // Keep URLs as-is when navigating within WebView
    cleartext: false,
  },

  plugins: {
    // SplashScreen configuration
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#09090b",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // StatusBar configuration — matches the app's dark theme
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
      overlaysWebView: false,
    },

    // Keyboard handling — prevent resize when keyboard opens (avoids layout jump)
    Keyboard: {
      resize: "none",
      style: "DARK",
      resizeOnFullScreen: false,
    },
  },
};

export default config;
