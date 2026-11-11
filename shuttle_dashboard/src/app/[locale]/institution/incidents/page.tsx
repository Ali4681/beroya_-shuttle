import { Suspense } from "react";
import { IncidentsView } from "@/presentation/features/institution/incidents-view";

export default function Page() {
  return (
    <Suspense>
      <IncidentsView />
    </Suspense>
  );
}
