"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Crosshair, ShieldCheck, CheckCircle2, Activity } from "lucide-react";
import { SignInButton } from "@clerk/react";
import Logo from "@/components/brand/Logo";

interface SplashScreenProps {
  onLaunch?: () => void;
  launchHref?: string;
  signInHref?: string;
}

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function SplashScreen({
  onLaunch,
  launchHref = "/onboarding",
}: SplashScreenProps) {
  return (
    <div className="w-full min-h-screen min-h-[100dvh] bg-[#F8FAFC] text-slate-900 selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE VIEW (< 1024px) — Clean Apple Health Product Style
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex lg:hidden flex-col justify-between items-center min-h-screen min-h-[100dvh] w-full max-w-[420px] mx-auto px-6 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[max(env(safe-area-inset-bottom),1.75rem)] relative overflow-hidden bg-[#F8FAFC]">
        
        {/* Soft emerald ambient glow in background */}
        <div className="pointer-events-none absolute top-[-40px] left-1/2 -translate-x-1/2 size-[340px] rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 size-[260px] rounded-full bg-teal-50/80 blur-2xl" />

        {/* Top Status & Brand Header */}
        <header className="flex justify-between items-center w-full relative z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
              AI Rehabilitation
            </span>
          </div>

          <SignInButton mode="modal">
            <button className="text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer">
              Sign In
            </button>
          </SignInButton>
        </header>

        {/* Center: Swasthya Clean Transparent Logo & Biomechanical Visual */}
        <main className="flex flex-col items-center justify-center w-full grow relative z-10 py-2">
          
          {/* Swasthya Transparent App Icon (Zero text underneath, pure transparent background) */}
          <div className="relative flex items-center justify-center group mb-2">
            <div className="absolute -inset-6 rounded-full bg-emerald-100/50 blur-2xl pointer-events-none" />
            <div className="relative size-32 sm:size-36 transition-transform duration-300 group-hover:scale-105 flex items-center justify-center">
              <Image
                src="/swasthya-logo-icon.png"
                alt="Swasthya Health"
                width={260}
                height={220}
                className="w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(5,150,105,0.20)]"
                priority
              />
            </div>
          </div>

          {/* Typography */}
          <div className="text-center flex flex-col items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Swasthya
              </h1>
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
            </div>

            <p className="text-slate-500 text-sm leading-relaxed max-w-[290px]">
              Precision physical therapy powered by computer vision intelligence.
            </p>

            {/* Clinically Validated Pill Badge */}
            <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs">
              <Crosshair className="size-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">
                99.2% Joint Tracking Precision
              </span>
            </div>
          </div>
        </main>

        {/* Bottom Actions: Begin Recovery + Google Sign-In */}
        <footer className="w-full flex flex-col items-center gap-3 relative z-10 shrink-0 pt-2">
          {/* Primary CTA */}
          <Link
            href={launchHref}
            onClick={onLaunch}
            className="w-full h-13.5 rounded-full flex items-center justify-center gap-2 font-bold text-white text-base bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 active:scale-[0.98] transition-all"
          >
            <span>Begin Your Recovery</span>
            <ArrowRight className="size-5" />
          </Link>

          {/* Google Sign-in */}
          <SignInButton mode="modal">
            <button 
              type="button"
              className="w-full h-12 rounded-full flex items-center justify-center gap-2.5 font-semibold text-slate-700 text-sm bg-white hover:bg-slate-50 border border-slate-200/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              <GoogleIcon className="size-4" />
              <span>Continue with Google</span>
            </button>
          </SignInButton>

          {/* Trust Subtext */}
          <div className="flex items-center gap-1.5 text-slate-400 text-xs tracking-wide">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Private, secure & doctor-guided</span>
          </div>
        </footer>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP / WEB VIEW (>= 1024px) — Clean Apple Health Product Hero
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-between min-h-screen w-full bg-[#F8FAFC] relative overflow-hidden">
        
        {/* Soft Background Mesh */}
        <div className="pointer-events-none absolute top-[-100px] right-[-100px] size-[600px] rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-[-80px] size-[500px] rounded-full bg-teal-50/60 blur-3xl" />

        {/* 1140px Centered Desktop Layout */}
        <div className="w-full max-w-[1140px] mx-auto px-12 pt-8 pb-8 flex flex-col justify-between grow relative z-10">
          
          {/* Top Navbar */}
          <nav className="flex justify-between items-center h-16 border-b border-slate-200/80 pb-4">
            <Logo size="md" href="/" />

            <div className="flex items-center gap-8 text-sm font-medium text-slate-600">
              <a href="#how-it-works" className="hover:text-emerald-700 transition-colors">
                How It Works
              </a>
              <a href="#clinicians" className="hover:text-emerald-700 transition-colors">
                For Physical Therapists
              </a>
              <a href="#security" className="hover:text-emerald-700 transition-colors">
                Security & HIPAA
              </a>
            </div>

            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <button 
                  type="button"
                  className="inline-flex items-center gap-2 text-slate-700 text-sm font-semibold hover:text-slate-900 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
                >
                  <GoogleIcon className="size-4" />
                  <span>Sign In</span>
                </button>
              </SignInButton>

              <Link
                href={launchHref}
                onClick={onLaunch}
                className="font-bold text-xs uppercase tracking-wider h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 inline-flex items-center justify-center transition-all active:scale-95"
              >
                <span>Get Started</span>
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </div>
          </nav>

          {/* Main 2-Column Hero */}
          <main className="flex items-center justify-between gap-16 py-16 grow">
            
            {/* Left Column: Hero Text & Badges */}
            <section className="flex flex-col items-start gap-6 w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
                <Activity className="size-3.5 text-emerald-600" />
                <span>AI Computer Vision Rehabilitation</span>
              </div>

              <h1 className="font-extrabold text-slate-900 text-5xl xl:text-6xl leading-[1.08] tracking-tight max-w-[540px]">
                See progress.{" "}
                <br />
                <span className="text-emerald-600">
                  Move forward.
                </span>
              </h1>

              <p className="text-slate-500 text-lg leading-relaxed max-w-[480px]">
                Medical-grade motion intelligence for orthopedic recovery. Real-time form guidance and angle tracking directly through your camera.
              </p>

              {/* Value Badges */}
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>99.2% Joint Precision</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs text-xs font-semibold text-slate-700">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Doctor Curated & HIPAA Safe</span>
                </div>
              </div>

              {/* CTA Row */}
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href={launchHref}
                  onClick={onLaunch}
                  className="font-bold text-sm h-13 px-8 rounded-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 active:scale-[0.98] transition-all"
                >
                  <span>Begin Assessment</span>
                  <ArrowRight className="size-4.5" />
                </Link>

                <SignInButton mode="modal">
                  <button 
                    type="button"
                    className="font-semibold text-sm h-13 px-6 rounded-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                  >
                    <GoogleIcon className="size-4" />
                    <span>Continue with Google</span>
                  </button>
                </SignInButton>
              </div>
            </section>

            {/* Right Column: Transparent Brand Icon & Visual Feature Card */}
            <section className="flex justify-center items-center w-1/2">
              <div className="relative bg-white rounded-3xl p-8 border border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.06)] flex flex-col items-center max-w-[380px] w-full text-center">
                
                <div className="size-32 relative flex items-center justify-center mb-6">
                  <div className="absolute inset-0 rounded-full bg-emerald-100/50 blur-xl pointer-events-none" />
                  <Image
                    src="/swasthya-logo-icon.png"
                    alt="Swasthya AI Motion Engine"
                    width={220}
                    height={190}
                    className="w-full h-full object-contain relative z-10 drop-shadow-[0_10px_24px_rgba(5,150,105,0.20)] transition-transform duration-300 hover:scale-105"
                  />
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  Swasthya AI Motion Engine
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Clinical camera pose analysis with instant audio and visual angle correction.
                </p>

                <div className="w-full py-2.5 px-4 bg-emerald-50/70 border border-emerald-200/50 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900">Form Accuracy</span>
                  <span className="font-bold text-emerald-700">96% Clinically Valid</span>
                </div>
              </div>
            </section>

          </main>

          {/* Desktop Footer */}
          <footer className="w-full pt-8 border-t border-slate-200/80 flex justify-between items-center text-xs text-slate-400">
            <p>© {new Date().getFullYear()} Swasthya Inc. Precision Rehabilitation & Health.</p>
            <div className="flex gap-6">
              <a href="#privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
              <a href="#terms" className="hover:text-slate-600 transition-colors">Terms</a>
              <a href="#hipaa" className="hover:text-slate-600 transition-colors">HIPAA Compliance</a>
            </div>
          </footer>

        </div>
      </div>

    </div>
  );
}
