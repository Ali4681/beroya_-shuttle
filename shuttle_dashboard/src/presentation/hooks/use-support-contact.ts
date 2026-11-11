"use client";

import { useQuery } from "@tanstack/react-query";
import { http } from "@/infrastructure/http/client";
import { qk } from "@/infrastructure/api/query-keys";

export function useSupportContact() {
  return useQuery({
    queryKey: qk.public.supportContact,
    queryFn: () =>
      http.getPublic<{ supportPhone: string | null; supportWhatsappUrl?: string | null }>("/public/support-contact"),
    staleTime: 60_000,
  });
}
