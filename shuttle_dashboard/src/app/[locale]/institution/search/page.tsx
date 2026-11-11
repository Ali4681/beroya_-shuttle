import { Suspense } from "react";
import { InstitutionSearchView } from "@/presentation/features/institution/institution-search-view";

export default function Page() {
  return (
    <Suspense>
      <InstitutionSearchView />
    </Suspense>
  );
}
