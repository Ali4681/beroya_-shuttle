jest.mock('./institution-notifications.service', () => ({
  InstitutionNotificationsService: class InstitutionNotificationsService {},
}));

import {
  AttendantNotificationsController,
  DriverNotificationsController,
} from './inbox.controller';
import { InstitutionNotificationsService } from './institution-notifications.service';

describe('DriverNotificationsController', () => {
  const notifications = {
    inbox: jest.fn(),
    inboxById: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  };
  const controller = new DriverNotificationsController(
    notifications as unknown as InstitutionNotificationsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lists the current driver inbox', async () => {
    notifications.inbox.mockResolvedValue({ data: [], meta: { page: 1 } });
    await expect(
      controller.list('driver-user', { page: 1, limit: 20 }),
    ).resolves.toEqual({ data: [], meta: { page: 1 } });
    expect(notifications.inbox).toHaveBeenCalledWith('driver-user', {
      page: 1,
      limit: 20,
    });
  });

  it('gets one inbox notification', async () => {
    notifications.inboxById.mockResolvedValue({ id: 'r1' });
    await expect(controller.getOne('driver-user', 'n1')).resolves.toEqual({
      id: 'r1',
    });
    expect(notifications.inboxById).toHaveBeenCalledWith('driver-user', 'n1');
  });

  it('marks one notification as read', async () => {
    notifications.markRead.mockResolvedValue({ id: 'r1', readAt: new Date() });
    await controller.markRead('driver-user', 'r1');
    expect(notifications.markRead).toHaveBeenCalledWith('driver-user', 'r1');
  });

  it('marks all notifications as read', async () => {
    notifications.markAllRead.mockResolvedValue({ updatedCount: 2 });
    await expect(controller.markAllRead('driver-user')).resolves.toEqual({
      updatedCount: 2,
    });
    expect(notifications.markAllRead).toHaveBeenCalledWith('driver-user');
  });
});

describe('AttendantNotificationsController', () => {
  const notifications = {
    inbox: jest.fn(),
    inboxById: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  };
  const controller = new AttendantNotificationsController(
    notifications as unknown as InstitutionNotificationsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lists the current attendant inbox', async () => {
    notifications.inbox.mockResolvedValue({ data: [], meta: { page: 1 } });
    await expect(
      controller.list('attendant-user', { page: 1, limit: 20 }),
    ).resolves.toEqual({ data: [], meta: { page: 1 } });
    expect(notifications.inbox).toHaveBeenCalledWith('attendant-user', {
      page: 1,
      limit: 20,
    });
  });

  it('gets one inbox notification', async () => {
    notifications.inboxById.mockResolvedValue({ id: 'r1' });
    await expect(controller.getOne('attendant-user', 'n1')).resolves.toEqual({
      id: 'r1',
    });
    expect(notifications.inboxById).toHaveBeenCalledWith('attendant-user', 'n1');
  });

  it('marks one notification as read', async () => {
    notifications.markRead.mockResolvedValue({ id: 'r1', readAt: new Date() });
    await controller.markRead('attendant-user', 'r1');
    expect(notifications.markRead).toHaveBeenCalledWith('attendant-user', 'r1');
  });

  it('marks all notifications as read', async () => {
    notifications.markAllRead.mockResolvedValue({ updatedCount: 2 });
    await expect(controller.markAllRead('attendant-user')).resolves.toEqual({
      updatedCount: 2,
    });
    expect(notifications.markAllRead).toHaveBeenCalledWith('attendant-user');
  });
});
