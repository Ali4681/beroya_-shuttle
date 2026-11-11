"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useBrandingStore } from "@/application/stores/branding-store";
import { useInboxStore } from "@/application/stores/notification-inbox-store";
import { useSessionStore } from "@/application/stores/session-store";
import { useRouter } from "@/i18n/navigation";
import { authApi } from "@/infrastructure/api/auth.api";
import { unregisterPushDevice } from "@/infrastructure/firebase/push";
import { clearSession } from "@/shared/lib/session";

/** Ends the session (or every session with `everywhere`) and returns to the login page. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useSessionStore((state) => state.setUser);
  const resetBranding = useBrandingStore((state) => state.reset);
  const [pending, setPending] = useState(false);

  async function logout({ everywhere = false }: { everywhere?: boolean } = {}) {
    if (pending) return;
    setPending(true);
    try {
      await unregisterPushDevice();
      await (everywhere ? authApi.logoutAll() : authApi.logout());
    } catch {
      // The session is cleared locally even if the server call fails.
    }
    clearSession();
    useInboxStore.getState().clear();
    setUser(null);
    resetBranding();
    queryClient.clear();
    router.replace("/login");
  }

  return { logout, pending };
}
