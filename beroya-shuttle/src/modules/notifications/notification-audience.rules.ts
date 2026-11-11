import { NotificationAudience } from '../../generated/prisma/client';

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export function routeAudienceRequiresRoute(
  audience: NotificationAudience,
): boolean {
  return (
    audience === NotificationAudience.ROUTE_PARENTS ||
    audience === NotificationAudience.ROUTE_UNIVERSITY_STUDENTS ||
    audience === NotificationAudience.ROUTE_DRIVERS ||
    audience === NotificationAudience.ROUTE_ATTENDANTS
  );
}
