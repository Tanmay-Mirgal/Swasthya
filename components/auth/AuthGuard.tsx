"use client";

import { useAuth, useUser } from "@clerk/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const publicRoutes = ["/", "/sign-in", "/sign-up", "/login", "/signup", "/onboarding", "/splash"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // If the current route is not in the public routes list, redirect to sign-in
      const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname?.startsWith(route + "/"));
      if (!isPublicRoute) {
        router.push("/sign-in");
      }
    } else if (isLoaded && isSignedIn && userLoaded && user) {
      const publicMetadata = user.publicMetadata as any;
      const isSetupRoute = pathname === "/setup" || pathname?.startsWith("/setup/");
      
      if (!publicMetadata.onboardingCompleted && !isSetupRoute) {
        router.push("/setup");
      } else if (publicMetadata.onboardingCompleted && isSetupRoute) {
        // Prevent users from accessing setup again after onboarding
        router.push(publicMetadata.role === "therapist" ? "/therapist" : "/");
      }
    }
  }, [isLoaded, isSignedIn, userLoaded, user, pathname, router]);

  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname?.startsWith(route + "/"));
  
  if (!isLoaded || (!userLoaded && isSignedIn && !isPublicRoute)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoaded && !isSignedIn && !isPublicRoute) {
    return null; 
  }

  // Hide UI if user is signed in but needs to go to setup and isn't there yet
  if (isLoaded && isSignedIn && userLoaded && user) {
    const publicMetadata = user.publicMetadata as any;
    const isSetupRoute = pathname === "/setup" || pathname?.startsWith("/setup/");
    
    if (!publicMetadata.onboardingCompleted && !isSetupRoute) {
      return null;
    }
  }

  return <>{children}</>;
}
