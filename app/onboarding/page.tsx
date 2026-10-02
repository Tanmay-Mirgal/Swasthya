"use client";

import { useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import Link from "next/link";
import { Activity, ShieldCheck, HeartPulse, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const steps = [
  {
    title: "AI Motion Analysis",
    desc: "Real-time pose tracking to ensure your rehabilitation exercises are done perfectly.",
    icon: Activity,
  },
  {
    title: "Therapist Connection",
    desc: "Direct feedback and custom routines curated by your personal physical therapist.",
    icon: ShieldCheck,
  },
  {
    title: "Recover Faster",
    desc: "Track your Range of Motion (ROM) progress daily and get back to your best self.",
    icon: HeartPulse,
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

  const StepIcon = steps[currentStep].icon;

  return (
    <AppShell hideNav={true}>
      <div className="flex flex-col h-full items-center justify-center space-y-8 mt-12 px-2">
        {/* Visual Graphic */}
        <div className="relative w-32 h-32 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200">
          <StepIcon className="w-10 h-10 text-slate-800" />
        </div>

        {/* Text Content */}
        <div className="text-center space-y-3 min-h-[120px]">
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === idx
                    ? "w-8 bg-slate-900"
                    : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {steps[currentStep].title}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            {steps[currentStep].desc}
          </p>
        </div>

        {/* Controls */}
        <div className="w-full pt-8 flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={handleNext}>
            {currentStep === steps.length - 1 ? "Get Started" : "Continue"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
          <Button variant="outline" size="lg" className="w-full" asChild>
            <Link href="/login">
              I already have an account
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
