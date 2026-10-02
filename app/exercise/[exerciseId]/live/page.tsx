// Server Component — exports generateStaticParams for static export.
// Client UI is in LiveExerciseClient.tsx (has "use client").

import LiveExerciseClient from "./LiveExerciseClient";

// Required for Next.js static export: tells the build which exerciseId params to pre-render.
export function generateStaticParams() {
  return [
    { exerciseId: "seated-knee-extension" },
    { exerciseId: "seated-bicep-curl" },
    { exerciseId: "neck-rotation" },
    { exerciseId: "shoulder-raise" },
  ];
}

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function LiveExercisePage({ params }: PageProps) {
  return <LiveExerciseClient params={params} />;
}
