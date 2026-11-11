import { NotificationAudience } from '../../generated/prisma/client';
import {
  routeAudienceRequiresRoute,
  uniqueIds,
} from './notification-audience.rules';

describe('notification-audience.rules', () => {
  it('dedupes and drops empty ids', () => {
    expect(uniqueIds(['a', '', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('requires a route only for route-scoped audiences', () => {
    expect(routeAudienceRequiresRoute(NotificationAudience.ROUTE_PARENTS)).toBe(
      true,
    );
    expect(
      routeAudienceRequiresRoute(
        NotificationAudience.ROUTE_UNIVERSITY_STUDENTS,
      ),
    ).toBe(true);
    expect(routeAudienceRequiresRoute(NotificationAudience.ROUTE_DRIVERS)).toBe(
      true,
    );
    expect(
      routeAudienceRequiresRoute(NotificationAudience.ROUTE_ATTENDANTS),
    ).toBe(true);
    expect(routeAudienceRequiresRoute(NotificationAudience.ALL_PARENTS)).toBe(
      false,
    );
    expect(routeAudienceRequiresRoute(NotificationAudience.ALL_DRIVERS)).toBe(
      false,
    );
    expect(
      routeAudienceRequiresRoute(NotificationAudience.ALL_ATTENDANTS),
    ).toBe(false);
  });
});
