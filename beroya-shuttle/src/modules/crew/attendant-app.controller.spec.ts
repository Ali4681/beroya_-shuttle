jest.mock('./crew.service', () => ({
  CrewService: class CrewService {},
}));

import { AttendantAppController } from './attendant-app.controller';
import { CrewService } from './crew.service';
import { DriverTripHistoryQueryDto } from './dto/driver-trip-history.query';

describe('AttendantAppController', () => {
  const crew = {
    attendantToday: jest.fn(),
    attendantHistory: jest.fn(),
    attendantTrip: jest.fn(),
  };
  const controller = new AttendantAppController(crew as unknown as CrewService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('routes history to attendantHistory (not :id UUID parse)', async () => {
    const query = {
      from: '2026-10-01',
      to: '2026-10-05',
      page: 1,
      limit: 20,
    } as DriverTripHistoryQueryDto;
    const payload = {
      data: [{ id: 't1', hasEmergency: false }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    crew.attendantHistory.mockResolvedValue(payload);

    await expect(
      controller.history('attendant-user', query),
    ).resolves.toEqual(payload);
    expect(crew.attendantHistory).toHaveBeenCalledWith(
      'attendant-user',
      query,
    );
    expect(crew.attendantTrip).not.toHaveBeenCalled();
  });
});
