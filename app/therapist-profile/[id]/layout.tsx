export function generateStaticParams() {
  return [{ id: "default" }];
}

export default function TherapistProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
