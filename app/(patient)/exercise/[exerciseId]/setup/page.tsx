// Server Component — exports generateStaticParams for static export.
// Client UI is in CameraSetupClient.tsx (has "use client").

import { Suspense } from "react";
import CameraSetupClient from "./CameraSetupClient";

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

export default function CameraSetupPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <CameraSetupClient params={params} />
    </Suspense>
  );
}
