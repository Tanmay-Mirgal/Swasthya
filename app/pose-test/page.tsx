"use client";

// pose-test is a dev/debug page — full client component is fine here.
// metadata removed because "use client" and metadata export cannot coexist.

import PoseDetector from "@/components/pose/PoseDetector";

export default function PoseTestPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            RehabLens Pose Detection Proof of Concept
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
            Real-time human pose estimation using MediaPipe Pose Landmarker &amp; HTML5 Canvas.
          </p>
        </header>

        <PoseDetector />
      </div>
    </main>
  );
}
