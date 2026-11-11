import { RouteDetailView } from "@/presentation/features/institution/route-detail-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <RouteDetailView routeId={id} />;
}
