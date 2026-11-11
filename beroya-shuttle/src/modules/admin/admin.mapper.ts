import {
  Institution,
  InstitutionBranch,
  InstitutionBranding,
  InstitutionSettings,
  InstitutionSubscription,
  ShuttleUser,
} from '../../generated/prisma/client';
import {
  mapBranch,
  mapBranding,
  mapInstitution,
  mapSettings,
  mapUser,
} from '../auth/auth.mapper';

export function mapInstitutionSummary(
  institution: Institution & {
    primaryAdmin?: ShuttleUser | null;
    subscriptions?: InstitutionSubscription[];
    _count?: { branches?: number };
  },
) {
  const currentSubscription = pickCurrentSubscription(
    institution.subscriptions ?? [],
  );
  return {
    ...mapInstitution(institution),
    contactPhone: institution.contactPhone,
    contactEmail: institution.contactEmail,
    city: institution.city,
    address: institution.address,
    statusReason: institution.statusReason,
    primaryAdminUserId: institution.primaryAdminUserId,
    primaryAdmin: institution.primaryAdmin
      ? mapUser(institution.primaryAdmin)
      : null,
    currentSubscription: currentSubscription
      ? mapSubscription(currentSubscription)
      : null,
    branchCount: institution._count?.branches ?? undefined,
    createdAt: institution.createdAt,
    updatedAt: institution.updatedAt,
  };
}

export function mapInstitutionDetail(
  institution: Institution & {
    primaryAdmin?: ShuttleUser | null;
    settings?: InstitutionSettings | null;
    branding?: InstitutionBranding | null;
    branches?: InstitutionBranch[];
    subscriptions?: InstitutionSubscription[];
  },
) {
  return {
    ...mapInstitutionSummary(institution),
    settings: mapSettings(institution.settings ?? null),
    branding: mapBranding(institution.branding ?? null),
    branches: (institution.branches ?? []).map(mapBranch),
  };
}

export function mapSubscription(subscription: InstitutionSubscription) {
  return {
    id: subscription.id,
    institutionId: subscription.institutionId,
    billingPeriod: subscription.billingPeriod,
    status: subscription.status,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    agreedAmount: subscription.agreedAmount.toString(),
    currencyCode: subscription.currencyCode,
    notes: subscription.notes,
    activatedAt: subscription.activatedAt,
    cancelledAt: subscription.cancelledAt,
    cancelReason: subscription.cancelReason,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

export function pickCurrentSubscription(
  subscriptions: InstitutionSubscription[],
): InstitutionSubscription | null {
  const now = Date.now();
  const active = subscriptions
    .filter(
      (item) =>
        item.status === 'ACTIVE' &&
        item.startsAt.getTime() <= now &&
        item.endsAt.getTime() >= now,
    )
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  return active[0] ?? null;
}
