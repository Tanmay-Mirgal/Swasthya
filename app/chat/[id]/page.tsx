"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import { Loader2 } from "lucide-react";

export default function ChatRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  useEffect(() => {
    // If id looks like a mongo id or doctor id, forward to consultation
    router.replace(`/consultation/${id}`);
  }, [id, router]);

  return (
    <AppShell>
      <div className="flex flex-col h-[70vh] items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs text-slate-500 font-medium">Opening secure consultation room...</p>
      </div>
    </AppShell>
  );
}

