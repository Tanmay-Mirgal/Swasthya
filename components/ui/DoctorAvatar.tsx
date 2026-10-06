"use client";

import { useState } from "react";
import { Stethoscope, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DoctorAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  isOnline?: boolean;
}

export default function DoctorAvatar({
  src,
  name,
  className,
  size = "md",
  isOnline = false,
}: DoctorAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Extract initials cleanly, omitting "Dr." or "Dr"
  const cleanName = name.replace(/^dr\.?\s+/i, "").trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : cleanName.slice(0, 2).toUpperCase() || "DR";

  const sizeClasses = {
    sm: "size-10 text-xs",
    md: "size-14 text-sm sm:size-16 sm:text-base",
    lg: "size-20 text-lg sm:size-24 sm:text-xl",
    xl: "size-24 text-xl sm:size-28 sm:text-2xl",
  }[size];

  const onlineIndicatorSize = {
    sm: "size-2.5",
    md: "size-3.5",
    lg: "size-4",
    xl: "size-4.5",
  }[size];

  const showImage = Boolean(src && !hasError && src.trim().length > 0);

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-lg overflow-hidden border border-slate-300 select-none",
        sizeClasses,
        className
      )}
    >
      {showImage ? (
        <img
          src={src!}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-emerald-100 text-emerald-800 flex flex-col items-center justify-center font-bold tracking-tight">
          <span>{initials}</span>
        </div>
      )}

      {isOnline && (
        <span
          title="Doctor is online"
          className={cn(
            "absolute bottom-1 right-1 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-600/30",
            onlineIndicatorSize
          )}
        />
      )}
    </div>
  );
}
