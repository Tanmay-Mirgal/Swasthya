export function generateStaticParams() {
  return [{ id: "default" }];
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
