"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ShieldCheck,
  HeartPulse,
  ArrowRight,
  Camera,
  Stethoscope,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { SignInButton } from "@clerk/react";

const steps = [
  {
    badge: "Computer Vision",
    title: "AI Motion Analysis & Joint Tracking",
    desc: "Real-time posture and angle guidance directly through your device's camera. Get instant audio cues to protect your joints.",
    icon: Camera,
    color: "from-emerald-500 to-teal-600",
    tags: ["0 Wearables Needed", "Live Rep Counter", "99.2% Accuracy"],
  },
  {
    badge: "Clinical Care",
    title: "Doctor-Curated Recovery Routines",
    desc: "Connect directly with certified physical therapists who create personalized recovery plans tailored to your injury.",
    icon: Stethoscope,
    color: "from-emerald-600 to-teal-700",
    tags: ["Licensed Specialists", "Direct Messaging", "Personalized Plan"],
  },
  {
    badge: "Verifiable Progress",
    title: "Measurable Range of Motion (ROM)",
    desc: "Watch your recovery progress with daily Range of Motion tracking, consistency streaks, and doctor-ready clinical reports.",
    icon: HeartPulse,
    color: "from-teal-600 to-emerald-500",
    tags: ["ROM Degree Tracking", "Form Accuracy %", "Daily Streaks"],
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      router.push("/signup");
    }
  };

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#F8FAFC] flex justify-center items-center text-slate-900 selection:bg-emerald-500/20 selection:text-emerald-900">
      <div className="relative w-full max-w-[420px] min-h-screen min-h-[100dvh] flex flex-col justify-between px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.75rem)] bg-white sm:border-x sm:border-slate-200/80 shadow-sm overflow-hidden">
        
        {/* Soft Background Accent */}
        <div className="pointer-events-none absolute top-[-50px] right-[-50px] size-[300px] rounded-full bg-emerald-100/40 blur-3xl" />

        {/* Top Bar: Progress Indicator & Skip */}
        <header className="flex items-center justify-between relative z-10 shrink-0 h-10">
          {/* Step Pill Indicators */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === idx
                    ? "w-7 bg-emerald-600"
                    : currentStep > idx
                    ? "w-2.5 bg-emerald-300"
                    : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => router.push("/signup")}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
          >
            Skip
          </button>
        </header>

        {/* Center Content Slide */}
        <main className="flex flex-col items-center justify-center grow py-6 relative z-10 text-center">
          
          {/* Graphic Card */}
          <div className="relative size-36 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-100/40 border border-emerald-200/60 flex items-center justify-center shadow-[0_8px_24px_rgba(5,150,105,0.08)] mb-6 transition-all duration-300">
            <div className="size-20 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-emerald-100">
              <StepIcon className="size-10 text-emerald-600 stroke-[1.8]" />
            </div>

            {/* Corner status bead */}
            <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
          </div>

          {/* Badge */}
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full mb-3">
            {step.badge}
          </span>

          {/* Title */}
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug max-w-[320px]">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-slate-500 text-sm leading-relaxed max-w-[300px] mt-2.5">
            {step.desc}
          </p>

          {/* Feature Tags */}
          <div className="flex flex-wrap justify-center gap-1.5 mt-5">
            {step.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full"
              >
                <CheckCircle2 className="size-3 text-emerald-600" />
                <span>{tag}</span>
              </span>
            ))}
          </div>

        </main>

        {/* Bottom Actions */}
        <footer className="w-full flex flex-col items-center gap-3 relative z-10 shrink-0 pt-2">
          {/* Next / Get Started Button */}
          <button
            onClick={handleNext}
            className="w-full h-13.5 rounded-full flex items-center justify-center gap-2 font-bold text-white text-base bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>{currentStep === steps.length - 1 ? "Get Started" : "Continue"}</span>
            <ArrowRight className="size-5" />
          </button>

          {/* Existing User Sign In */}
          <div className="text-center pt-1 text-xs text-slate-500">
            <span>Already have an account? </span>
            <SignInButton mode="modal">
              <button className="font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer">
                Sign In
              </button>
            </SignInButton>
          </div>
        </footer>

      </div>
    </div>
  );
}
