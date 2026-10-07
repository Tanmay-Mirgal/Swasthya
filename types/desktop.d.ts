/** Present only inside the Swasthya desktop app (electron/src/preload.js). */
interface SwasthyaDesktopBridge {
  isDesktop: true;
  platform: string;
  version: string;
  /** Opens the system browser to sign in; the result returns through swasthya://auth. */
  startExternalLogin: () => Promise<boolean>;
}

interface Window {
  SwasthyaDesktop?: SwasthyaDesktopBridge;
}
