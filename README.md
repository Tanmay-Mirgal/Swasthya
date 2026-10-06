
.is a comprehensive rehabilitation and exercise tracking web application designed to assist users in performing physical therapy exercises correctly using real-time pose detection and AI feedback. The application is built using modern web technologies on Next.js.

## 🚀 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **UI Library:** [React](https://react.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Authentication:** [Clerk](https://clerk.com/)
- **Database:** [MongoDB with Mongoose](https://mongoosejs.com/)
- **Realtime & Communications:** [Socket.IO](https://socket.io/) and WebRTC
- **Computer Vision:** [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker) (Pose Detection)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** TypeScript

## 📌 Features

### Web Application Features

- **Exercise Setup & Live Tracking:**
  - Dynamic routing for exercises (`/exercise/[exerciseId]/live` and `setup`).
  - Supported exercises:
    - Seated Knee Extension
    - Seated Bicep Curl
    - Neck Rotation
    - Shoulder Raise
- **Real-Time Pose Detection:**
  - Integrated Google MediaPipe for client-side, real-time skeletal tracking.
  - Dedicated pose testing environment (`/pose-test`).
- **Progress & Session Management:**
  - Track user progress (`/progress`).
  - View session history and details (`/session`).
- **Therapist & Patient Consultation:**
  - WebRTC video call with camera and microphone controls.
  - Real-time chat powered by Socket.IO.
  - Clinical prescription generation and assignment synchronization.
- **Feedback & Biomechanics:**
  - Real-time audio coaching cues using Web Speech API.
  - Analytical feedback on range of motion and form.

## 🛠️ Development & Running Locally

### Prerequisites

- Node.js (v18+)
- npm

### Running Locally

```bash
# Install dependencies
npm install

# Run the Next.js dev server
npm run dev

# (Optional) Run the standalone Socket.IO signaling server for video calls/chat
npm run socket
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm run start
```

## 📁 Project Structure Highlights

- `/app` - Next.js App Router containing pages, layouts, and API routes.
- `/components` - Reusable React components divided by domain (consultation, exercise, navigation, pose, session, ui).
- `/hooks` - Custom React hooks for business logic and exercise engine.
- `/lib` - Core utilities, models, WebRTC, Socket.IO client, and biomechanics engines.
- `/public` - Static assets and MediaPipe models.
