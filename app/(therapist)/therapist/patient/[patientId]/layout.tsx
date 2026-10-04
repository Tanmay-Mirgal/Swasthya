export function generateStaticParams() {
  return [{ patientId: "pat_1" }, { patientId: "pat_2" }];
}

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
