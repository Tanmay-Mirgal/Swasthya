import { redirect } from "next/navigation";

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;
  redirect(`/exercise/${exerciseId}/setup`);
}

