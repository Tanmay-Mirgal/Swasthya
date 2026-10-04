import SplashScreen from "@/components/splash/SplashScreen";

export const metadata = {
  title: "Swasthya - AI Physical Therapy",
  description: "Next-generation computer vision for physical rehabilitation.",
};

export default function SplashPage() {
  return <SplashScreen launchHref="/onboarding" signInHref="/sign-in" />;
}
