import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // App identity
  appId: "com.tanmay.rehablens",
  appName: "RehabLens",

  // Points Capacitor to the public folder (empty shell) for Live Wrapper
  webDir: "public",

  // Android-specific configuration
  android: {
    // Allow cleartext traffic to Groq API (HTTPS so this is just for safety)
    allowMixedContent: false,
    // Capture console.log from WebView in Android logcat for debugging
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },

  // Server configuration for live wrapper
  server: {
    // Replace this URL with your deployed Vercel URL!
    // For local testing on an emulator, use your machine's local IP, e.g., "http://192.168.1.x:3000"
    url: "https://rehablens-nine.vercel.app",
    androidScheme: "com.tanmay.rehablens",
    // Allow CORS for external API calls (Groq API)
    allowNavigation: [
      "api.groq.com",
      "cdn.jsdelivr.net",
      "storage.googleapis.com",
    ],
    // Keep URLs as-is when navigating within WebView. Allow cleartext for local testing over http.
    cleartext: true,
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
