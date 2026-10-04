"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  useFullGraphic?: boolean; // If true, uses the full graphic including the original typography
  href?: string;
}

export default function Logo({
  className,
  size = "md",
  showWordmark = true,
  useFullGraphic = false,
  href,
}: LogoProps) {
  const iconDimensions = {
    sm: "size-8",
    md: "size-10",
    lg: "size-14",
    xl: "size-20",
  }[size];

  const textDimensions = {
    sm: "text-base font-bold",
    md: "text-lg font-bold",
    lg: "text-2xl sm:text-3xl font-extrabold",
    xl: "text-3xl sm:text-4xl font-extrabold",
  }[size];

  // If useFullGraphic is requested (e.g. for hero / splash welcome)
  if (useFullGraphic) {
    const fullGraphicDimensions = {
      sm: "w-28 h-auto",
      md: "w-36 h-auto",
      lg: "w-48 sm:w-56 h-auto",
      xl: "w-64 sm:w-72 h-auto",
    }[size];

    const fullContent = (
      <div className={cn("relative flex items-center justify-center shrink-0 group select-none", className)}>
        <Image
          src="/swasthya-logo-full.png"
          alt="Swasthya"
          width={400}
          height={370}
          className={cn("object-contain transition-transform duration-300 group-hover:scale-105", fullGraphicDimensions)}
          priority
        />
      </div>
    );

    if (href) {
      return <Link href={href}>{fullContent}</Link>;
    }
    return fullContent;
  }

  // Standard Mode: Clean Transparent Icon + Crisp Typography (with optional wordmark)
  const logoIcon = (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105",
        iconDimensions
      )}
    >
      <Image
        src="/swasthya-logo-icon.png"
        alt="Swasthya Icon"
        width={120}
        height={120}
        className="w-full h-full object-contain drop-shadow-xs"
        priority
      />
    </div>
  );

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 group select-none", className)}>
      {logoIcon}

      {showWordmark && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "tracking-tight text-slate-900 font-extrabold",
              textDimensions
            )}
          >
            Swasthya
          </span>
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
