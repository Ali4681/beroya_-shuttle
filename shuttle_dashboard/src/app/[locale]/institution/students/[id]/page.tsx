import { StudentDetailView } from "@/presentation/features/institution/student-detail-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <StudentDetailView studentId={id} />;
}
