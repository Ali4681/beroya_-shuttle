"use client";

import { VehiclesView } from "@/presentation/features/shared/resources";
import { useInstitution } from "@/presentation/features/institution/use-institution";

export default function Page() {
  const { institution } = useInstitution();
  const readOnly = institution.operationModel === "BEROYA_OPERATED";
  return <VehiclesView scope="institution" readOnly={readOnly} />;
}
