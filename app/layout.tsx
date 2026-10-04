import ClerkClientProvider from "@/components/auth/ClerkClientProvider";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthGuard from "@/components/auth/AuthGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Swasthya — AI Physical Therapy & Pose Guidance",
  description:
    "Real-time AI pose detection, step-by-step guidance, and biomechanical form analysis for physical rehabilitation.",
  icons: {
    icon: "/swasthya-logo-icon.png",
    shortcut: "/swasthya-logo-icon.png",
    apple: "/swasthya-logo-square.png",
  },
  // Mobile web app meta
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Swasthya",
  },
};

// Separate viewport export (required in Next.js 14+)
export const viewport: Viewport = {
  // Proper mobile viewport — prevents scaling issues on Android
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Android status bar color — matches app's light theme
  themeColor: "#F8FAFC",
  // Support notch / gesture bar safe areas
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-slate-900 selection:bg-emerald-500/20 selection:text-emerald-900">
        <ClerkClientProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ""}>
          <AuthGuard>
            {children}
          </AuthGuard>
        </ClerkClientProvider>
      </body>
    </html>
  );
}