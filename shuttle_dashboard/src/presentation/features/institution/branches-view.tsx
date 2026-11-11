"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { institutionApi } from "@/infrastructure/api/institution.api";
import { qk } from "@/infrastructure/api/query-keys";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, KeyValue, PageSection } from "@/presentation/components/ui/panel";
import { LoadingState } from "@/presentation/components/ui/states";
import { BranchesManager, type BranchesApi } from "@/presentation/features/shared/branches-manager";

const branchKeys = [qk.institution.branches, qk.institution.bootstrap];

const branchesApi: BranchesApi = {
  create: institutionApi.createBranch,
  update: institutionApi.updateBranch,
  setStatus: institutionApi.setBranchStatus,
  remove: institutionApi.deleteBranch,
};

export function BranchesView() {
  const t = useTranslations("Branches");
  const [statsFor, setStatsFor] = useState<string | null>(null);

  const branches = useQuery({ queryKey: qk.institution.branches, queryFn: institutionApi.branches });
  const selectedId = statsFor ?? branches.data?.[0]?.id ?? null;

  return (
    <PageSection>
      <PageHeader icon="branch" title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <BranchesManager
          rows={branches.data}
          isLoading={branches.isPending}
          error={branches.error}
          onRetry={() => branches.refetch()}
          api={branchesApi}
          invalidate={branchKeys}
          onRowClick={(row) => setStatsFor(row.id)}
        />
        <BranchStatsCard branchId={selectedId} name={branches.data?.find((b) => b.id === selectedId)?.name} />
      </div>
    </PageSection>
  );
}

function BranchStatsCard({ branchId, name }: { branchId: string | null; name?: string }) {
  const t = useTranslations("Branches");
  const stats = useQuery({
    queryKey: qk.institution.branchStats(branchId ?? ""),
    queryFn: () => institutionApi.branchStats(branchId!),
    enabled: Boolean(branchId),
  });
  if (!branchId) return null;
  return (
    <Card title={t("statsFor", { name: name ?? "" })}>
      {stats.isPending ? (
        <LoadingState rows={3} />
      ) : stats.data ? (
        <KeyValue
          items={[
            { label: t("students"), value: stats.data.counts.students },
            { label: t("routes"), value: stats.data.counts.routes },
            { label: t("tripsToday"), value: stats.data.counts.tripsToday },
          ]}
        />
      ) : (
        <p className="text-start text-sm text-text-muted">—</p>
      )}
    </Card>
  );
}
