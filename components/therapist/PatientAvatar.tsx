import Image from "next/image";
import { cn } from "@/lib/utils";

export default function PatientAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "P";
  return src ? (
    <Image src={src} alt="" width={40} height={40} unoptimized className={cn("size-10 shrink-0 rounded-full border border-slate-300 object-cover", className)} />
  ) : (
    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700", className)}>
      {initials}
    </span>
  );
}
