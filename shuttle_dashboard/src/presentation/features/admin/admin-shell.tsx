"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useBrandingStore } from "@/application/stores/branding-store";
import { useSessionStore } from "@/application/stores/session-store";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { applyAdminEvent } from "@/infrastructure/realtime/invalidate";
import { PanelShell, ShellLoading } from "@/presentation/components/layout/panel-shell";
import { adminNav } from "@/presentation/components/sidebar/nav";
import { ErrorState } from "@/presentation/components/ui/states";
import { useRealtime } from "@/presentation/hooks/use-realtime";
import { updateSessionUser } from "@/shared/lib/session";

const ADMIN_ROOMS = ["admin:beroya"];

export function AdminShell({ children }: { children: ReactNode }) {
  const bootstrap = useQuery({
    queryKey: qk.admin.bootstrap,
    queryFn: adminApi.bootstrap,
    staleTime: Infinity,
  });
  const setUser = useSessionStore((state) => state.setUser);
  const resetBranding = useBrandingStore((state) => state.reset);
  const user = bootstrap.data?.user;

  useEffect(() => {
    resetBranding();
  }, [resetBranding]);

  useEffect(() => {
    if (!user) return;
    setUser(user);
    updateSessionUser(user);
  }, [user, setUser]);

  useRealtime(user ? ADMIN_ROOMS : [], applyAdminEvent);

  return (
    <PanelShell sections={adminNav} basePath="/admin">
      {bootstrap.isPending ? (
        <ShellLoading />
      ) : bootstrap.isError ? (
        <ErrorState error={bootstrap.error} onRetry={() => bootstrap.refetch()} className="min-h-[60vh]" />
      ) : (
        children
      )}
    </PanelShell>
  );
}
