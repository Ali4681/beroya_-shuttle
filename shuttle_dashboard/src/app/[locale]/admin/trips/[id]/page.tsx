import { AdminTripDetailView } from "@/presentation/features/admin/operations-trips-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <AdminTripDetailView tripId={id} />;
}
