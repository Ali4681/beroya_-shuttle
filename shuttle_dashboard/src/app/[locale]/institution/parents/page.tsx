import { Suspense } from "react";
import { ParentsView } from "@/presentation/features/institution/parents-view";

export default function Page() {
  return (
    <Suspense>
      <ParentsView />
    </Suspense>
  );
}
