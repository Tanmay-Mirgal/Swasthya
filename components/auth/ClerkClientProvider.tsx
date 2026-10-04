"use client";

import { ClerkProvider } from "@clerk/react";
import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

export default function ClerkClientProvider({ children, publishableKey }: { children: React.ReactNode, publishableKey: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener("appUrlOpen", (data) => {
      // Intercept the deep link from Clerk SSO (e.g., com.tanmay.rehablens://...)
      if (data.url.includes("com.tanmay.rehablens://")) {
        const url = new URL(data.url);
        
        // If the URL has query parameters or hash (which Clerk uses for SSO tokens),
        // we extract them and redirect the Next.js router to the sign-in page so Clerk can process them.
        // Assuming the SignIn component is on the /sign-in route:
        let destination = "/sign-in";
        
        if (url.search || url.hash) {
          destination += `${url.search}${url.hash}`;
        }
        
        router.push(destination);
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [router]);

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}
