import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/features/admin/admin-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
