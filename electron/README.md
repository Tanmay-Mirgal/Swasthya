# Swasthya Desktop (Electron)

A thin desktop shell around the Swasthya web app. It has **no backend and no UI of its own**: it loads
`https://swasthya.tanmaymirgal.dev` (see `electron.config.json`), so every web deploy updates the desktop
UI immediately. The installer only changes when the shell (Electron/Chromium, menus, permissions) changes.

## Develop

```bash
npm run dev            # terminal 1, repo root: the web app on :3000
npm run electron:dev   # terminal 2, repo root: the shell pointing at http://localhost:3000
```

First time only: `npm --prefix electron install`. The shell shows an offline screen until the server is up
and reconnects on its own. `SWASTHYA_APP_URL` overrides the URL **only when unpackaged**.

## Build installers

```bash
npm run electron:build                           # for the current OS, into electron/dist
npm --prefix electron run dist:mac               # macOS dmg + zip (arm64, x64), on a Mac
npm --prefix electron run dist:win               # Windows NSIS installer (x64), on Windows
```

Releases are built by `.github/workflows/desktop-release.yml` when you push a tag such as `desktop-v1.0.1`
(it must match `version` in `electron/package.json`) and are published to GitHub Releases.

## What the shell does

- **Security:** sandboxed renderer, context isolation, no Node in the page. The window may only show Swasthya
  plus Clerk and Razorpay; other links open in the system browser (https/mailto/tel only). Camera and microphone
  are granted only to the Swasthya origin, and the OS privacy switches are respected (macOS prompt; guidance to
  Settings on macOS and Windows when denied). Packaged builds disable Node CLI/inspector fuses and encrypt cookies.
- **Sign-in:** email sign-in works inside the window. Social login (Google) is refused by providers in embedded
  windows, so the sign-in page offers *Continue in your browser*: the browser signs in, then returns a one-time
  code through `swasthya://auth`, redeemed with a PKCE verifier that never leaves the app (`src/protocol.js`,
  `app/desktop-auth`, `app/api/desktop/auth`).
- **Updates:** `electron-updater` via GitHub Releases. Windows updates automatically. macOS builds are unsigned
  for now, so the app only points to the download page; set `macAutoUpdate` to `true` in `electron.config.json`
  once builds are signed and notarized.
- **Not here on purpose:** MediaPipe, WebRTC, realtime and recording all run unchanged in Chromium, exactly as
  in the browser. Do not re-implement them in the shell.

## Signing (later)

Unsigned builds show a SmartScreen warning on Windows and are blocked by Gatekeeper on macOS until the user
chooses *Open*. To sign, add credentials as GitHub Actions secrets (see the comment in the workflow); never
commit certificates or keys.
