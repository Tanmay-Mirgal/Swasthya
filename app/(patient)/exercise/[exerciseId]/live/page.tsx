// Server Component — exports generateStaticParams for static export.
// Client UI is in LiveExerciseClient.tsx (has "use client").

import { Suspense } from "react";
import { getAllMovementTemplates } from "@/lib/movement/template/registry";
import LiveExerciseClient from "./LiveExerciseClient";

// Required for Next.js static export: tells the build which exerciseId params to pre-render.
export function generateStaticParams() {
  return getAllMovementTemplates().map((t) => ({ exerciseId: t.id }));
}

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function LiveExercisePage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <LiveExerciseClient params={params} />
    </Suspense>
  );
}
