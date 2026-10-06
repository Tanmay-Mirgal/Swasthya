import ClerkClientProvider from "@/components/auth/ClerkClientProvider";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Kalam } from "next/font/google";
import AuthGuard from "@/components/auth/AuthGuard";
import CallProvider from "@/components/consultation/CallProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Handwriting for therapist-written notes (pen = a person wrote it, toner = automated).
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin", "devanagari"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Swasthya — Guided rehabilitation at home",
  description:
    "Do your prescribed rehabilitation exercises at home with camera-based movement feedback, and stay in touch with your physiotherapist.",
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
  // Responsive viewport configuration
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled for accessibility.
  themeColor: "#FBFBF8",
  // Support safe areas
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
      className={`${geistSans.variable} ${geistMono.variable} ${kalam.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-slate-900">
        <ClerkClientProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ""}>
          <ToastProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-md">
              Skip to main content
            </a>
            <AuthGuard>{children}</AuthGuard>
            <CallProvider />
          </ToastProvider>
        </ClerkClientProvider>
      </body>
    </html>
  );
}