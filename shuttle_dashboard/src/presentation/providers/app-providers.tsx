"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useBrandingStore } from "@/application/stores/branding-store";
import { useSessionStore } from "@/application/stores/session-store";
import { toast } from "@/application/stores/toast-store";
import { useRouter } from "@/i18n/navigation";
import { startAnalytics } from "@/infrastructure/firebase/firebase";
import { isApiError, setUnauthorizedHandler } from "@/infrastructure/http/client";
import { Toaster } from "@/presentation/components/ui/toaster";
import { clearSession } from "@/shared/lib/session";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const router = useRouter();
  const tErrors = useTranslations("Errors");
  const hydrate = useSessionStore((state) => state.hydrate);
  const setUser = useSessionStore((state) => state.setUser);
  const resetBranding = useBrandingStore((state) => state.reset);

  useEffect(() => {
    hydrate();
    void startAnalytics().catch(() => undefined);
  }, [hydrate]);

  useEffect(() => {
    let handling = false;
    setUnauthorizedHandler((code) => {
      if (handling) return;
      handling = true;
      clearSession();
      setUser(null);
      resetBranding();
      queryClient.clear();
      toast.error(tErrors.has(code) ? tErrors(code) : tErrors("UNAUTHORIZED"));
      router.replace("/login");
      window.setTimeout(() => {
        handling = false;
      }, 1500);
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient, resetBranding, router, setUser, tErrors]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
