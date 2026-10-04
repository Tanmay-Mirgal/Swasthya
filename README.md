# RehabLens

RehabLens is a comprehensive rehabilitation and exercise tracking application designed to assist users in performing physical therapy exercises correctly using real-time pose detection and AI feedback. The application is built using modern web technologies and wrapped for mobile devices using Capacitor.

## 🚀 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, static export)
- **UI Library:** [React](https://react.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Mobile Runtime:** [Capacitor](https://capacitorjs.com/) (Android)
- **Computer Vision:** [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker) (Pose Detection)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** TypeScript

## 📌 Current Status & Features

The project is currently actively under development. The core infrastructure for the Next.js web application and the Android Capacitor wrapper is fully configured. Real-time camera integration and pose detection have been implemented.

### Implemented Features (as of current milestone)

- **Exercise Setup & Live Tracking:**
  - Dynamic routing for exercises (`/exercise/[exerciseId]/live` and `setup`).
  - Currently supported exercises:
    - Seated Knee Extension
    - Seated Bicep Curl
    - Neck Rotation
    - Shoulder Raise
- **Real-Time Pose Detection:**
  - Integrated Google MediaPipe for on-device, real-time skeletal tracking.
  - Dedicated pose testing environment (`/pose-test`).
- **Progress & Session Management:**
  - Track user progress (`/progress`).
  - View session history and details (`/session`).
- **Feedback System:**
  - A dedicated feedback API route (`/api/feedback`) is set up to handle analysis and user feedback.
- **Mobile Ready:**
  - Capacitor configuration is completely set up for Android.
  - Generates `.apk` builds directly from the Next.js static export using `npm run cap:build`.

## 🛠️ Development & Building

### Prerequisites

- Node.js (v18+)
- Java 21 (Required for Android Capacitor Gradle build)
- Android Studio / Android SDK

### Running Locally (Web)

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

### Building the Android App

To build the project for Android, run the Capacitor build command which exports the Next.js static site and syncs it with the Android project:

```bash
npm run cap:build
```

Then, you can open it in Android Studio:

```bash
npm run cap:open
```

Or build the APK via Gradle manually:

```bash
cd android
./gradlew assembleDebug
```

*(The generated APK will be available in `android/app/build/outputs/apk/debug/app-debug.apk`)*

## 📁 Project Structure Highlights

- `/app` - Next.js App Router containing pages for exercises, progress, session, and API routes.
- `/components` - Reusable React components divided by domain (exercise, navigation, pose, session).
- `/android` - Generated project handled by Capacitor.
- `capacitor.config.ts` - Configuration for the mobile runtime (e.g., API allowances, splash screens, dark mode).
