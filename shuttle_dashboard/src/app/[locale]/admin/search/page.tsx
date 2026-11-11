import { Suspense } from "react";
import { AdminSearchView } from "@/presentation/features/admin/admin-search-view";

export default function Page() {
  return (
    <Suspense>
      <AdminSearchView />
    </Suspense>
  );
}
