// Server Component — exports generateStaticParams for static export.
// Client UI is in CameraSetupClient.tsx (has "use client").

import { Suspense } from "react";
import { getAllMovementTemplates } from "@/lib/movement/template/registry";
import CameraSetupClient from "./CameraSetupClient";

// Required for Next.js static export: tells the build which exerciseId params to pre-render.
export function generateStaticParams() {
  return getAllMovementTemplates().map((t) => ({ exerciseId: t.id }));
}

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function CameraSetupPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <CameraSetupClient params={params} />
    </Suspense>
  );
}
