"use client";

import { useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import Link from "next/link";
import { Mail, Lock, User, UserPlus, Activity, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const [role, setRole] = useState<"patient" | "therapist">("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "therapist") {
      router.push("/therapist");
    } else {
      router.push("/");
    }
  };

  return (
    <AppShell hideNav={true} showBackNav={true} backHref="/login">
      <div className="flex flex-col flex-1 mt-4 px-2">
        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Create an account
          </h1>
          <p className="text-sm text-slate-500">
            Join Swasthya and start your rehabilitation journey.
          </p>
        </div>

        {/* Role Toggle */}
        <div className="bg-slate-100 p-1 rounded-lg flex items-center mb-8 border border-slate-200">
          <button
            onClick={() => setRole("patient")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
              role === "patient"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Activity className="w-4 h-4" />
            Patient
          </button>
          <button
            onClick={() => setRole("therapist")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
              role === "therapist"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Therapist
          </button>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 ml-1">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-slate-400"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 ml-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-slate-400"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 ml-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" size="lg" className="w-full">
              <UserPlus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
          </div>
        </form>

        <div className="mt-auto pt-8 pb-4 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-slate-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
