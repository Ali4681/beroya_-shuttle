import { Suspense } from "react";
import { SubscriptionsView } from "@/presentation/features/admin/subscriptions-view";

export default function Page() {
  return (
    <Suspense>
      <SubscriptionsView />
    </Suspense>
  );
}
