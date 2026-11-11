import { InstitutionDetailView } from "@/presentation/features/admin/institution-detail-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <InstitutionDetailView id={id} />;
}
