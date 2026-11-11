import { Suspense } from "react";
import { InstitutionsView } from "@/presentation/features/admin/institutions-view";

export default function Page() {
  return (
    <Suspense>
      <InstitutionsView />
    </Suspense>
  );
}
