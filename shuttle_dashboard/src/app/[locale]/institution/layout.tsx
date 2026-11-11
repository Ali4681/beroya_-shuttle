import type { ReactNode } from "react";
import { InstitutionShell } from "@/presentation/features/institution/institution-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return <InstitutionShell>{children}</InstitutionShell>;
}
