import { TripDetailView } from "@/presentation/features/institution/trip-detail-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <TripDetailView tripId={id} />;
}
